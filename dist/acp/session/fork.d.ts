import type { AgentContext as V1AgentContext, ForkSessionRequest as V1ForkSessionRequest, ForkSessionResponse as V1ForkSessionResponse } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext, ForkSessionRequest as V2ForkSessionRequest, ForkSessionResponse as V2ForkSessionResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { SessionState } from "./types.js";
export type { V1ForkSessionRequest, V1ForkSessionResponse, V2ForkSessionRequest, V2ForkSessionResponse };
export interface ForkSessionDeps {
    requireAuthenticated(cwd?: string): Promise<void>;
    forkSession(parentSessionId: string, cwd: string | undefined, additionalDirectories: string[] | undefined): Promise<{
        childSession: SessionState;
        cwd: string;
        childSessionId: string;
    }>;
}
export declare function handleForkSessionV1(params: V1ForkSessionRequest, client: V1AgentContext | undefined, deps: ForkSessionDeps & {
    notifyAvailableCommandsV1(client: V1AgentContext, sessionId: string): Promise<void>;
}): Promise<V1ForkSessionResponse>;
export declare function handleForkSessionV2(params: V2ForkSessionRequest, client: V2AgentContext | undefined, deps: ForkSessionDeps & {
    notifyAvailableCommandsV2(client: V2AgentContext, sessionId: string): Promise<void>;
}): Promise<V2ForkSessionResponse>;
