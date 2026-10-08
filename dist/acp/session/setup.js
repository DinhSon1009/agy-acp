// ACP session/new, session/load, session/resume: build and reload agy-backed sessions.
// Docs: https://agentclientprotocol.com/protocol/v1/session-setup
import { randomUUID } from "node:crypto";
import { configFromEnv, DEFAULT_CONVERSATIONS_DIR, isSessionModeId } from "../../agy/cli.js";
import { discardForkedConversation, forkConversation } from "../../agy/db/fork.js";
import { buildModelCatalog } from "../../agy/model/catalog.js";
import { applyModelSelection, initialModelSelection, restoredModelSelection } from "../../agy/model/selection.js";
import { cancelQueuedPrompts } from "./cancel.js";
import { notifyIdleAndDrainQueue, sessionTurnBusy } from "./prompt.js";
import { turnsOf } from "./turn-scheduler.js";
export { KeyedAsyncLock } from "./setup-lock.js";
/** Build a fresh session bound to `cwd` + ACP `additionalDirectories`. */
export async function buildSession(cwd, additionalDirectories, stored, deps) {
    const config = configFromEnv({
        cwd,
        additionalDirectories,
        env: deps.env,
        argv: deps.argv,
        conversationsDir: deps.conversationsDir
    });
    const modelOptions = await deps.getModelOptions(config);
    const catalog = buildModelCatalog(modelOptions);
    const agy = await deps.backend.startSession(config);
    if (stored?.conversationId) {
        agy.restoreConversation(stored.conversationId, stored.lastStepIdx);
    }
    const selection = stored
        ? restoredModelSelection(stored.model, stored.reasoningEffort, catalog)
        : initialModelSelection(config.model, catalog);
    applyModelSelection(agy, selection.baseModel, selection.reasoningEffort, catalog);
    if (stored?.mode && isSessionModeId(stored.mode)) {
        agy.setMode(stored.mode);
    }
    return {
        sessionId: "", // set by the caller once the ACP session id is known
        cwd,
        additionalDirectories,
        agy,
        catalog,
        selectedBaseModel: selection.baseModel,
        selectedReasoningEffort: selection.reasoningEffort,
        promptQueue: [],
        v2UserMessageIdsByStep: { ...(stored?.v2UserMessageIdsByStep ?? {}) }
    };
}
/** Register a session in the active-sessions map, evicting idle sessions past the capacity limit. */
export async function registerSession(sessionId, session, sessions, maxActiveSessions, options) {
    const replaced = sessions.get(sessionId);
    if (replaced && replaced !== session) {
        if (sessionTurnBusy(replaced)) {
            throw new Error(`Cannot replace session while a turn is active: ${sessionId}`);
        }
        sessions.delete(sessionId);
        replaced.closed = true;
        turnsOf(replaced).close();
        cancelQueuedPrompts(replaced);
        await replaced.agy.close().catch(() => { });
    }
    while (sessions.size >= maxActiveSessions) {
        const candidate = [...sessions].find(([id, current]) => !sessionTurnBusy(current) || options?.evictable?.has(id));
        if (!candidate)
            break;
        const [evictedId, evicted] = candidate;
        sessions.delete(evictedId);
        evicted.closed = true;
        turnsOf(evicted).close();
        cancelQueuedPrompts(evicted);
        await evicted.agy.close().catch((error) => {
            console.error(`[agy-acp] WARN: failed to close evicted session ${evictedId}: ${error.message}`);
        });
    }
    sessions.set(sessionId, session);
}
export async function createSession(requestedCwd, requestedDirs, deps) {
    const cwd = requestedCwd || process.cwd();
    const additionalDirectories = dedupe(requestedDirs ?? []);
    const sessionId = randomUUID();
    const session = await buildSession(cwd, additionalDirectories, null, deps);
    session.sessionId = sessionId;
    await registerSession(sessionId, session, deps.sessions, deps.maxActiveSessions);
    await deps.persistSession(sessionId, session);
    return session;
}
/** Shared reconstruction for `session/load` and `session/resume`: restore a
 *  persisted session binding and re-register it in memory. */
