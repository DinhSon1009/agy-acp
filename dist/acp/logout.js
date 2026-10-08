// ACP `logout` (v1 root method): best-effort agy TUI `/logout`.
// Docs: https://agentclientprotocol.com/protocol/v1/authentication#logging-out
import { RequestError } from "@agentclientprotocol/sdk";
import { logoutAgyViaSlashCommand } from "../agy/auth.js";
export async function handleLogout(_params = {}, backend, config, ensureAgyReady) {
    await ensureAgyReady();
    try {
        await logoutAgyViaSlashCommand({
            backend,
            config,
            ptyFactory: backend.ptyFactory
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw RequestError.internalError(undefined, `agy logout failed: ${message}`);
    }
    return {};
}
//# sourceMappingURL=logout.js.map