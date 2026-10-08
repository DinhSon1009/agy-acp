// ACP session/load: reconstruct a previously persisted session and replay its
// agy conversation history (if bound to one) before returning.
// Docs: https://agentclientprotocol.com/protocol/v1/session-setup#loading-sessions
import * as v1 from "@agentclientprotocol/sdk";
import { sessionConfigOptionsV1 } from "./config-options.js";
import { sessionModeState } from "./modes.js";
import { createTerminalOutputTracker, sessionUpdateToV1 } from "./update-wire.js";
export async function handleLoadSession(params, client, deps) {
    await deps.requireAuthenticated(params.cwd);
    const { session, cwd, stored } = await deps.reloadSession(params.sessionId, params.cwd, params.additionalDirectories);
    session.v1Client = client;
    if (stored.conversationId) {
        const tracker = createTerminalOutputTracker();
        const clientToolCallName = deps.clientToolCallNameV1?.(client) ?? { name: false };
        await deps.replayConversation(session, stored.conversationId, cwd, async (update) => {
            await client.notify(v1.methods.client.session.update, {
                sessionId: params.sessionId,
                update: sessionUpdateToV1(update, tracker, { clientToolCallName })
            });
        });
    }
    await deps.notifyAvailableCommandsV1(client, params.sessionId);
    return {
        modes: sessionModeState(session.agy.config.mode),
        configOptions: sessionConfigOptionsV1(session)
    };
}
//# sourceMappingURL=load.js.map