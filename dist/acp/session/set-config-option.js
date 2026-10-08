// ACP session/set_config_option: apply a mode/model/reasoningEffort config
// option change and return the updated option list.
// Docs: https://agentclientprotocol.com/protocol/v1/session-modes
import { readConfigValue, sessionConfigOptionsV1, sessionConfigOptionsV2 } from "./config-options.js";
import { MODE_CONFIG_ID } from "./modes.js";
export async function handleSetConfigOptionV1(params, client, deps) {
    const configId = params.configId;
    const previousMode = deps.requireSession(params.sessionId).agy.config.mode;
    await deps.applyConfigOption(params.sessionId, configId, readConfigValue(params));
    const session = deps.requireSession(params.sessionId);
    // ACP transition: when mode changes via config option, send both the legacy
    // current_mode_update (modes-API clients) and an out-of-band config_option_update
    // (configOptions clients). The response already carries the full option list, but
    // clients that only watch notifications need the out-of-band push too.
    if (client && configId === MODE_CONFIG_ID && session.agy.config.mode !== previousMode) {
        await deps.notifyCurrentModeUpdate(client, params.sessionId, session.agy.config.mode);
        await deps.notifyConfigOptionUpdateV1(client, params.sessionId, session);
    }
    return { configOptions: sessionConfigOptionsV1(session) };
}
export async function handleSetConfigOptionV2(params, deps) {
    await deps.applyConfigOption(params.sessionId, params.configId, readConfigValue(params));
    // Draft v2 has no set_mode; the response carries the full option list.
    // Out-of-band `config_option_update` is emitted on the v1 set_mode path (outside
    // this RPC) so config UIs stay aligned with native modes.
    return { configOptions: sessionConfigOptionsV2(deps.requireSession(params.sessionId)) };
}
//# sourceMappingURL=set-config-option.js.map