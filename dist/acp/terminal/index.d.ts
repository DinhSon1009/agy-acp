import type { SessionUpdate as V1SessionUpdate } from "@agentclientprotocol/sdk";
import type { SessionUpdate as V2SessionUpdate } from "@agentclientprotocol/sdk/experimental/v2";
/** Structural narrowing for JSON-shaped record values. */
export declare function asRecord(value: unknown): Record<string, unknown> | null;
/** Stable agent-owned terminal id for an execute tool call. */
export declare function terminalIdForToolCall(toolCallId: string): string;
export interface ExecuteTerminalMeta {
    terminalId: string;
    toolCallId: string;
    command?: string;
    cwd?: string;
    output?: string;
    exitCode?: number;
    status?: string;
}
/** Extract execute-tool terminal fields from a v1-shaped tool call update. */
export declare function executeTerminalMeta(update: V1SessionUpdate): ExecuteTerminalMeta | null;
/**
 * Build a draft-v2 `terminal_update` for an execute tool call from DB-backed
 * command metadata. Output is a full replacement snapshot (not live PTY bytes);
 * mid-command streaming only appears if agy persists partial field-28 results.
 */
export declare function terminalUpdateForExecute(meta: ExecuteTerminalMeta, options?: {
    includeOutput?: boolean;
    includeExitStatus?: boolean;
}): V2SessionUpdate;
