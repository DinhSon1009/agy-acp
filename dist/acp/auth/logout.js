// ACP `auth/logout` (v2): same best-effort agy TUI `/logout` as v1 `logout`.
// Docs: https://agentclientprotocol.com/protocol/v1/authentication#logging-out
import { handleLogout } from "../logout.js";
export async function handleLogoutAuth(params = {}, backend, config, ensureAgyReady) {
    return handleLogout(params, backend, config, ensureAgyReady);
}
//# sourceMappingURL=logout.js.map