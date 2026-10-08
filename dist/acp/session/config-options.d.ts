import type { SessionConfigOption as V1SessionConfigOption } from "@agentclientprotocol/sdk";
import type { SessionConfigOption as V2SessionConfigOption } from "@agentclientprotocol/sdk/experimental/v2";
import type { SessionState } from "./types.js";
export declare const MODEL_CONFIG_ID = "model";
export declare const REASONING_EFFORT_CONFIG_ID = "reasoningEffort";
export declare function readConfigValue(params: {
    value?: unknown;
    type?: string;
}): unknown;
export declare function sessionConfigOptionsV1(session: SessionState): V1SessionConfigOption[];
/** v2 renames config option `id` → `configId`. */
export declare function sessionConfigOptionsV2(session: SessionState): V2SessionConfigOption[];
/**
 * Apply a `mode` / `model` / `reasoningEffort` config option change to a live
 * session, then persist the updated binding.
 */
export declare function applyConfigOption(sessionId: string, configId: string, value: unknown, deps: {
    requireSession(sessionId: string): SessionState;
    persistSession(sessionId: string, session: SessionState): Promise<void>;
}): Promise<void>;
