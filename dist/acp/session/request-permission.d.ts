import type { AgentContext as V1AgentContext, SessionUpdate as V1SessionUpdate } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext } from "@agentclientprotocol/sdk/experimental/v2";
import type { ClientToolCallNameCapability } from "../initialize.js";
import { type PermissionChoice } from "../tool-calls/permissions.js";
import { type ClientElicitationCapability } from "../tool-calls/elicitation.js";
/** v1 `session/request_permission` or `elicitation/create`: race request against turn cancellation. */
export declare function requestPermissionV1(client: V1AgentContext, sessionId: string, toolCall: V1SessionUpdate, toolName: string | undefined, signal: AbortSignal | undefined, questionIndex?: number, clientElicitation?: ClientElicitationCapability, clientToolCallName?: ClientToolCallNameCapability): Promise<PermissionChoice | "cancelled">;
/** v2 `session/request_permission` or `elicitation/create`: race request against turn cancellation. */
export declare function requestPermissionV2(client: V2AgentContext, sessionId: string, toolCall: V1SessionUpdate, toolName: string | undefined, signal: AbortSignal, questionIndex?: number, clientElicitation?: ClientElicitationCapability, clientToolCallName?: ClientToolCallNameCapability): Promise<PermissionChoice | "cancelled">;
