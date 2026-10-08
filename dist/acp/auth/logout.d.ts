import type { LogoutAuthRequest, LogoutAuthResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { AgyCliBackend, AgyCliConfig } from "../../agy/cli.js";
export declare function handleLogoutAuth(params: LogoutAuthRequest | undefined, backend: AgyCliBackend, config: AgyCliConfig, ensureAgyReady: () => Promise<string | null>): Promise<LogoutAuthResponse>;
