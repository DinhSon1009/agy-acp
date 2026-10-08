// ACP `auth/login` (v2): same keyring-login confirmation as v1 `authenticate`.
// Docs: https://agentclientprotocol.com/protocol/v1/authentication
import { handleAuthenticate } from "../authenticate.js";
export async function handleLoginAuth(params, backend, config, ensureAgyReady) {
    return handleAuthenticate({ methodId: params.methodId }, backend, config, ensureAgyReady);
}
//# sourceMappingURL=login.js.map