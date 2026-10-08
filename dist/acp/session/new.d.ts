import type { AgentContext as V1AgentContext, NewSessionRequest as V1NewSessionRequest, NewSessionResponse as V1NewSessionResponse } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext, NewSessionRequest as V2NewSessionRequest, NewSessionResponse as V2NewSessionResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { SessionState } from "./types.js";
/**
 * Runs `fn` after the current request handler's response has gone out on the
 * wire. The ACP connection queues outbound messages in call order, so a
 * `setImmediate` — which only fires once the microtask queue (including the
 * response's own send) has drained — is enough to guarantee it lands second.
 */
export declare function deferAfterResponse(fn: () => Promise<void>): void;
export interface NewSessionDeps {
    requireAuthenticated(cwd?: string): Promise<void>;
    createSession(cwd: string | undefined, additionalDirectories: string[] | undefined): Promise<SessionState>;
}
export declare function handleNewSessionV1(params: V1NewSessionRequest, client: V1AgentContext | undefined, deps: NewSessionDeps & {
    notifyAvailableCommandsV1(client: V1AgentContext, sessionId: string): Promise<void>;
}): Promise<V1NewSessionResponse>;
export declare function handleNewSessionV2(params: V2NewSessionRequest, client: V2AgentContext | undefined, deps: NewSessionDeps & {
    notifyAvailableCommandsV2(client: V2AgentContext, sessionId: string): Promise<void>;
}): Promise<V2NewSessionResponse>;
