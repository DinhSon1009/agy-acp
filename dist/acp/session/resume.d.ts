import * as v1 from "@agentclientprotocol/sdk";
import type { AgentContext as V1AgentContext, ResumeSessionRequest as V1ResumeSessionRequest, ResumeSessionResponse as V1ResumeSessionResponse } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext, ResumeSessionRequest as V2ResumeSessionRequest, ResumeSessionResponse as V2ResumeSessionResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { ClientToolCallNameCapability } from "../initialize.js";
import type { StoredSession } from "./store.js";
import type { SessionState } from "./types.js";
export interface ResumeSessionDeps {
    requireAuthenticated(cwd?: string): Promise<void>;
    reloadSession(sessionId: string, cwd: string | undefined, additionalDirectories: string[] | undefined): Promise<{
        session: SessionState;
        cwd: string;
        stored: StoredSession;
    }>;
    replayConversation(session: SessionState, conversationId: string, cwd: string, emit: (update: v1.SessionUpdate) => Promise<void>, replayFrom?: unknown, v2UserMessageIdsByStep?: Record<string, string>): Promise<void>;
}
/** v1 `session/resume`: reattach without replaying history. */
export declare function handleResumeSessionV1(params: V1ResumeSessionRequest, client: V1AgentContext | undefined, deps: ResumeSessionDeps & {
    notifyAvailableCommandsV1(client: V1AgentContext, sessionId: string): Promise<void>;
}): Promise<V1ResumeSessionResponse>;
/**
 * v2 `session/resume`: optional `replayFrom` cursor replaces v1
 * `session/load`. Omitting `replayFrom` reattaches without history.
 */
export declare function handleResumeSessionV2(params: V2ResumeSessionRequest, client: V2AgentContext, deps: ResumeSessionDeps & {
    clientToolCallNameV2?(client: V2AgentContext): ClientToolCallNameCapability | undefined;
    notifyAvailableCommandsV2(client: V2AgentContext, sessionId: string): Promise<void>;
}): Promise<V2ResumeSessionResponse>;
