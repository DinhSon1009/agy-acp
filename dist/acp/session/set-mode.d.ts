import type { AgentContext as V1AgentContext, SetSessionModeRequest, SetSessionModeResponse } from "@agentclientprotocol/sdk";
import type { SessionModeId } from "../../agy/cli.js";
import type { SessionState } from "./types.js";
export interface SetSessionModeDeps {
    requireSession(sessionId: string): SessionState;
    applyConfigOption(sessionId: string, configId: string, value: unknown): Promise<void>;
    notifyCurrentModeUpdate(client: V1AgentContext, sessionId: string, mode: SessionModeId): Promise<void>;
    notifyConfigOptionUpdateV1(client: V1AgentContext, sessionId: string, session: SessionState): Promise<void>;
}
export declare function handleSetSessionMode(params: SetSessionModeRequest, client: V1AgentContext | undefined, deps: SetSessionModeDeps): Promise<SetSessionModeResponse>;
