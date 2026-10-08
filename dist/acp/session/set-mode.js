// ACP session/set_mode: mirrors the `mode` config option onto agy `--mode`.
// Pushes both `current_mode_update` (legacy modes clients) and
// `config_option_update` (configOptions clients) so both stay aligned during
// the ACP transition period. See: https://agentclientprotocol.com/protocol/v1/session-config-options#relationship-to-session-modes
// Docs: https://agentclientprotocol.com/protocol/v1/session-modes#setting-the-current-mode
import { MODE_CONFIG_ID } from "./modes.js";
export async function handleSetSessionMode(params, client, deps) {
    const previousMode = deps.requireSession(params.sessionId).agy.config.mode;
    await deps.applyConfigOption(params.sessionId, MODE_CONFIG_ID, params.modeId);
    const session = deps.requireSession(params.sessionId);
    const mode = session.agy.config.mode;
    if (client && mode !== previousMode) {
        // ACP transition: send both legacy current_mode_update (modes-API clients)
        // and config_option_update (configOptions clients) to stay in sync.
        await deps.notifyCurrentModeUpdate(client, params.sessionId, mode);
        await deps.notifyConfigOptionUpdateV1(client, params.sessionId, session);
    }
    return {};
}
//# sourceMappingURL=set-mode.js.map