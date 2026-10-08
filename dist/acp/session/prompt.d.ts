import * as v1 from "@agentclientprotocol/sdk";
import type { AgentContext as V1AgentContext, PromptRequest as V1PromptRequest, PromptResponse as V1PromptResponse } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext, PromptRequest as V2PromptRequest, PromptResponse as V2PromptResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { ClientElicitationCapability } from "../tool-calls/elicitation.js";
import type { ClientToolCallNameCapability } from "../initialize.js";
import type { SessionModeId } from "../../agy/cli.js";
import type { ClientFileSystem } from "../../agy/edit/bridge.js";
import type { SessionState, TurnIntent } from "./types.js";
export interface PromptTurnDeps {
    requireSession(sessionId: string): SessionState;
    applyConfigOption(sessionId: string, configId: string, value: unknown): Promise<void>;
    persistSession(sessionId: string, session: SessionState): Promise<void>;
}
export interface PromptV1Deps extends PromptTurnDeps {
    notifyCurrentModeUpdate(client: V1AgentContext, sessionId: string, mode: SessionModeId): Promise<void>;
    notifyConfigOptionUpdateV1(client: V1AgentContext, sessionId: string, session: SessionState): Promise<void>;
    clientFileSystemV1(client: V1AgentContext, sessionId: string): ClientFileSystem | undefined;
    clientElicitationV1?(client: V1AgentContext): ClientElicitationCapability | undefined;
    clientToolCallNameV1?(client: V1AgentContext): ClientToolCallNameCapability | undefined;
}
export interface PromptV2Deps extends PromptTurnDeps {
    notifyConfigOptionUpdateV2(client: V2AgentContext, sessionId: string, session: SessionState): Promise<void>;
    clientElicitationV2?(client: V2AgentContext): ClientElicitationCapability | undefined;
    clientToolCallNameV2?(client: V2AgentContext): ClientToolCallNameCapability | undefined;
}
export type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
export interface TurnOutcome {
    stopReason: StopReason;
    usage?: v1.Usage;
}
export declare function parseTurnIntent(params: unknown): TurnIntent | undefined;
/** True when a turn is running or a steer has reserved the next turn. */
export declare function sessionTurnBusy(session: SessionState): boolean;
/**
 * Start the next queued prompt if the session is free. Safe to call from any
 * finalizer; it is a no-op while a turn or steer reservation owns the slot.
 */
export declare function notifyIdleAndDrainQueue(session: SessionState): void;
/**
 * Honor curated ACP slash commands that map onto session config (mode / model /
 * reasoningEffort). Returns true when the prompt was fully handled without
 * spawning agy. Unknown or non-slash prompts return false (pass through).
 */
export declare function applyCuratedSlashCommand(sessionId: string, promptText: string, notify: {
    modeChanged?: (mode: SessionModeId) => Promise<void>;
    configChanged: () => Promise<void>;
}, deps: PromptTurnDeps): Promise<boolean>;
/**
 * v1 `session/prompt`: response carries stopReason after the full turn.
 *
 * Zero prompt injection: only client `params.prompt` content is encoded and
 * forwarded to agy. No adapter-authored labels, instructions, or follow-ups.
 */
export declare function handlePromptV1(params: V1PromptRequest, client: V1AgentContext, signal: AbortSignal | undefined, deps: PromptV1Deps): Promise<V1PromptResponse>;
/**
 * v2 `session/prompt`: respond `{}` immediately on acceptance. Foreground
 * progress and stopReason arrive as `state_update` notifications.
 *
 * Zero prompt injection: only client `params.prompt` content is encoded and
 * forwarded to agy. No adapter-authored labels, instructions, or follow-ups.
 */
export declare function handlePromptV2(params: V2PromptRequest, client: V2AgentContext, deps: PromptV2Deps): Promise<V2PromptResponse>;
