import * as v2 from "@agentclientprotocol/sdk/experimental/v2";
import type { AgentContext as V1AgentContext, AgentApp as V1AgentApp, AuthenticateRequest, AuthenticateResponse, CloseSessionRequest, CloseSessionResponse, DeleteSessionRequest, DeleteSessionResponse, InitializeRequest as V1InitializeRequest, InitializeResponse as V1InitializeResponse, LoadSessionRequest, LoadSessionResponse, LogoutRequest, LogoutResponse, NewSessionRequest as V1NewSessionRequest, NewSessionResponse as V1NewSessionResponse, PromptRequest as V1PromptRequest, PromptResponse as V1PromptResponse, ResumeSessionRequest as V1ResumeSessionRequest, ResumeSessionResponse as V1ResumeSessionResponse, SetSessionConfigOptionRequest as V1SetSessionConfigOptionRequest, SetSessionConfigOptionResponse as V1SetSessionConfigOptionResponse, SetSessionModeRequest, SetSessionModeResponse } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext, AgentApp as V2AgentApp, InitializeRequest as V2InitializeRequest, InitializeResponse as V2InitializeResponse, ListSessionsRequest, ListSessionsResponse, LoginAuthRequest, LoginAuthResponse, LogoutAuthRequest, LogoutAuthResponse, NewSessionRequest as V2NewSessionRequest, NewSessionResponse as V2NewSessionResponse, PromptRequest as V2PromptRequest, PromptResponse as V2PromptResponse, ResumeSessionRequest as V2ResumeSessionRequest, ResumeSessionResponse as V2ResumeSessionResponse, SetSessionConfigOptionRequest as V2SetSessionConfigOptionRequest, SetSessionConfigOptionResponse as V2SetSessionConfigOptionResponse } from "@agentclientprotocol/sdk/experimental/v2";
import { type PtyFactory, type SpawnFactory } from "../agy/cli.js";
import { type V1ForkSessionRequest, type V1ForkSessionResponse, type V2ForkSessionRequest, type V2ForkSessionResponse } from "./session/fork.js";
export interface AcpAgentOptions {
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
    env?: NodeJS.ProcessEnv;
    spawnProcess?: SpawnFactory;
    ptyFactory?: PtyFactory;
    argv?: string[];
    stateDir?: string;
    conversationsDir?: string;
    maxActiveSessions?: number;
    modelCacheEnabled?: boolean;
}
export declare class AcpAgent {
    #private;
    constructor(options?: AcpAgentOptions);
    initializeV1(params: V1InitializeRequest): Promise<V1InitializeResponse>;
    initializeV2(params: V2InitializeRequest): Promise<V2InitializeResponse>;
    private ensureAgyReady;
    /** Probe config for auth checks (cwd only; no workspace roots required). */
    private authProbeConfig;
    /**
     * Ensure agy is signed in. Throws ACP `auth_required` when not authenticated.
     */
    private requireAuthenticated;
    /**
     * v1 `authenticate` / v2 `auth/login`: confirm keyring login after terminal auth,
     * or succeed immediately when already signed in.
     */
    authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse>;
    loginAuth(params: LoginAuthRequest): Promise<LoginAuthResponse>;
    /** v1 `logout` / v2 `auth/logout`: best-effort agy TUI `/logout`. */
    logout(params?: LogoutRequest): Promise<LogoutResponse>;
    logoutAuth(params?: LogoutAuthRequest): Promise<LogoutAuthResponse>;
    /**
     * When the client advertises `fs.readTextFile` + `fs.writeTextFile`, route
     * already-applied edits through those methods so the client's own
     * diff/review UI (e.g. Zed's Review Changes panel) tracks them. Draft v2
     * has no fs/* client methods, so this is v1-only.
     */
    private clientFileSystemV1;
    private newSessionDeps;
    newSessionV1(params: V1NewSessionRequest, client?: V1AgentContext): Promise<V1NewSessionResponse>;
    newSessionV2(params: V2NewSessionRequest, client?: V2AgentContext): Promise<V2NewSessionResponse>;
    private forkSessionDeps;
    forkSessionV1(params: V1ForkSessionRequest, client?: V1AgentContext): Promise<V1ForkSessionResponse>;
    forkSessionV2(params: V2ForkSessionRequest, client?: V2AgentContext): Promise<V2ForkSessionResponse>;
    listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse>;
    private reloadSessionDeps;
    loadSession(params: LoadSessionRequest, client: V1AgentContext): Promise<LoadSessionResponse>;
    resumeSessionV1(params: V1ResumeSessionRequest, client?: V1AgentContext): Promise<V1ResumeSessionResponse>;
    resumeSessionV2(params: V2ResumeSessionRequest, client: V2AgentContext): Promise<V2ResumeSessionResponse>;
    setConfigOptionV1(params: V1SetSessionConfigOptionRequest, client?: V1AgentContext): Promise<V1SetSessionConfigOptionResponse>;
    setConfigOptionV2(params: V2SetSessionConfigOptionRequest): Promise<V2SetSessionConfigOptionResponse>;
    setSessionMode(params: SetSessionModeRequest, client: V1AgentContext): Promise<SetSessionModeResponse>;
    /**
     * Honor curated ACP slash commands that map onto session config (mode / model /
     * reasoningEffort). Returns true when the prompt was fully handled without
     * spawning agy. Unknown or non-slash prompts return false (pass through).
     */
    private promptV1Deps;
    private promptV2Deps;
    /**
     * v1 prompt lifecycle: response carries stopReason after the full turn.
     */
    promptV1(params: V1PromptRequest, client: V1AgentContext, signal?: AbortSignal): Promise<V1PromptResponse>;
    /**
     * v2 prompt lifecycle: respond `{}` immediately on acceptance. Foreground
     * progress and stopReason arrive as `state_update` notifications.
     */
    promptV2(params: V2PromptRequest, client: V2AgentContext): Promise<V2PromptResponse>;
    cancel(params: {
        sessionId: string;
        _meta?: Record<string, unknown> | null;
    }): Promise<void>;
    closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse>;
    deleteSession(params: DeleteSessionRequest): Promise<DeleteSessionResponse>;
    private createSession;
    private applyConfigOption;
    private replayConversation;
    private requireSession;
    private registerSession;
    private sessionBuildDeps;
    private modelOptionsForConfig;
    private loadModelCache;
    private cacheModelOptions;
    private refreshModelOptions;
    private buildSession;
    /** Shared reconstruction for `session/load` and `session/resume`: restore a
     *  persisted session binding and re-register it in memory. */
    private reloadSession;
    private forkSession;
    private reconcileSessionCatalog;
    private persistSession;
}
/** ACP v1 agent app (stable protocol). */
export declare function createAcpApp(options?: AcpAgentOptions | AcpAgent): V1AgentApp;
/**
 * Experimental draft ACP v2 agent app.
 * Prefer {@link createDualAcpApp} / {@link runAcp} so v1 clients still work.
 */
export declare function createAcpV2App(options?: AcpAgentOptions | AcpAgent): V2AgentApp;
/**
 * Dual-version agent connector: negotiates ACP v1 or experimental draft v2 from
 * the client's `initialize.protocolVersion`.
 */
export declare function createDualAcpApp(options?: AcpAgentOptions | AcpAgent): v2.AgentProtocolRouter;
export declare function runAcp(options?: AcpAgentOptions): v2.AgentConnectionLifecycle;
export { contentBlocksToPrompt, contentBlocksToText } from "./content/index.js";
export { buildModelCatalog, modelConfigOption, reasoningEffortConfigOption, toModelSlug, prettifyModelSlug } from "../agy/model/catalog.js";
export { sessionModeState, modeConfigOption } from "./session/modes.js";
