import type { SessionUpdate as V1SessionUpdate } from "@agentclientprotocol/sdk";
import type { SessionUpdate as V2SessionUpdate } from "@agentclientprotocol/sdk/experimental/v2";
import type { ClientToolCallNameCapability } from "../initialize.js";
export interface WireTransformOptions {
    clientToolCallName?: ClientToolCallNameCapability;
    allowToolCallName?: boolean;
}
/** Absolute-path friendly git_patch text for a single-file text change. */
export declare function gitPatchForFile(path: string, oldText: string | null | undefined, newText: string): string;
export type TerminalOutputTracker = Map<string, string>;
export type ToolCallContentTracker = Map<string, number>;
export declare function createTerminalOutputTracker(): TerminalOutputTracker;
export declare function createToolCallContentTracker(): ToolCallContentTracker;
export declare function resetTerminalOutputTracker(): void;
/** Identity cast for the v1 wire format (builders already emit v1 shapes). */
export declare function sessionUpdateToV1(update: V1SessionUpdate, tracker?: TerminalOutputTracker, options?: WireTransformOptions): V1SessionUpdate;
/**
 * Map a builder-emitted (v1-shaped) update onto a single draft ACP v2 update.
 * Prefer {@link expandSessionUpdateToV2} on the wire — execute tools also emit
 * a sibling `terminal_update`.
 */
export declare function sessionUpdateToV2(update: V1SessionUpdate, options?: WireTransformOptions): V2SessionUpdate;
/**
 * Expand one v1-shaped update into one or more v2 session updates.
 * Execute tools produce `terminal_update`, optional `terminal_output_chunk`,
 * and `tool_call_update` with a display-only `{ type: "terminal", terminalId }`
 * content block. Progressive tool call updates emit `tool_call_content_chunk`.
 */
export declare function expandSessionUpdateToV2(update: V1SessionUpdate, terminalTracker?: TerminalOutputTracker, toolContentTracker?: ToolCallContentTracker, options?: WireTransformOptions): V2SessionUpdate[];
