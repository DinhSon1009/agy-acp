import * as v1 from "@agentclientprotocol/sdk";
import type { AgentContext as V1AgentContext, LoadSessionRequest, LoadSessionResponse } from "@agentclientprotocol/sdk";
import type { ClientToolCallNameCapability } from "../initialize.js";
import type { StoredSession } from "./store.js";
import type { SessionState } from "./types.js";
export interface LoadSessionDeps {
    requireAuthenticated(cwd?: string): Promise<void>;
    reloadSession(sessionId: string, cwd: string | undefined, additionalDirectories: string[] | undefined): Promise<{
        session: SessionState;
        cwd: string;
        stored: StoredSession;
    }>;
    replayConversation(session: SessionState, conversationId: string, cwd: string, emit: (update: v1.SessionUpdate) => Promise<void>): Promise<void>;
    clientToolCallNameV1?(client: V1AgentContext): ClientToolCallNameCapability | undefined;
    notifyAvailableCommandsV1(client: V1AgentContext, sessionId: string): Promise<void>;
}
export declare function handleLoadSession(params: LoadSessionRequest, client: V1AgentContext, deps: LoadSessionDeps): Promise<LoadSessionResponse>;
