// ACP session/resume: reattach to a session without replaying history (v1), or
// optionally replay from the start (v2 `replayFrom: { type: "start" }`, which
// replaces v1 `session/load`).
// Docs: https://agentclientprotocol.com/protocol/v1/session-setup
import * as v2 from "@agentclientprotocol/sdk/experimental/v2";
import { sessionConfigOptionsV1, sessionConfigOptionsV2 } from "./config-options.js";
import { sessionModeState } from "./modes.js";
import { createTerminalOutputTracker, createToolCallContentTracker, expandSessionUpdateToV2 } from "./update-wire.js";
/** v1 `session/resume`: reattach without replaying history. */
export async function handleResumeSessionV1(params, client, deps) {
    await deps.requireAuthenticated(params.cwd);
    const { session } = await deps.reloadSession(params.sessionId, params.cwd, params.additionalDirectories);
    if (client) {
        session.v1Client = client;
        await deps.notifyAvailableCommandsV1(client, params.sessionId);
    }
    return {
        modes: sessionModeState(session.agy.config.mode),
        configOptions: sessionConfigOptionsV1(session)
    };
}
/**
 * v2 `session/resume`: optional `replayFrom` cursor replaces v1
 * `session/load`. Omitting `replayFrom` reattaches without history.
 */
export async function handleResumeSessionV2(params, client, deps) {
    await deps.requireAuthenticated(params.cwd);
    const { session, cwd, stored } = await deps.reloadSession(params.sessionId, params.cwd, params.additionalDirectories);
    session.v2Client = client;
    const replayFrom = params.replayFrom ?? null;
    if (replayFrom != null) {
        if (stored.conversationId) {
            const terminalTracker = createTerminalOutputTracker();
            const toolContentTracker = createToolCallContentTracker();
            const clientToolCallName = deps.clientToolCallNameV2?.(client);
            await deps.replayConversation(session, stored.conversationId, cwd, async (update) => {
                for (const v2Update of expandSessionUpdateToV2(update, terminalTracker, toolContentTracker, { clientToolCallName })) {
                    await client.notify(v2.methods.client.session.update, {
                        sessionId: params.sessionId,
                        update: v2Update
                    });
                }
            }, replayFrom, session.v2UserMessageIdsByStep);
        }
    }
    await deps.notifyAvailableCommandsV2(client, params.sessionId);
    return { configOptions: sessionConfigOptionsV2(session) };
}
//# sourceMappingURL=resume.js.map