// ACP session/delete logic: purge persisted session state and clean up active session resources.
// Docs: https://agentclientprotocol.com/protocol/v1/session-delete
import { cancelQueuedPrompts } from "./cancel.js";
import { turnsOf } from "./turn-scheduler.js";
/**
 * Handle `session/delete` for an active or persisted session:
 * 1. Aborts any active prompt in progress.
 * 2. Closes the agy backend process for this session.
 * 3. Removes the session binding from the SessionStore.
 */
export async function handleDeleteSession(params, activeSessions, store) {
    const session = activeSessions.get(params.sessionId);
    activeSessions.delete(params.sessionId);
    if (session) {
        session.closed = true;
        // Abort running turns and steer reservations before touching the backend.
        turnsOf(session).close();
        cancelQueuedPrompts(session);
    }
    await session?.agy.close();
    await store.delete(params.sessionId);
    return {};
}
//# sourceMappingURL=delete.js.map