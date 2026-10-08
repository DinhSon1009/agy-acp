import type { DeleteSessionRequest, DeleteSessionResponse } from "@agentclientprotocol/sdk";
import type { SessionStore } from "./store.js";
import { type TurnScheduler } from "./turn-scheduler.js";
export interface SessionDeleteTarget {
    turns?: TurnScheduler;
    agy: {
        close(): Promise<void>;
    };
}
/**
 * Handle `session/delete` for an active or persisted session:
 * 1. Aborts any active prompt in progress.
 * 2. Closes the agy backend process for this session.
 * 3. Removes the session binding from the SessionStore.
 */
export declare function handleDeleteSession(params: DeleteSessionRequest, activeSessions: Map<string, SessionDeleteTarget>, store: SessionStore): Promise<DeleteSessionResponse>;
