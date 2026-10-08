import type { AgentContext as V1AgentContext, SetSessionConfigOptionRequest as V1SetSessionConfigOptionRequest, SetSessionConfigOptionResponse as V1SetSessionConfigOptionResponse } from "@agentclientprotocol/sdk";
import type { SetSessionConfigOptionRequest as V2SetSessionConfigOptionRequest, SetSessionConfigOptionResponse as V2SetSessionConfigOptionResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { SessionModeId } from "../../agy/cli.js";
import type { SessionState } from "./types.js";
export interface SetConfigOptionDeps {
    requireSession(sessionId: string): SessionState;
    applyConfigOption(sessionId: string, configId: string, value: unknown): Promise<void>;
}
export declare function handleSetConfigOptionV1(params: V1SetSessionConfigOptionRequest, client: V1AgentContext | undefined, deps: SetConfigOptionDeps & {
    notifyCurrentModeUpdate(client: V1AgentContext, sessionId: string, mode: SessionModeId): Promise<void>;
    notifyConfigOptionUpdateV1(client: V1AgentContext, sessionId: string, session: SessionState): Promise<void>;
}): Promise<V1SetSessionConfigOptionResponse>;
export declare function handleSetConfigOptionV2(params: V2SetSessionConfigOptionRequest, deps: SetConfigOptionDeps): Promise<V2SetSessionConfigOptionResponse>;
