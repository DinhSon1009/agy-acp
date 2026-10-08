// ACP session/fork: create a new session branching off an existing session's history and configuration.
// Docs: https://agentclientprotocol.com/rfds/session-fork
import { sessionConfigOptionsV1, sessionConfigOptionsV2 } from "./config-options.js";
import { sessionModeState } from "./modes.js";
import { deferAfterResponse } from "./new.js";
export async function handleForkSessionV1(params, client, deps) {
    await deps.requireAuthenticated(params.cwd);
    const { childSession, childSessionId } = await deps.forkSession(params.sessionId, params.cwd, params.additionalDirectories);
    if (client) {
        childSession.v1Client = client;
        deferAfterResponse(() => deps.notifyAvailableCommandsV1(client, childSessionId));
    }
    return {
        sessionId: childSessionId,
        modes: sessionModeState(childSession.agy.config.mode),
        configOptions: sessionConfigOptionsV1(childSession)
    };
}
export async function handleForkSessionV2(params, client, deps) {
    await deps.requireAuthenticated(params.cwd);
    const { childSession, childSessionId } = await deps.forkSession(params.sessionId, params.cwd, params.additionalDirectories);
    if (client) {
        childSession.v2Client = client;
        deferAfterResponse(() => deps.notifyAvailableCommandsV2(client, childSessionId));
    }
    return {
        sessionId: childSessionId,
        configOptions: sessionConfigOptionsV2(childSession)
    };
}
//# sourceMappingURL=fork.js.map