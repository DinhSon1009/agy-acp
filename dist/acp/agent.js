// ACP Agent: wires the dual v1 / draft-v2 RPC surface to section handlers.
// Handlers live under files/folders named after their exact ACP method path:
// root methods (authenticate.ts, logout.ts, initialize.ts) live directly
// under acp/; namespaced methods live under folders matching that namespace
// (auth/, session/, fs/, terminal/) — e.g. session/prompt.ts + session/
// cancel.ts implement session/prompt + session/cancel even though the ACP
// docs describe both under the single "prompt-turn" topic page. Folders that
// don't map to a single namespace hold logic spanning multiple doc topics
// instead (content/, slash-commands/, tool-calls/, agent-plan/). Non-ACP
// helper logic (agy CLI backend, conversation DB, model catalog resolution,
// local edit apply/revert) lives under agy/ rather than here, even where it
// builds ACP-shaped objects or consumes ACP types (e.g. agy/auth.ts,
// agy/model/catalog.ts, agy/edit/bridge.ts, agy/edit/revert.ts). This file
// owns instance state (active sessions, model cache) and wires it into those
// handlers.
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { Readable, Writable } from "node:stream";
import * as v1 from "@agentclientprotocol/sdk";
import * as v2 from "@agentclientprotocol/sdk/experimental/v2";
import { RequestError } from "@agentclientprotocol/sdk";
import { ReplayCache } from "../agy/db/replay.js";
import { readTextFile } from "./fs/read-text-file.js";
import { writeTextFile } from "./fs/write-text-file.js";
import { ensureAgyInstalled } from "../agy/installer.js";
import { AUTH_REQUIRED_MESSAGE, isAgyAuthenticated, v1AuthMethods } from "../agy/auth.js";
import { AgyCliBackend, configFromEnv } from "../agy/cli.js";
import { handleInitializeV1, handleInitializeV2 } from "./initialize.js";
import { defaultStateDir, SessionStore } from "./session/store.js";
import { handleCloseSession } from "./session/close.js";
import { handleDeleteSession } from "./session/delete.js";
import { handleListSessions } from "./session/list.js";
import { handleAuthenticate } from "./authenticate.js";
import { handleLogout } from "./logout.js";
import { handleLoginAuth } from "./auth/login.js";
import { handleLogoutAuth } from "./auth/logout.js";
import { buildModelCatalog } from "../agy/model/catalog.js";
import { applyModelSelection, restoredModelSelection } from "../agy/model/selection.js";
import { applyConfigOption as applyConfigOptionHandler } from "./session/config-options.js";
import { handleSetConfigOptionV1, handleSetConfigOptionV2 } from "./session/set-config-option.js";
import { buildSession, createSession, forkSession, registerSession, reloadSession, replayConversation, persistSession, KeyedAsyncLock } from "./session/setup.js";
import { deferAfterResponse, handleNewSessionV1, handleNewSessionV2 } from "./session/new.js";
import { handleForkSessionV1, handleForkSessionV2 } from "./session/fork.js";
import { handleLoadSession } from "./session/load.js";
import { handleResumeSessionV1, handleResumeSessionV2 } from "./session/resume.js";
import { handleSetSessionMode } from "./session/set-mode.js";
import { notifyAvailableCommandsV1, notifyAvailableCommandsV2, notifyConfigOptionUpdateV1, notifyConfigOptionUpdateV2, notifyCurrentModeUpdate } from "./session/update.js";
import { handlePromptV1, handlePromptV2 } from "./session/prompt.js";
import { handleCancel } from "./session/cancel.js";
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
/** Conversation replays cached per conversation id before LRU eviction. */
const REPLAY_CACHE_CAPACITY = 32;
const MODEL_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_ACTIVE_SESSIONS = 64;
const inFlightModelRefreshes = new Map();
const modelCacheWrites = new Map();
function persistModelCache(cacheFile, entries) {
    const previousWrite = modelCacheWrites.get(cacheFile) ?? Promise.resolve();
    const nextWrite = previousWrite
        .then(async () => {
        let existingEntries = {};
        try {
            const parsed = JSON.parse(await fs.promises.readFile(cacheFile, "utf-8"));
            if (parsed.entries && typeof parsed.entries === "object") {
                existingEntries = parsed.entries;
            }
        }
        catch {
            // Missing or malformed caches will be overwritten.
        }
        const mergedEntries = { ...existingEntries };
        for (const [key, entry] of Object.entries(entries)) {
            const existing = mergedEntries[key];
            if (!existing ||
                !Number.isFinite(existing.updatedAt) ||
                (Number.isFinite(entry.updatedAt) && entry.updatedAt >= existing.updatedAt)) {
                mergedEntries[key] = entry;
            }
        }
        await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true });
        const tmp = `${cacheFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify({ entries: mergedEntries }, null, 2));
        await fs.promises.rename(tmp, cacheFile);
    })
        .catch((error) => {
        console.error(`[agy-acp] WARN: failed to persist model cache: ${error.message}`);
    })
        .finally(() => {
        if (modelCacheWrites.get(cacheFile) === nextWrite) {
            modelCacheWrites.delete(cacheFile);
        }
    });
    modelCacheWrites.set(cacheFile, nextWrite);
    return nextWrite;
}
export class AcpAgent {
    #env;
    #argv;
    #backend;
    #sessions = new Map();
    #setupLocks = new KeyedAsyncLock();
    #store;
    #replayCache = new ReplayCache(REPLAY_CACHE_CAPACITY);
    #modelCacheFile;
    #modelCacheEnabled;
    #modelOptionsCache = new Map();
    #modelRefreshes = new Map();
    #maxActiveSessions;
    #conversationsDir;
    #modelCacheWrite = Promise.resolve();
    #ensureAgyPromise;
    /** v1 client's `fs` capability, set from `initialize`. Draft v2 has no fs/* client methods. */
    #clientFs = { readTextFile: false, writeTextFile: false };
    #clientElicitation = { form: false, url: false };
    #clientToolCallName = { name: false };
    constructor(options = {}) {
        this.#env = options.env ?? process.env;
        this.#argv = options.argv ?? [];
        this.#backend = new AgyCliBackend(options.spawnProcess, options.ptyFactory);
        const stateDir = options.stateDir ?? defaultStateDir();
        this.#store = new SessionStore(stateDir);
        this.#modelCacheFile = path.join(stateDir, "models.json");
        this.#modelCacheEnabled = options.modelCacheEnabled ?? (this.#env.NODE_ENV !== "test");
        this.#maxActiveSessions =
            options.maxActiveSessions !== undefined &&
                Number.isInteger(options.maxActiveSessions) &&
                options.maxActiveSessions > 0
                ? options.maxActiveSessions
                : DEFAULT_MAX_ACTIVE_SESSIONS;
        this.#conversationsDir = options.conversationsDir;
        this.loadModelCache();
        if (this.#modelCacheEnabled) {
            const config = this.authProbeConfig();
            const key = config.agyPath;
            const cached = this.#modelOptionsCache.get(key);
            if (!cached || Date.now() - cached.updatedAt >= MODEL_CACHE_TTL_MS) {
                this.refreshModelOptions(config);
            }
        }
    }
    async initializeV1(params) {
        await this.ensureAgyReady();
        if (this.#modelCacheEnabled) {
            const config = this.authProbeConfig();
            const key = config.agyPath;
            const cached = this.#modelOptionsCache.get(key);
            if (!cached || Date.now() - cached.updatedAt >= MODEL_CACHE_TTL_MS) {
                this.refreshModelOptions(config);
            }
        }
        const { response, clientFs, clientElicitation, clientToolCallName } = handleInitializeV1(params, packageJson.version ?? "0.0.0");
        this.#clientFs = clientFs;
        this.#clientElicitation = clientElicitation;
        this.#clientToolCallName = clientToolCallName;
        return response;
    }
    async initializeV2(params) {
        await this.ensureAgyReady();
        if (this.#modelCacheEnabled) {
            const config = this.authProbeConfig();
            const key = config.agyPath;
            const cached = this.#modelOptionsCache.get(key);
            if (!cached || Date.now() - cached.updatedAt >= MODEL_CACHE_TTL_MS) {
                this.refreshModelOptions(config);
            }
        }
        const { response, clientElicitation, clientToolCallName } = handleInitializeV2(params, packageJson.version ?? "0.0.0");
        this.#clientElicitation = clientElicitation;
        this.#clientToolCallName = clientToolCallName;
        return response;
    }
    ensureAgyReady() {
        this.#ensureAgyPromise ??= ensureAgyInstalled({
            env: this.#env,
            warn: (message) => console.error(message)
        });
        return this.#ensureAgyPromise;
    }
    /** Probe config for auth checks (cwd only; no workspace roots required). */
    authProbeConfig(cwd = process.cwd()) {
        return configFromEnv({
            cwd,
            env: this.#env,
            argv: this.#argv,
            conversationsDir: this.#conversationsDir
        });
    }
    /**
     * Ensure agy is signed in. Throws ACP `auth_required` when not authenticated.
     */
    async requireAuthenticated(cwd) {
        await this.ensureAgyReady();
        const status = await isAgyAuthenticated(this.#backend, this.authProbeConfig(cwd));
        if (status.ok)
            return;
        console.error(`[agy-acp] auth required: ${status.reason}`);
        throw RequestError.authRequired({ authMethods: v1AuthMethods() }, AUTH_REQUIRED_MESSAGE);
    }
    /**
     * v1 `authenticate` / v2 `auth/login`: confirm keyring login after terminal auth,
     * or succeed immediately when already signed in.
     */
    async authenticate(params) {
        return handleAuthenticate(params, this.#backend, this.authProbeConfig(), () => this.ensureAgyReady());
    }
    async loginAuth(params) {
        return handleLoginAuth(params, this.#backend, this.authProbeConfig(), () => this.ensureAgyReady());
    }
    /** v1 `logout` / v2 `auth/logout`: best-effort agy TUI `/logout`. */
    async logout(params = {}) {
        return handleLogout(params, this.#backend, this.authProbeConfig(), () => this.ensureAgyReady());
    }
    async logoutAuth(params = {}) {
        return handleLogoutAuth(params, this.#backend, this.authProbeConfig(), () => this.ensureAgyReady());
    }
    /**
     * When the client advertises `fs.readTextFile` + `fs.writeTextFile`, route
     * already-applied edits through those methods so the client's own
     * diff/review UI (e.g. Zed's Review Changes panel) tracks them. Draft v2
     * has no fs/* client methods, so this is v1-only.
     */
    clientFileSystemV1(client, sessionId) {
        if (!this.#clientFs.readTextFile || !this.#clientFs.writeTextFile)
            return undefined;
        return {
            readTextFile: (path) => readTextFile(client, sessionId, path),
            writeTextFile: (path, content) => writeTextFile(client, sessionId, path, content)
        };
    }
    newSessionDeps() {
        return {
            requireAuthenticated: (cwd) => this.requireAuthenticated(cwd),
            createSession: (cwd, dirs) => this.createSession(cwd, dirs)
        };
    }
    newSessionV1(params, client) {
        return handleNewSessionV1(params, client, {
            ...this.newSessionDeps(),
            notifyAvailableCommandsV1
        });
    }
    newSessionV2(params, client) {
        return handleNewSessionV2(params, client, {
            ...this.newSessionDeps(),
            notifyAvailableCommandsV2
        });
    }
    forkSessionDeps() {
        return {
            requireAuthenticated: (cwd) => this.requireAuthenticated(cwd),
            forkSession: (parentSessionId, cwd, dirs) => this.forkSession(parentSessionId, cwd, dirs)
        };
    }
    forkSessionV1(params, client) {
        return handleForkSessionV1(params, client, {
            ...this.forkSessionDeps(),
            notifyAvailableCommandsV1
        });
    }
    forkSessionV2(params, client) {
        return handleForkSessionV2(params, client, {
            ...this.forkSessionDeps(),
            notifyAvailableCommandsV2
        });
    }
    async listSessions(params = {}) {
        return handleListSessions(params, this.#store);
    }
    reloadSessionDeps() {
        return {
            requireAuthenticated: (cwd) => this.requireAuthenticated(cwd),
            reloadSession: (sessionId, cwd, dirs) => this.reloadSession(sessionId, cwd, dirs),
            replayConversation: (session, conversationId, cwd, emit, replayFrom, v2UserMessageIdsByStep) => this.replayConversation(session, conversationId, cwd, emit, replayFrom, v2UserMessageIdsByStep)
        };
    }
    loadSession(params, client) {
        return handleLoadSession(params, client, {
            ...this.reloadSessionDeps(),
            clientToolCallNameV1: () => this.#clientToolCallName,
            notifyAvailableCommandsV1
        });
    }
    resumeSessionV1(params, client) {
        return handleResumeSessionV1(params, client, {
            ...this.reloadSessionDeps(),
            notifyAvailableCommandsV1
        });
    }
    resumeSessionV2(params, client) {
        return handleResumeSessionV2(params, client, {
            ...this.reloadSessionDeps(),
            clientToolCallNameV2: () => this.#clientToolCallName,
            notifyAvailableCommandsV2
        });
    }
    setConfigOptionV1(params, client) {
        return handleSetConfigOptionV1(params, client, {
            requireSession: (id) => this.requireSession(id),
            applyConfigOption: (sessionId, configId, value) => this.applyConfigOption(sessionId, configId, value),
            notifyCurrentModeUpdate,
            notifyConfigOptionUpdateV1
        });
    }
    setConfigOptionV2(params) {
        return handleSetConfigOptionV2(params, {
            requireSession: (id) => this.requireSession(id),
            applyConfigOption: (sessionId, configId, value) => this.applyConfigOption(sessionId, configId, value)
        });
    }
    setSessionMode(params, client) {
        return handleSetSessionMode(params, client, {
            requireSession: (id) => this.requireSession(id),
            applyConfigOption: (sessionId, configId, value) => this.applyConfigOption(sessionId, configId, value),
            notifyCurrentModeUpdate,
            notifyConfigOptionUpdateV1
        });
    }
    /**
     * Honor curated ACP slash commands that map onto session config (mode / model /
     * reasoningEffort). Returns true when the prompt was fully handled without
     * spawning agy. Unknown or non-slash prompts return false (pass through).
     */
    promptV1Deps() {
        return {
            requireSession: (id) => this.requireSession(id),
            applyConfigOption: (sessionId, configId, value) => this.applyConfigOption(sessionId, configId, value),
            persistSession: (id, session) => this.persistSession(id, session),
            notifyCurrentModeUpdate,
            notifyConfigOptionUpdateV1,
            clientFileSystemV1: (client, sessionId) => this.clientFileSystemV1(client, sessionId),
            clientElicitationV1: () => this.#clientElicitation,
            clientToolCallNameV1: () => this.#clientToolCallName
        };
    }
    promptV2Deps() {
        return {
            requireSession: (id) => this.requireSession(id),
            applyConfigOption: (sessionId, configId, value) => this.applyConfigOption(sessionId, configId, value),
            persistSession: (id, session) => this.persistSession(id, session),
            notifyConfigOptionUpdateV2,
            clientElicitationV2: () => this.#clientElicitation,
            clientToolCallNameV2: () => this.#clientToolCallName
        };
    }
    /**
     * v1 prompt lifecycle: response carries stopReason after the full turn.
     */
    promptV1(params, client, signal) {
        const session = this.#sessions.get(params.sessionId);
        if (session)
            session.v1Client = client;
        return handlePromptV1(params, client, signal, this.promptV1Deps());
    }
    /**
     * v2 prompt lifecycle: respond `{}` immediately on acceptance. Foreground
     * progress and stopReason arrive as `state_update` notifications.
     */
    promptV2(params, client) {
        const session = this.#sessions.get(params.sessionId);
        if (session)
            session.v2Client = client;
        return handlePromptV2(params, client, this.promptV2Deps());
    }
    cancel(params) {
        return handleCancel(params.sessionId, this.#sessions, params._meta);
    }
    async closeSession(params) {
        return handleCloseSession(params, this.#sessions);
    }
    async deleteSession(params) {
        return handleDeleteSession(params, this.#sessions, this.#store);
    }
    async createSession(requestedCwd, requestedDirs) {
        const session = await createSession(requestedCwd, requestedDirs, {
            ...this.sessionBuildDeps(),
            sessions: this.#sessions,
            maxActiveSessions: this.#maxActiveSessions,
            persistSession: (sessionId, session) => this.persistSession(sessionId, session)
        });
        this.reconcileSessionCatalog(session);
        return session;
    }
    applyConfigOption(sessionId, configId, value) {
        return applyConfigOptionHandler(sessionId, configId, value, {
            requireSession: (id) => this.requireSession(id),
            persistSession: (id, session) => this.persistSession(id, session)
        });
    }
    replayConversation(session, conversationId, cwd, emit, replayFrom, v2UserMessageIdsByStep) {
        return replayConversation(this.#replayCache, session, conversationId, cwd, emit, replayFrom, v2UserMessageIdsByStep);
    }
    requireSession(sessionId) {
        const session = this.#sessions.get(sessionId);
        if (!session) {
            throw new Error(`Unknown session: ${sessionId}`);
        }
        this.#sessions.delete(sessionId);
        this.#sessions.set(sessionId, session);
        return session;
    }
    registerSession(sessionId, session) {
        return registerSession(sessionId, session, this.#sessions, this.#maxActiveSessions);
    }
    sessionBuildDeps() {
        return {
            env: this.#env,
            argv: this.#argv,
            backend: this.#backend,
            getModelOptions: (config) => this.modelOptionsForConfig(config),
            conversationsDir: this.#conversationsDir
        };
    }
    async modelOptionsForConfig(config) {
        const key = config.agyPath;
        const cached = this.#modelOptionsCache.get(key);
        if (cached?.models.length) {
            if (Date.now() - cached.updatedAt >= MODEL_CACHE_TTL_MS) {
                this.refreshModelOptions(config);
            }
            return cached.models;
        }
        const inFlight = this.#modelRefreshes.get(key);
        if (inFlight) {
            try {
                await inFlight;
                const refreshed = this.#modelOptionsCache.get(key);
                if (refreshed?.models.length) {
                    return refreshed.models;
                }
            }
            catch { }
        }
        try {
            await this.refreshModelOptions(config);
            const refreshed = this.#modelOptionsCache.get(key);
            if (refreshed?.models.length) {
                return refreshed.models;
            }
            return config.model ? [config.model] : [];
        }
        catch {
            return config.model ? [config.model] : [];
        }
    }
    loadModelCache() {
        if (!this.#modelCacheEnabled)
            return;
        try {
            const parsed = JSON.parse(fs.readFileSync(this.#modelCacheFile, "utf-8"));
            for (const [key, entry] of Object.entries(parsed.entries ?? {})) {
                if (!entry || !Array.isArray(entry.models) || !Number.isFinite(entry.updatedAt))
                    continue;
                const models = entry.models.filter((model) => typeof model === "string");
                if (models.length > 0) {
                    this.#modelOptionsCache.set(key, { models, updatedAt: entry.updatedAt });
                }
            }
        }
        catch {
            // Missing or malformed caches are rebuilt from `agy models`.
        }
    }
    cacheModelOptions(key, models) {
        const normalized = [...new Set(models)];
        this.#modelOptionsCache.set(key, { models: normalized, updatedAt: Date.now() });
        const newCatalog = buildModelCatalog(normalized);
        for (const session of this.#sessions.values()) {
            if (session.agy.config.agyPath === key) {
                session.catalog = newCatalog;
                const selection = restoredModelSelection(session.selectedBaseModel, session.selectedReasoningEffort, newCatalog);
                const selectionChanged = selection.baseModel !== session.selectedBaseModel ||
                    selection.reasoningEffort !== session.selectedReasoningEffort;
                session.selectedBaseModel = selection.baseModel;
                session.selectedReasoningEffort = selection.reasoningEffort;
                applyModelSelection(session.agy, selection.baseModel, selection.reasoningEffort, newCatalog);
                if (selectionChanged && session.sessionId) {
                    this.persistSession(session.sessionId, session).catch(() => { });
                }
                if (session.v1Client) {
                    const client = session.v1Client;
                    const sessionId = session.sessionId;
                    deferAfterResponse(() => notifyConfigOptionUpdateV1(client, sessionId, session));
                }
                else if (session.v2Client) {
                    const client = session.v2Client;
                    const sessionId = session.sessionId;
                    deferAfterResponse(() => notifyConfigOptionUpdateV2(client, sessionId, session));
                }
            }
        }
        if (!this.#modelCacheEnabled)
            return;
        this.#modelCacheWrite = persistModelCache(this.#modelCacheFile, Object.fromEntries(this.#modelOptionsCache));
    }
    refreshModelOptions(config) {
        const key = config.agyPath;
        const localInFlight = this.#modelRefreshes.get(key);
        if (localInFlight)
            return localInFlight;
        if (!this.#modelCacheEnabled) {
            const localRefresh = (async () => {
                await this.ensureAgyReady();
                return this.#backend.listModels(config);
            })()
                .then((models) => {
                if (models.length > 0) {
                    this.cacheModelOptions(key, models);
                }
            })
                .catch(() => { })
                .finally(() => {
                this.#modelRefreshes.delete(key);
            });
            this.#modelRefreshes.set(key, localRefresh);
            return localRefresh;
        }
        const processKey = `${config.agyPath}:${this.#modelCacheFile}`;
        let sharedInFlight = inFlightModelRefreshes.get(processKey);
        if (!sharedInFlight) {
            sharedInFlight = (async () => {
                await this.ensureAgyReady();
                return this.#backend.listModels(config);
            })()
                .catch(() => [])
                .finally(() => {
                inFlightModelRefreshes.delete(processKey);
            });
            inFlightModelRefreshes.set(processKey, sharedInFlight);
        }
        const localRefresh = sharedInFlight
            .then((models) => {
            if (models.length > 0) {
                this.cacheModelOptions(key, models);
            }
        })
            .finally(() => {
            this.#modelRefreshes.delete(key);
        });
        this.#modelRefreshes.set(key, localRefresh);
        return localRefresh;
    }
    buildSession(cwd, additionalDirectories, stored) {
        return buildSession(cwd, additionalDirectories, stored, this.sessionBuildDeps());
    }
    /** Shared reconstruction for `session/load` and `session/resume`: restore a
     *  persisted session binding and re-register it in memory. */
    async reloadSession(sessionId, requestedCwd, requestedDirs) {
        const result = await reloadSession(sessionId, requestedCwd, requestedDirs, {
            ...this.sessionBuildDeps(),
            store: this.#store,
            sessions: this.#sessions,
            maxActiveSessions: this.#maxActiveSessions,
            setupLocks: this.#setupLocks
        });
        this.reconcileSessionCatalog(result.session);
        return result;
    }
    async forkSession(parentSessionId, requestedCwd, requestedDirs) {
        const result = await forkSession(parentSessionId, requestedCwd, requestedDirs, {
            ...this.sessionBuildDeps(),
            store: this.#store,
            sessions: this.#sessions,
            maxActiveSessions: this.#maxActiveSessions,
            persistSession: (sessionId, session) => this.persistSession(sessionId, session),
            setupLocks: this.#setupLocks
        });
        this.reconcileSessionCatalog(result.childSession);
        return result;
    }
    reconcileSessionCatalog(session) {
        const key = session.agy.config.agyPath;
        const cached = this.#modelOptionsCache.get(key);
        if (!cached || cached.models.length === 0)
            return;
        const newCatalog = buildModelCatalog(cached.models);
        session.catalog = newCatalog;
        const selection = restoredModelSelection(session.selectedBaseModel, session.selectedReasoningEffort, newCatalog);
        const selectionChanged = selection.baseModel !== session.selectedBaseModel ||
            selection.reasoningEffort !== session.selectedReasoningEffort;
        session.selectedBaseModel = selection.baseModel;
        session.selectedReasoningEffort = selection.reasoningEffort;
        applyModelSelection(session.agy, selection.baseModel, selection.reasoningEffort, newCatalog);
        if (selectionChanged && session.sessionId) {
            this.persistSession(session.sessionId, session).catch(() => { });
        }
    }
    persistSession(sessionId, session) {
        if (session.closed || this.#sessions.get(sessionId) !== session) {
            return Promise.resolve();
        }
        return persistSession(this.#store, sessionId, session);
    }
}
/** ACP v1 agent app (stable protocol). */
export function createAcpApp(options = {}) {
    const agent = options instanceof AcpAgent ? options : new AcpAgent(options);
    return v1
        .agent({ name: "agy-acp" })
        .onRequest(v1.methods.agent.initialize, (ctx) => agent.initializeV1(ctx.params))
        .onRequest(v1.methods.agent.authenticate, (ctx) => agent.authenticate(ctx.params))
        .onRequest(v1.methods.agent.logout, (ctx) => agent.logout(ctx.params))
        .onRequest(v1.methods.agent.session.new, (ctx) => agent.newSessionV1(ctx.params, ctx.client))
        .onRequest(v1.methods.agent.session.list, (ctx) => agent.listSessions(ctx.params))
        .onRequest(v1.methods.agent.session.load, (ctx) => agent.loadSession(ctx.params, ctx.client))
        .onRequest(v1.methods.agent.session.resume, (ctx) => agent.resumeSessionV1(ctx.params, ctx.client))
        .onRequest(v1.methods.agent.session.fork, (ctx) => agent.forkSessionV1(ctx.params, ctx.client))
        .onRequest(v1.methods.agent.session.setMode, (ctx) => agent.setSessionMode(ctx.params, ctx.client))
        .onRequest(v1.methods.agent.session.setConfigOption, (ctx) => agent.setConfigOptionV1(ctx.params, ctx.client))
        .onRequest(v1.methods.agent.session.prompt, (ctx) => agent.promptV1(ctx.params, ctx.client, ctx.signal))
        .onRequest(v1.methods.agent.session.close, (ctx) => agent.closeSession(ctx.params))
        .onRequest(v1.methods.agent.session.delete, (ctx) => agent.deleteSession(ctx.params))
        .onNotification(v1.methods.agent.session.cancel, (ctx) => agent.cancel(ctx.params));
}
/**
 * Experimental draft ACP v2 agent app.
 * Prefer {@link createDualAcpApp} / {@link runAcp} so v1 clients still work.
 */
export function createAcpV2App(options = {}) {
    const agent = options instanceof AcpAgent ? options : new AcpAgent(options);
    return v2
        .agent({ name: "agy-acp" })
        .onRequest(v2.methods.agent.initialize, (ctx) => agent.initializeV2(ctx.params))
        .onRequest(v2.methods.agent.auth.login, (ctx) => agent.loginAuth(ctx.params))
        .onRequest(v2.methods.agent.auth.logout, (ctx) => agent.logoutAuth(ctx.params))
        .onRequest(v2.methods.agent.session.new, (ctx) => agent.newSessionV2(ctx.params, ctx.client))
        .onRequest(v2.methods.agent.session.list, (ctx) => agent.listSessions(ctx.params))
        .onRequest(v2.methods.agent.session.resume, (ctx) => agent.resumeSessionV2(ctx.params, ctx.client))
        .onRequest(v2.methods.agent.session.fork, (ctx) => agent.forkSessionV2(ctx.params, ctx.client))
        .onRequest(v2.methods.agent.session.setConfigOption, (ctx) => agent.setConfigOptionV2(ctx.params))
        .onRequest(v2.methods.agent.session.prompt, (ctx) => agent.promptV2(ctx.params, ctx.client))
        .onRequest(v2.methods.agent.session.close, (ctx) => agent.closeSession(ctx.params))
        .onRequest(v2.methods.agent.session.delete, (ctx) => agent.deleteSession(ctx.params))
        .onNotification(v2.methods.agent.session.cancel, (ctx) => agent.cancel(ctx.params));
}
/**
 * Dual-version agent connector: negotiates ACP v1 or experimental draft v2 from
 * the client's `initialize.protocolVersion`.
 */
export function createDualAcpApp(options = {}) {
    const agent = options instanceof AcpAgent ? options : new AcpAgent(options);
    return v2.agentProtocolRouter().withV1(createAcpApp(agent)).withV2(createAcpV2App(agent));
}
export function runAcp(options = {}) {
    const stdout = (options.stdout ?? process.stdout);
    const stdin = (options.stdin ?? process.stdin);
    // v1 ndJsonStream is sufficient: framing is shared; the router peeks initialize.
    const stream = v1.ndJsonStream(Writable.toWeb(stdout), Readable.toWeb(stdin));
    return createDualAcpApp(options).connect(stream);
}
export { contentBlocksToPrompt, contentBlocksToText } from "./content/index.js";
export { buildModelCatalog, modelConfigOption, reasoningEffortConfigOption, toModelSlug, prettifyModelSlug } from "../agy/model/catalog.js";
export { sessionModeState, modeConfigOption } from "./session/modes.js";
//# sourceMappingURL=agent.js.map