// Shared step -> ACP update engine for both live streaming and history replay.
//
// Streaming and replay only really differ in how they treat the agent's text
// stream (step type 15):
//
//   - streaming emits the newly-appended slice each poll (text grows in place
//     at a fixed idx), keeps consecutive text rows under one message id, and
//     re-emits tool steps as `tool_call_update` when their status/content snapshot changes;
//   - replay buffers consecutive agent-text parts and flushes them as one
//     message at each boundary, applying narration filtering across the group.
//
// Everything else — tool calls, titles, user prompts — is identical, so it
// flows through the same per-step dispatcher (`sessionUpdateFromStep`).
// This class owns the one row loop; the two modes are just small branches
// inside it.
import { splitTextAndImages, splitTextAndImagesWithRanges } from "../../acp/content/index.js";
import { filterNarration, isNarration } from "./narration.js";
import { isSystemMessage, isSystemMessagePrefix } from "./system-message.js";
import { getCompletedStepTargetPaths } from "./tool-call-updates.js";
import { sessionUpdateFromStep } from "./updates.js";
function agentChunk(text, messageId) {
    return {
        sessionUpdate: "agent_message_chunk",
        messageId,
        content: { type: "text", text }
    };
}
function agentContentBlockChunk(content, messageId) {
    return {
        sessionUpdate: "agent_message_chunk",
        messageId,
        content
    };
}
function thoughtChunk(text, messageId) {
    return {
        sessionUpdate: "agent_thought_chunk",
        messageId,
        content: { type: "text", text }
    };
}
/** Stable signature of a tool/plan/thought update for progressive re-emission. */
function updateSnapshot(update) {
    const raw = update;
    return JSON.stringify({
        sessionUpdate: raw.sessionUpdate,
        toolCallId: raw.toolCallId,
        name: raw.name,
        title: raw.title,
        kind: raw.kind,
        status: raw.status,
        content: raw.content,
        locations: raw.locations,
        rawInput: raw.rawInput,
        rawOutput: raw.rawOutput,
        messageId: raw.messageId,
        entries: raw.entries,
        plan: raw.plan,
        planId: raw.planId,
        _meta: raw._meta,
        text: raw.content && typeof raw.content === "object" ? raw.content.text : undefined
    });
}
function withStepMeta(update, stepIdx) {
    const raw = update;
    const meta = raw._meta ?? {};
    if (meta.stepIdx === stepIdx)
        return update;
    return {
        ...raw,
        _meta: { ...meta, stepIdx }
    };
}
function asToolCallUpdate(update) {
    return {
        ...update,
        sessionUpdate: "tool_call_update"
    };
}
function resolveContextWindowSize(usage) {
    if (usage.contextWindowSize && usage.contextWindowSize > 0) {
        return usage.contextWindowSize;
    }
    if (usage.modelSlug) {
        const slug = usage.modelSlug.toLowerCase();
        if (slug.includes("gemini"))
            return 1048576;
        if (slug.includes("claude"))
            return 200000;
        if (slug.includes("gpt-4") || slug.includes("o1") || slug.includes("o3") || slug.includes("o4"))
            return 128000;
    }
    return undefined;
}
export class Translator {
    opts;
    // Streaming: idx -> chars of agent text already emitted (for incremental diff).
    agentTextLengths = new Map();
    // Streaming: thought messageId -> chars already emitted.
    thoughtTextLengths = new Map();
    // Stream + replay: final provider-error messages already emitted.
    emittedProviderErrorMessageIds = new Set();
    // Stream + replay: last emitted snapshot keyed by tool call id, or by plan id
    // + source row for plans (progressive lifecycle without cross-row replay).
    toolSnapshots = new Map();
    // Stream + replay: last known file bodies from view_file / write_to_file (for diffs).
    fileContents = new Map();
    // Stream + replay: previous plan entries keyed by plan id (stable entry-id reconciliation).
    planEntries = new Map();
    // Stream + replay: completed generate_image artifacts cached per tool call.
    imageArtifacts = new Map();
    // Candidate ACP location paths and their readability during the latest translation.
    locationReadability = new Map();
    // Replay: buffered consecutive agent-text parts, flushed at boundaries.
    pendingAgentParts = [];
    // Replay: message id for the current buffered agent-text group.
    pendingAgentMessageId = null;
    pendingAgentStartStepIdx = null;
    pendingAgentEndStepIdx = null;
    pendingAgentSupersededPaths;
    _lastTitle = null;
    _lastStepIdx = -1;
    _hadUpdates = false;
    lastEmittedUsageUsed = null;
    constructor(opts) {
        this.opts = opts;
    }
    /** Highest step idx seen so far. */
    get lastStepIdx() {
        return this._lastStepIdx;
    }
    /** Whether any update has been produced across all batches. */
    get hadUpdates() {
        return this._hadUpdates;
    }
    /**
     * Reset row-derived file state before replaying a complete prompt-scoped
     * snapshot. StreamPoller rereads all rows after its fixed base idx whenever
     * SQLite changes; rebuilding this cache makes oldText derivation independent
     * of the previous poll's terminal state.
     */
    resetFileContentsForFullReplay() {
        this.fileContents.clear();
    }
    /** Translate a batch of rows into ordered ACP updates, advancing state. */
    translate(rows) {
        const out = [];
        let streamingAgentMessageId = null;
        let streamingHasVisibleText = false;
        // Precompute paths modified by later completed steps in this batch.
        // A historical step cannot reliably attribute the current file on disk if a
        // later completed step in the batch overwrote that target path.
        const supersededPaths = new Set();
        const supersededByRowIndex = new Array(rows.length);
        for (let i = rows.length - 1; i >= 0; i--) {
            supersededByRowIndex[i] = new Set(supersededPaths);
            const row = rows[i];
            if (row.status === 3 || row.status === 6 || row.status === 7) {
                const modified = getCompletedStepTargetPaths(row, this.opts.cwd);
                for (const p of modified) {
                    supersededPaths.add(p);
                }
            }
        }
        for (const [rowIndex, row] of rows.entries()) {
            let streamingNeedsSeparator = false;
            const canGrow = rowIndex === rows.length - 1 && row.status !== 3 && row.status !== 6 && row.status !== 7;
            if (this.opts.mode === "stream") {
                if (row.stepType === 15) {
                    const text = row.stepPayload.agentText?.text ?? "";
                    const isSysMsg = isSystemMessage(text);
                    const isSysMsgPrefix = canGrow && isSystemMessagePrefix(text);
                    if (text.length > 0 && !isSysMsg && !isSysMsgPrefix)
                        streamingAgentMessageId ??= String(row.idx);
                    const visible = text.length > 0 && !isSysMsg && !isSysMsgPrefix && !(this.opts.skipNarration && isNarration(text));
                    streamingNeedsSeparator = visible && streamingHasVisibleText;
                    if (visible)
                        streamingHasVisibleText = true;
                }
                else {
                    streamingAgentMessageId = null;
                    streamingHasVisibleText = false;
                }
            }
            this.translateRow(row, out, streamingAgentMessageId, streamingNeedsSeparator, canGrow, supersededByRowIndex[rowIndex]);
        }
        // Replay groups agent text per batch; a batch ends a message boundary.
        if (this.opts.mode === "replay")
            this.flushAgentBuffer(out);
        if (out.length > 0)
            this._hadUpdates = true;
        return out;
    }
    /** Translate new generation usage metrics into an ACP usage_update notification. */
    translateUsage(usages) {
        const out = [];
        for (const usage of usages) {
            if (usage.totalInputTokens <= 0 && usage.totalTokens <= 0)
                continue;
            const size = resolveContextWindowSize(usage);
            if (size === undefined)
                continue;
            const used = usage.totalInputTokens;
            if (this.lastEmittedUsageUsed !== used) {
                this.lastEmittedUsageUsed = used;
                this._hadUpdates = true;
                out.push({
                    sessionUpdate: "usage_update",
                    used,
                    size
                });
            }
        }
        return out;
    }
    translateRow(row, out, streamingAgentMessageId, streamingNeedsSeparator, canGrow, supersededPaths) {
        this._lastStepIdx = Math.max(this._lastStepIdx, row.idx);
        switch (row.stepType) {
            case 15: // agent text chunk
                this.handleAgentText(row, out, streamingAgentMessageId, streamingNeedsSeparator, canGrow, supersededPaths);
                return;
            case 23: // conversation title (+ optional think narration)
                this.handleTitle(row, out);
                return;
            case 14: // user prompt
                // The streaming client already has its own prompt; only replay re-emits it.
                if (this.opts.mode === "stream")
                    return;
                this.flushAgentBuffer(out);
                this.pushDispatched(row, out, supersededPaths);
                return;
            default: {
                // Tool calls and lifecycle steps. In replay, a tool call ends the
                // current agent message. In both modes, progressive status/content
                // changes re-emit as tool_call_update.
                if (this.opts.mode === "replay") {
                    this.flushAgentBuffer(out);
                }
                this.pushDispatched(row, out, supersededPaths);
            }
        }
    }
    pushDispatched(row, out, supersededPaths) {
        const update = sessionUpdateFromStep(row, {
            cwd: this.opts.cwd,
            fileContents: this.fileContents,
            planEntries: this.planEntries,
            locationReadability: this.locationReadability,
            imageArtifacts: this.imageArtifacts,
            supersededPaths
        });
        if (Array.isArray(update)) {
            for (const item of update)
                this.emitProgressive(row.idx, item, out);
        }
        else if (update) {
            this.emitProgressive(row.idx, update, out);
        }
    }
    /**
     * Emit a tool/plan/thought update. Tools re-emit as `tool_call_update` when
     * the snapshot changes; plans re-emit as a full `plan` replacement when the
     * markdown-derived entries change. Unrelated update kinds pass through.
     */
    emitProgressive(stepIdx, update, out) {
        const raw = update;
        const kind = raw.sessionUpdate;
        if (kind === "agent_thought_chunk") {
            this.emitThought(stepIdx, update, out);
            return;
        }
        if (kind === "agent_message_chunk" && String(raw.messageId).startsWith("provider-error-")) {
            this.emitProviderError(stepIdx, update, out);
            return;
        }
        const stamped = withStepMeta(update, stepIdx);
        if (kind === "plan" || kind === "plan_update" || kind === "plan_removed") {
            const snapshot = updateSnapshot(stamped);
            const meta = raw._meta && typeof raw._meta === "object" ? raw._meta : null;
            const planId = (typeof raw.planId === "string" && raw.planId) ||
                (typeof meta?.["agy-acp/planId"] === "string" && meta["agy-acp/planId"]) ||
                undefined;
            // Scope dedupe to the source row: StreamPoller rereads all rows since the
            // turn began on every DB change, so a plan-level shared key would replay
            // each historical state (rollback) whenever a later row changes.
            const key = planId ? `plan:${planId}:${stepIdx}` : `plan:${stepIdx}`;
            const previous = this.toolSnapshots.get(key);
            if (previous === snapshot)
                return;
            this.toolSnapshots.set(key, snapshot);
            out.push(stamped);
            return;
        }
        if (kind !== "tool_call" && kind !== "tool_call_update") {
            out.push(stamped);
            return;
        }
        const snapshot = updateSnapshot(stamped);
        const toolId = typeof raw.toolCallId === "string" && raw.toolCallId.trim() ? raw.toolCallId.trim() : undefined;
        const key = toolId ? `tool:${toolId}` : `step:${stepIdx}`;
        const previous = this.toolSnapshots.get(key);
        if (previous === undefined) {
            this.toolSnapshots.set(key, snapshot);
            // First sight always uses create shape; v2 boundary may rewrite to upsert.
            out.push({ ...stamped, sessionUpdate: "tool_call" });
            return;
        }
        if (previous === snapshot)
            return;
        this.toolSnapshots.set(key, snapshot);
        out.push(asToolCallUpdate(stamped));
    }
    emitThought(stepIdx, update, out) {
        const raw = update;
        const content = raw.content;
        const text = typeof content?.text === "string" ? content.text : "";
        const messageId = typeof raw.messageId === "string" && raw.messageId.length > 0 ? raw.messageId : "thought";
        // Stream + replay: emit only the newly appended slice per messageId so
        // repeated polls of an unchanged thought step produce nothing.
        const emitted = this.thoughtTextLengths.get(messageId) ?? 0;
        if (text.length <= emitted)
            return;
        this.thoughtTextLengths.set(messageId, text.length);
        const delta = text.slice(emitted);
        if (delta.length > 0)
            out.push(withStepMeta(thoughtChunk(delta, messageId), stepIdx));
    }
    emitProviderError(stepIdx, update, out) {
        const raw = update;
        const content = raw.content;
        const text = typeof content?.text === "string" ? content.text : "";
        const messageId = typeof raw.messageId === "string" ? raw.messageId : `provider-error-${stepIdx}`;
        if (!text || this.emittedProviderErrorMessageIds.has(messageId))
            return;
        this.emittedProviderErrorMessageIds.add(messageId);
        out.push(withStepMeta(agentChunk(text, messageId), stepIdx));
    }
    handleTitle(row, out) {
        const title = row.stepPayload.titleUpdate?.title ?? null;
        const blocks = title?.split("\n\n");
        const currentTitle = blocks?.shift() || null;
        if (currentTitle !== this._lastTitle) {
            this._lastTitle = currentTitle;
            out.push(withStepMeta({ sessionUpdate: "session_info_update", title: currentTitle }, row.idx));
        }
        const narration = blocks?.filter((b) => b.trim().length > 0).join("\n\n") ?? "";
        if (!narration)
            return;
        // Title-attached "Think" narration is real agent thought, not a tool card.
        this.emitThought(row.idx, thoughtChunk(narration, `title-thought-${row.idx}`), out);
    }
    handleAgentText(row, out, streamingAgentMessageId, streamingNeedsSeparator, canGrow, supersededPaths) {
        const thought = row.stepPayload.agentText?.thought;
        if (thought) {
            this.emitThought(row.idx, thoughtChunk(thought, `agent-thought-${row.idx}`), out);
        }
        const text = row.stepPayload.agentText?.text ?? "";
        if (isSystemMessage(text))
            return;
        if (this.opts.mode === "stream" && canGrow && isSystemMessagePrefix(text))
            return;
        const messageId = streamingAgentMessageId ?? String(row.idx);
        if (this.opts.mode === "replay") {
            if (text.length > 0) {
                if (this.pendingAgentMessageId === null) {
                    this.pendingAgentMessageId = messageId;
                    this.pendingAgentStartStepIdx = row.idx;
                    this.pendingAgentSupersededPaths = supersededPaths;
                }
                this.pendingAgentEndStepIdx = row.idx;
                this.pendingAgentParts.push(text);
            }
            return;
        }
        // Streaming: emit only the slice appended since the last poll for this idx.
        // Chunks for the same step share one messageId (required by ACP v2).
        const emitted = this.agentTextLengths.get(row.idx) ?? 0;
        if (text.length <= emitted)
            return;
        // When the row is actively streaming (canGrow: true), do not cut an incomplete
        // markdown image embed in half (e.g. trailing `!` or `![plot](path/to` without the closing `)`).
        // Buffer from the opening `!` or `![` until the closing `)` arrives or the step finishes.
        let limit = text.length;
        if (canGrow) {
            if (text.endsWith("!")) {
                limit = text.length - 1;
            }
            const lastOpen = text.lastIndexOf("![");
            if (lastOpen >= 0) {
                const tail = text.slice(lastOpen);
                const destStart = tail.lastIndexOf("](");
                let isClosed = false;
                if (destStart >= 0) {
                    const destBody = tail.slice(destStart + 2);
                    if (destBody.startsWith("<")) {
                        isClosed = destBody.includes(">)");
                    }
                    else {
                        isClosed = destBody.includes(")");
                    }
                }
                if (!isClosed) {
                    limit = Math.min(limit, lastOpen);
                }
            }
        }
        if (limit <= emitted)
            return;
        this.agentTextLengths.set(row.idx, limit);
        if (this.opts.skipNarration && isNarration(text))
            return;
        const delta = text.slice(emitted, limit);
        if (delta.length > 0) {
            const fullText = text.slice(0, limit);
            const spanned = splitTextAndImagesWithRanges(fullText, this.opts.cwd);
            let isFirstEmitted = true;
            for (const { block, start, end } of spanned) {
                if (end <= emitted)
                    continue;
                let b = block;
                if (start < emitted && b.type === "text") {
                    b = { type: "text", text: b.text.slice(emitted - start) };
                }
                if (emitted === 0 && isFirstEmitted && streamingNeedsSeparator && b.type === "text") {
                    b = { type: "text", text: `\n${b.text}` };
                }
                isFirstEmitted = false;
                out.push(agentContentBlockChunk(b, messageId));
            }
        }
    }
    flushAgentBuffer(out) {
        if (this.pendingAgentParts.length === 0)
            return;
        const text = this.opts.skipNarration
            ? filterNarration(this.pendingAgentParts)
            : this.pendingAgentParts.join("\n");
        const messageId = this.pendingAgentMessageId ?? "agent";
        const startStepIdx = this.pendingAgentStartStepIdx;
        const endStepIdx = this.pendingAgentEndStepIdx;
        const superseded = this.pendingAgentSupersededPaths;
        this.pendingAgentParts.length = 0;
        this.pendingAgentMessageId = null;
        this.pendingAgentStartStepIdx = null;
        this.pendingAgentEndStepIdx = null;
        this.pendingAgentSupersededPaths = undefined;
        if (text && text.length > 0) {
            const blocks = splitTextAndImages(text, this.opts.cwd, superseded);
            for (const block of blocks) {
                const chunk = agentContentBlockChunk(block, messageId);
                if (startStepIdx != null) {
                    const stamped = withStepMeta(chunk, startStepIdx);
                    if (endStepIdx != null && endStepIdx > startStepIdx) {
                        stamped._meta.endStepIdx = endStepIdx;
                    }
                    out.push(stamped);
                }
                else {
                    out.push(chunk);
                }
            }
        }
    }
}
//# sourceMappingURL=translator.js.map