import type { LogoutRequest, LogoutResponse } from "@agentclientprotocol/sdk";
import type { AgyCliBackend, AgyCliConfig } from "../agy/cli.js";
export declare function handleLogout(_params: LogoutRequest | undefined, backend: AgyCliBackend, config: AgyCliConfig, ensureAgyReady: () => Promise<string | null>): Promise<LogoutResponse>;
