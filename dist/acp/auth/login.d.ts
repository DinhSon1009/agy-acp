import type { LoginAuthRequest, LoginAuthResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { AgyCliBackend, AgyCliConfig } from "../../agy/cli.js";
export declare function handleLoginAuth(params: LoginAuthRequest, backend: AgyCliBackend, config: AgyCliConfig, ensureAgyReady: () => Promise<string | null>): Promise<LoginAuthResponse>;