export async function reloadSession(sessionId, requestedCwd, requestedDirs, deps) {
    return deps.setupLocks.run(sessionId, async () => {
        const stored = await deps.store.restore(sessionId);
        if (!stored) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        const cwd = requestedCwd || stored.cwd;
        const additionalDirectories = dedupe(requestedDirs ?? stored.additionalDirectories);
        const session = await buildSession(cwd, additionalDirectories, stored, deps);
        session.sessionId = sessionId;
        await registerSession(sessionId, session, deps.sessions, deps.maxActiveSessions);
        return { session, cwd, stored };
    });
}
/** Fork an existing session into a new independent session binding. */
export async function forkSession(parentSessionId, requestedCwd, requestedDirs, deps) {
    return deps.setupLocks.run(parentSessionId, async () => {
        const activeParent = deps.sessions.get(parentSessionId);
        let claim;
        if (activeParent) {
            if (sessionTurnBusy(activeParent)) {
                throw new Error(`Cannot fork session while a turn is active: ${parentSessionId}`);
            }
            claim = turnsOf(activeParent).claimIdle("foreground");
        }
        try {
            const parentStored = activeParent
                ? sessionRecord(activeParent)
                : await deps.store.restore(parentSessionId);
            if (!parentStored) {
                throw new Error(`Unknown session: ${parentSessionId}`);
            }
            const cwd = requestedCwd || parentStored.cwd;
            const additionalDirectories = dedupe(requestedDirs ?? parentStored.additionalDirectories);
            const childSessionId = randomUUID();
            let childConversationId = null;
            let convDir;
            let childLastStepIdx = parentStored.lastStepIdx;
            let childSession;
            let setupComplete = false;
            try {
                if (parentStored.conversationId) {
                    childConversationId = randomUUID();
                    convDir = deps.conversationsDir ?? DEFAULT_CONVERSATIONS_DIR;
                    const forked = await forkConversation(convDir, parentStored.conversationId, childConversationId);
                    // Bind the child cursor to the copied snapshot so inherited rows cannot
                    // be emitted as the child's first-turn output. agy resumes via
                    // `--conversation <id>` and StreamPoller emits idx > lastStepIdx.
                    childLastStepIdx = Math.max(parentStored.lastStepIdx, forked.maxStepIdx);
                    claim?.throwIfAborted();
                }
                const childStored = {
                    cwd,
                    additionalDirectories,
                    conversationId: childConversationId,
                    lastStepIdx: childLastStepIdx,
                    model: parentStored.model,
                    reasoningEffort: parentStored.reasoningEffort,
                    mode: parentStored.mode,
                    v2UserMessageIdsByStep: { ...(parentStored.v2UserMessageIdsByStep ?? {}) },
                    updatedAt: new Date().toISOString()
                };
                childSession = await buildSession(cwd, additionalDirectories, childStored, deps);
                claim?.throwIfAborted();
                childSession.sessionId = childSessionId;
                await registerSession(childSessionId, childSession, deps.sessions, deps.maxActiveSessions, activeParent ? { evictable: new Set([parentSessionId]) } : undefined);
                await deps.persistSession(childSessionId, childSession);
                setupComplete = true;
                return { childSession, cwd, childSessionId };
            }
            finally {
                if (!setupComplete) {
                    if (deps.sessions.get(childSessionId) === childSession) {
                        deps.sessions.delete(childSessionId);
                    }
                    if (childSession) {
                        childSession.closed = true;
                        turnsOf(childSession).close();
                        await childSession.agy.close().catch(() => { });
                    }
                    if (childConversationId && convDir) {
                        discardForkedConversation(convDir, childConversationId);
                    }
                }
            }
        }
        finally {
            if (activeParent && claim) {
                turnsOf(activeParent).release(claim);
                notifyIdleAndDrainQueue(activeParent);
            }
        }
    });
}
export function sessionRecord(session) {
    return {
        cwd: session.cwd,
        additionalDirectories: session.additionalDirectories,
        conversationId: session.agy.conversationId,
        lastStepIdx: session.agy.lastStepIdx,
        model: session.selectedBaseModel,
        reasoningEffort: session.selectedReasoningEffort,
        mode: session.agy.config.mode,
        v2UserMessageIdsByStep: session.v2UserMessageIdsByStep,
        updatedAt: new Date().toISOString()
    };
}
export function persistSession(store, sessionId, session) {
    if (session.closed)
        return Promise.resolve();
    return store.persist(sessionId, sessionRecord(session));
}
function getUpdateStepRange(u) {
    const rec = u;
    const meta = rec._meta;
    let startIdx;
    if (typeof meta?.stepIdx === "number")
        startIdx = meta.stepIdx;
    else if (typeof rec.stepIdx === "number")
        startIdx = rec.stepIdx;
    else if (typeof rec.messageId === "string") {
        const parsed = parseInt(rec.messageId, 10);
        if (!isNaN(parsed))
            startIdx = parsed;
    }
    if (startIdx == null)
        return undefined;
    const endIdx = typeof meta?.endStepIdx === "number" ? meta.endStepIdx : startIdx;
    return { stepIdx: startIdx, endStepIdx: endIdx };
}
export function filterUpdatesForReplayFrom(updates, replayFrom) {
    const type = String(replayFrom.type ?? "").toLowerCase();
    if (type === "start") {
        return updates;
    }
    if (type === "message") {
        const targetId = typeof replayFrom.messageId === "string" ? replayFrom.messageId : undefined;
        if (!targetId)
            return updates;
        const targetNum = parseInt(targetId, 10);
        const index = updates.findIndex((u) => {
            const rec = u;
            if (rec.messageId === targetId)
                return true;
            const range = getUpdateStepRange(u);
            if (rec.sessionUpdate === "agent_message_chunk" && range != null && !isNaN(targetNum)) {
                return range.stepIdx <= targetNum && targetNum <= range.endStepIdx;
            }
            return false;
        });
        return index >= 0 ? updates.slice(index) : [];
    }
    if (type === "step" || type === "step_idx" || type === "stepidx") {
        const targetIdx = typeof replayFrom.stepIdx === "number"
            ? replayFrom.stepIdx
            : typeof replayFrom.index === "number"
                ? replayFrom.index
                : typeof replayFrom.idx === "number"
                    ? replayFrom.idx
                    : undefined;
        if (targetIdx == null)
            return updates;
        const index = updates.findIndex((u) => {
            const range = getUpdateStepRange(u);
            return range != null && range.endStepIdx >= targetIdx;
        });
        return index >= 0 ? updates.slice(index) : [];
    }
    if (type === "tool_call" || type === "toolcall") {
        const targetId = typeof replayFrom.toolCallId === "string" ? replayFrom.toolCallId : undefined;
        if (!targetId)
            return updates;
        const index = updates.findIndex((u) => {
            const rec = u;
            return rec.toolCallId === targetId;
        });
        return index >= 0 ? updates.slice(index) : [];
    }
    throw new Error(`Unsupported replay cursor: ${String(replayFrom.type)}`);
}
/** Replay a persisted conversation's session updates (used by `session/load` and
 *  `session/resume` with `replayFrom`). */
export async function replayConversation(replayCache, session, conversationId, cwd, emit, replayFrom, v2UserMessageIdsByStep) {
    const replay = replayCache.get(session.agy.config.conversationsDir, conversationId, {
        skipNarration: false,
        cwd
    });
    if (!replay)
        return;
    const replayUpdates = v2UserMessageIdsByStep
        ? remapV2UserMessageIds(replay.updates, v2UserMessageIdsByStep)
        : replay.updates;
    const updates = replayFrom != null
        ? filterUpdatesForReplayFrom(replayUpdates, replayFrom)
        : replayUpdates;
    for (const update of updates) {
        await emit(update);
    }
}
function remapV2UserMessageIds(updates, messageIdsByStep) {
    return updates.map((update) => {
        const raw = update;
        if (raw.sessionUpdate !== "user_message_chunk")
            return update;
        const meta = raw._meta;
        const messageId = typeof meta?.stepIdx === "number"
            ? messageIdsByStep[String(meta.stepIdx)]
            : undefined;
        return messageId ? { ...raw, messageId } : update;
    });
}
function dedupe(values) {
    return [...new Set(values)];
}
//# sourceMappingURL=setup.js.map