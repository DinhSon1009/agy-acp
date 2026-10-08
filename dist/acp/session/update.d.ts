import type { AgentContext as V1AgentContext } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext } from "@agentclientprotocol/sdk/experimental/v2";
import type { SessionModeId } from "../../agy/cli.js";
import type { SessionState } from "./types.js";
export declare function notifyCurrentModeUpdate(client: V1AgentContext, sessionId: string, mode: SessionModeId): Promise<void>;
export declare function notifyConfigOptionUpdateV1(client: V1AgentContext, sessionId: string, session: SessionState): Promise<void>;
export declare function notifyConfigOptionUpdateV2(client: V2AgentContext, sessionId: string, session: SessionState): Promise<void>;
export declare function notifyAvailableCommandsV1(client: V1AgentContext, sessionId: string): Promise<void>;
export declare function notifyAvailableCommandsV2(client: V2AgentContext, sessionId: string): Promise<void>;
