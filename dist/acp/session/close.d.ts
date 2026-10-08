import type { CloseSessionRequest, CloseSessionResponse } from "@agentclientprotocol/sdk";
import type { SessionDeleteTarget } from "./delete.js";
export declare function handleCloseSession(params: CloseSessionRequest, activeSessions: Map<string, SessionDeleteTarget>): Promise<CloseSessionResponse>;
