import type { AuthenticateRequest, AuthenticateResponse } from "@agentclientprotocol/sdk";
import type { AgyCliBackend, AgyCliConfig } from "../agy/cli.js";
export declare function handleAuthenticate(params: AuthenticateRequest, backend: AgyCliBackend, config: AgyCliConfig, ensureAgyReady: () => Promise<string | null>): Promise<AuthenticateResponse>;
