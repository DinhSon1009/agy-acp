import type { InitializeRequest as V1InitializeRequest, InitializeResponse as V1InitializeResponse } from "@agentclientprotocol/sdk";
import type { InitializeRequest as V2InitializeRequest, InitializeResponse as V2InitializeResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { ClientElicitationCapability } from "./tool-calls/elicitation.js";
export type { ClientElicitationCapability };
export interface ClientFsCapability {
    readTextFile: boolean;
    writeTextFile: boolean;
}
export interface ClientToolCallNameCapability {
    name: boolean;
}
export declare function parseClientToolCallName(rawCaps: unknown, defaultEnabled?: boolean): ClientToolCallNameCapability;
/** v1 `initialize`: also returns the client's advertised `fs`, `elicitation`, and `toolCallName` capabilities. */
export declare function handleInitializeV1(params: V1InitializeRequest, agentVersion: string): {
    response: V1InitializeResponse;
    clientFs: ClientFsCapability;
    clientElicitation: ClientElicitationCapability;
    clientToolCallName: ClientToolCallNameCapability;
};
export declare function handleInitializeV2(params: V2InitializeRequest, agentVersion: string): {
    response: V2InitializeResponse;
    clientElicitation: ClientElicitationCapability;
    clientToolCallName: ClientToolCallNameCapability;
};
