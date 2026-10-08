// ACP terminals: agent-owned terminal ids and `terminal_update` construction
// for execute tool calls. This agent never calls terminal/create — agy runs
// commands itself — so these synthesize a display-only terminal reference
// from agy's own execute-tool history instead of a client-hosted terminal.
// Docs: https://agentclientprotocol.com/protocol/v1/terminals
/** Structural narrowing for JSON-shaped record values. */
export function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
/** Stable agent-owned terminal id for an execute tool call. */
export function terminalIdForToolCall(toolCallId) {
    return `agy-term-${toolCallId}`;
}
function isToolCallUpdate(raw) {
    return raw.sessionUpdate === "tool_call" || raw.sessionUpdate === "tool_call_update";
}
function isExecuteToolUpdate(raw) {
    return isToolCallUpdate(raw) && raw.kind === "execute";
}
function pickString(input, ...keys) {
    for (const key of keys) {
        const value = input[key];
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return undefined;
}
/** Strip markdown fences from tool content text blocks (execute builders wrap code). */
function unfence(text) {
    const trimmed = text.replace(/^\s+|\s+$/g, "");
    const match = /^`{3,}[^\n]*\n([\s\S]*?)\n`{3,}$/.exec(trimmed);
    return match ? match[1] : text;
}
function contentTexts(raw) {
    if (!Array.isArray(raw.content))
        return [];
    const texts = [];
    for (const item of raw.content) {
        const block = asRecord(item);
        if (!block || block.type !== "content")
            continue;
        const content = asRecord(block.content);
        if (content && typeof content.text === "string" && content.text.length > 0) {
            texts.push(unfence(content.text));
        }
    }
    return texts;
}
/** Extract execute-tool terminal fields from a v1-shaped tool call update. */
export function executeTerminalMeta(update) {
    const raw = update;
    if (!isExecuteToolUpdate(raw))
        return null;
    const toolCallId = typeof raw.toolCallId === "string" && raw.toolCallId.trim()
        ? raw.toolCallId.trim()
        : "";
    if (!toolCallId)
        return null;
    const rawInput = asRecord(raw.rawInput) ?? {};
    const rawOutput = asRecord(raw.rawOutput) ?? {};
    const command = pickString(rawInput, "CommandLine", "commandLine", "command") ??
        (typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : undefined);
    const cwd = pickString(rawInput, "Cwd", "cwd");
    let output = typeof rawOutput.output === "string" ? rawOutput.output : undefined;
    if (output == null && Array.isArray(raw.content)) {
        for (const item of raw.content) {
            const block = asRecord(item);
            if (!block || block.type !== "content")
                continue;
            if (block.kind === "output") {
                const content = asRecord(block.content);
                if (content && typeof content.text === "string") {
                    output = unfence(content.text);
                    break;
                }
            }
        }
    }
    const exitCode = typeof rawOutput.exitCode === "number" ? rawOutput.exitCode : undefined;
    const status = typeof raw.status === "string" ? raw.status : undefined;
    return {
        terminalId: terminalIdForToolCall(toolCallId),
        toolCallId,
        command,
        cwd,
        output,
        exitCode,
        status
    };
}
function utf8ToBase64(text) {
    return Buffer.from(text, "utf8").toString("base64");
}
/**
 * Build a draft-v2 `terminal_update` for an execute tool call from DB-backed
 * command metadata. Output is a full replacement snapshot (not live PTY bytes);
 * mid-command streaming only appears if agy persists partial field-28 results.
 */
export function terminalUpdateForExecute(meta, options) {
    const update = {
        sessionUpdate: "terminal_update",
        terminalId: meta.terminalId
    };
    if (meta.command)
        update.command = meta.command;
    if (meta.cwd)
        update.cwd = meta.cwd;
    if (options?.includeOutput !== false && meta.output != null && meta.output.length > 0) {
        update.output = { data: utf8ToBase64(meta.output) };
    }
    if (options?.includeExitStatus !== false) {
        const finished = meta.status === "completed" ||
            meta.status === "failed" ||
            meta.status === "cancelled";
        if (finished) {
            const exitStatus = {};
            if (typeof meta.exitCode === "number")
                exitStatus.exitCode = meta.exitCode;
            if (meta.status === "cancelled" && meta.exitCode == null)
                exitStatus.signal = "SIGINT";
            update.exitStatus = exitStatus;
        }
        else if (typeof meta.exitCode === "number") {
            // Exit code without a terminal status still marks the process as exited.
            update.exitStatus = { exitCode: meta.exitCode };
        }
    }
    return update;
}
//# sourceMappingURL=index.js.map