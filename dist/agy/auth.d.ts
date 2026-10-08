import { type ChildProcess } from "node:child_process";
import type { AuthMethod as V1AuthMethod } from "@agentclientprotocol/sdk";
import type { AuthMethod as V2AuthMethod } from "@agentclientprotocol/sdk/experimental/v2";
import { AgyCliBackend, type AgyCliConfig, type PtyFactory } from "./cli.js";
/** ACP method id for interactive terminal login (client runs agent binary with --login). */
export declare const AUTH_METHOD_TERMINAL_LOGIN = "agy-login";
export declare function v1AuthMethods(): V1AuthMethod[];
export declare function v2AuthMethods(): V2AuthMethod[];
export declare function isKnownAuthMethodId(methodId: string): boolean;
/**
 * User-facing text shown next to the Login method whenever auth is required.
 * Deliberately not agy's raw probe error (exit codes / "<no stderr>" are
 * meaningless to an end user); the real reason is still logged server-side by
 * callers for debugging.
 */
export declare const AUTH_REQUIRED_MESSAGE = "By continuing, you agree to https://antigravity.google/terms";
/**
 * True when `agy models` succeeds with at least one model.
 * Treats explicit "not logged in" errors as unauthenticated; other failures
 * also count as not ready for sessions (caller surfaces the message).
 */
export declare function isAgyAuthenticated(backend: AgyCliBackend, config: AgyCliConfig): Promise<{
    ok: true;
} | {
    ok: false;
    reason: string;
}>;
export declare function formatAuthProbeError(error: unknown): string;
export declare function looksUnauthenticated(reason: string): boolean;
/** Spawns the interactive login child process (default: real `agy`, inherited stdio). */
export type InteractiveLoginSpawn = (command: string, args: string[], options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
}) => ChildProcess;
/**
 * Interactive login for `agy-acp --login` (terminal auth method).
 * Runs `agy` with inherited stdio so the user can complete API key or web+code flow.
 *
 * A background poll probes `agy models` every few seconds; once it succeeds, the
 * child is terminated automatically so the caller doesn't need to manually exit
 * agy's own chat TUI to return control to the ACP client. If the child exits on
 * its own first (user quit, or login abandoned), its exit code is returned as-is.
 */
export declare function runInteractiveAgyLogin(options: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    argv?: string[];
    backend?: AgyCliBackend;
    spawnLogin?: InteractiveLoginSpawn;
    pollIntervalMs?: number;
    killGraceMs?: number;
}): Promise<number>;
/**
 * Best-effort logout: start interactive agy, wait for idle UI, send `/logout`, stop.
 * Tokens are stored in the OS keyring by agy; we do not scrape files ourselves.
 */
export declare function logoutAgyViaSlashCommand(options: {
    backend: AgyCliBackend;
    config: AgyCliConfig;
    ptyFactory?: PtyFactory;
}): Promise<void>;
