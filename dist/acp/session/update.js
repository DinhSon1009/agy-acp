// ACP session/update (notification): out-of-band updates for mode changes,
// config option changes, and available-commands advertisement. Distinct from
// update-wire.ts, which builds the wire shape for arbitrary agy-emitted
// updates — this file owns the actual `client.notify(session.update, ...)`
// call sites.
// Docs: https://agentclientprotocol.com/protocol/v1/prompt-turn#3-agent-reports-output
import * as v1 from "@agentclientprotocol/sdk";
import * as v2 from "@agentclientprotocol/sdk/experimental/v2";
import { availableCommandsUpdate } from "../slash-commands/index.js";
import { sessionConfigOptionsV1, sessionConfigOptionsV2 } from "./config-options.js";
import { sessionUpdateToV1, sessionUpdateToV2 } from "./update-wire.js";
export async function notifyCurrentModeUpdate(client, sessionId, mode) {
    await client.notify(v1.methods.client.session.update, {
        sessionId,
        update: {
            sessionUpdate: "current_mode_update",
            currentModeId: mode
        }
    });
}
export async function notifyConfigOptionUpdateV1(client, sessionId, session) {
    await client.notify(v1.methods.client.session.update, {
        sessionId,
        update: {
            sessionUpdate: "config_option_update",
            configOptions: sessionConfigOptionsV1(session)
        }
    });
}
export async function notifyConfigOptionUpdateV2(client, sessionId, session) {
    await client.notify(v2.methods.client.session.update, {
        sessionId,
        update: {
            sessionUpdate: "config_option_update",
            configOptions: sessionConfigOptionsV2(session)
        }
    });
}
export async function notifyAvailableCommandsV1(client, sessionId) {
    await client.notify(v1.methods.client.session.update, {
        sessionId,
        update: sessionUpdateToV1(availableCommandsUpdate())
    });
}
export async function notifyAvailableCommandsV2(client, sessionId) {
    await client.notify(v2.methods.client.session.update, {
        sessionId,
        update: sessionUpdateToV2(availableCommandsUpdate())
    });
}
//# sourceMappingURL=update.js.map