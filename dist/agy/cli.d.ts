import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { type ClientFileSystem } from "./edit/bridge.js";
import { type PermissionChoice } from "../acp/tool-calls/permissions.js";
import type { ClientElicitationCapability } from "../acp/tool-calls/elicitation.js";
export declare const DEFAULT_AGY_MODEL_LIST_TIMEOUT_MS = 15000;
export declare const DEFAULT_CONVERSATIONS_DIR: string;
export type SpawnedProcess = ChildProcessWithoutNullStreams;
export interface PtyProcess {
    write(data: string): void;
    kill(signal?: string): void;
    onData(listener: (data: string) => void): {
        dispose(): void;
    };
    onExit(listener: (event: {
        exitCode: number;
        signal?: number;
    }) => void): {
        dispose(): void;
    };
}
export interface PtyFactory {
    spawn(command: string, args: string[], options: {
        cwd: string;
        env?: NodeJS.ProcessEnv;
        cols: number;
        rows: number;
    }): PtyProcess;
}
export type PermissionCallback = (toolCall: SessionUpdate, context: {
    toolName: string;
    questionIndex?: number;
}) => Promise<PermissionChoice | "cancelled">;
export interface SpawnOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
}
export type SpawnFactory = (command: string, args: string[], options: SpawnOptions) => SpawnedProcess;
/** agy execution mode for `--mode` (omit flag when `default`). */
export type SessionModeId = "default" | "accept-edits" | "plan";
export declare const SESSION_MODE_IDS: readonly SessionModeId[];
export declare function isSessionModeId(value: string): value is SessionModeId;
export interface AgyCliConfig {
    cwd: string;
    /** ACP `additionalDirectories` (extra roots for `agy --add-dir`; excludes cwd). */
    additionalDirectories: string[];
    agyPath: string;
    /** Value for `--model` (base model slug or display name). */
    model?: string;
    /** Value for `--effort` (`low` | `medium` | `high`), when applicable. */
    effort?: string;
    /**
     * Agent execution mode for `agy --mode`.
     * `default` omits the flag (request-review / write confirmation).
     * `accept-edits` and `plan` pass `--mode <value>`.
     */
    mode: SessionModeId;
    project?: string;
    printTimeout: string;
    sandbox: boolean;
    skipPermissions: boolean;
    interactivePermissions: boolean;
    logFile?: string;
    promptInArgv: boolean;
    autoInstall: boolean;
    installBinDir?: string;
    modelList: string[];
    discoverModels: boolean;
    modelListTimeoutMs: number;
    /** Directory where agy writes its per-conversation SQLite databases. */
    conversationsDir: string;
    env?: NodeJS.ProcessEnv;
}
export interface PromptUsage {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    thoughtTokens?: number | null;
    cachedReadTokens?: number | null;
    cachedWriteTokens?: number | null;
}
export interface PromptOutcome {
    stopReason: "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
    usage?: PromptUsage;
}
export interface AgyCliConfigInput {
    cwd: string;
    additionalDirectories?: string[];
    env?: NodeJS.ProcessEnv;
    argv?: string[];
    /** Override the conversations directory (defaults to ~/.gemini/antigravity-cli/conversations). */
    conversationsDir?: string;
}
export declare class AgyCliError extends Error {
    readonly command: string[];
    readonly exitCode: number | null;
    readonly stderr: string;
    constructor(message: string, command: string[], exitCode: number | null, stderr: string);
}
export declare class AgyCliSession {
    #private;
    readonly config: AgyCliConfig;
    readonly spawnProcess: SpawnFactory;
    readonly ptyFactory?: PtyFactory;
    constructor(config: AgyCliConfig, spawnProcess?: SpawnFactory, ptyFactory?: PtyFactory);
    get wasCancelled(): boolean;
    /** The agy conversation id this session is bound to, once known (after the first prompt). */
    get conversationId(): string | null;
    /** Highest conversation-database step idx already delivered to the ACP client. */
    get lastStepIdx(): number;
    /** Type-14 user rows observed during the most recent prompt invocation. */
    get lastPromptUserStepIdxs(): readonly number[];
    /** Highest gen_metadata idx seen in this session. */
    get lastGenMetadataIdx(): number;
    /** Seed the conversation binding from persisted state (for session/load and session/resume). */
    restoreConversation(conversationId: string | null, lastStepIdx: number, lastGenMetadataIdx?: number): void;
    setModel(model: string | undefined): void;
    setEffort(effort: string | undefined): void;
    setMode(mode: SessionModeId): void;
    commandForPrompt(prompt: string): string[];
    interactiveCommandForPrompt(prompt: string): string[];
    /**
     * Run one prompt turn: spawn agy, poll its conversation database for newly
     * appended steps while the process runs, and invoke `onUpdate` with the
     * translated ACP updates in order. Resolves once the process exits and a few
     * trailing polls have drained any steps flushed right around exit.
     *
     * Invariant (zero prompt injection): `prompt` is only client-originated
     * content from ACP session/prompt. Never invent labels, instructions, or
     * follow-ups (e.g. "continue") — for background wakeups, keep the turn open
     * and poll instead. PTY writes during a turn are permission keys (or the same
     * user `prompt` when reusing an interactive TUI), never adapter prose.
     */
    prompt(prompt: string, onUpdate: (update: SessionUpdate) => Promise<void>, onPermission?: PermissionCallback, fsBridge?: ClientFileSystem, elicitationCap?: ClientElicitationCapability): Promise<PromptOutcome>;
    private runInteractivePrompt;
    private raceTurnCallback;
    /**
     * Record the on-disk content of the paths a reported edit covers, so
     * end-of-turn reconciliation only emits changes the client has *not* been
     * told about. Best effort: a snapshot we fail to refresh at worst re-reports
     * a change the client already has, which is preferable to failing the turn.
     * (See {@link ReportedContent} for how divergence is handled.)
     */
    private observeReported;
    /**
     * After a turn, diff the working tree against what the client has been told
     * (see {@link observeReportedEdit}) and reflect any change agy made that
     * never surfaced as a recognized structured edit (shell edits, unrecognized
     * payloads) through ACP: emit a synthetic edit update for every client, and
     * additionally hand the write to the client when it advertises fs
     * capabilities. Discovery failures are best-effort (logged); notification
     * failures propagate so the caller does not go idle after a dropped update.
     * Changes that can't be shown as a text diff (binary/oversized/deletions,
     * files whose pre-turn content was never captured) are reported, not
     * dropped (#76).
     */
    private reflectUnstructuredEdits;
    private runPromptCommand;
    private raceProcessError;
    private shouldInstallAfterError;
    private installAgy;
    private spawnOptions;
    private spawnEnv;
    private errorForSpawnFailure;
    cancel(): Promise<void>;
    private stopPty;
    private flushPermissionRender;
    private writePermissionKeys;
    close(): Promise<void>;
}
export declare class AgyCliBackend {
    readonly spawnProcess: SpawnFactory;
    readonly ptyFactory?: PtyFactory;
    constructor(spawnProcess?: SpawnFactory, ptyFactory?: PtyFactory);
    startSession(config: AgyCliConfig): Promise<AgyCliSession>;
    listModels(config: AgyCliConfig): Promise<string[]>;
}
export declare function configFromEnv(input: AgyCliConfigInput): AgyCliConfig;
export declare function defaultPtyFactory(): Promise<PtyFactory>;
export declare function parseAgyModels(output: string): string[];
