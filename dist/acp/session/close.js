// ACP session/close handler: close active session and terminate background process.
// Docs: https://agentclientprotocol.com/rfds/session-close
import { cancelQueuedPrompts } from "./cancel.js";
import { turnsOf } from "./turn-scheduler.js";
export async function handleCloseSession(params, activeSessions) {
    const session = activeSessions.get(params.sessionId);
    activeSessions.delete(params.sessionId);
    if (session) {
        session.closed = true;
        // Abort running turns and steer reservations before touching the backend,
        // so a stalled client transport cannot delay teardown.
        turnsOf(session).close();
        cancelQueuedPrompts(session);
        await session.agy.close();
    }
    return {};
}
//# sourceMappingURL=close.js.map