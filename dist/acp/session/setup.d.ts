import type * as v1 from "@agentclientprotocol/sdk";
import { type AgyCliBackend, type AgyCliConfig } from "../../agy/cli.js";
import type { ReplayCache } from "../../agy/db/replay.js";
import type { SessionStore, StoredSession } from "./store.js";
import type { SessionState } from "./types.js";
import { KeyedAsyncLock } from "./setup-lock.js";
export { KeyedAsyncLock } from "./setup-lock.js";
export interface SessionBuildDeps {
    env: NodeJS.ProcessEnv;
    argv: string[];
    backend: AgyCliBackend;
    getModelOptions(config: AgyCliConfig): Promise<string[]>;
    conversationsDir?: string;
}
/** Build a fresh session bound to `cwd` + ACP `additionalDirectories`. */
export declare function buildSession(cwd: string, additionalDirectories: string[], stored: StoredSession | null, deps: SessionBuildDeps): Promise<SessionState>;
/** Register a session in the active-sessions map, evicting idle sessions past the capacity limit. */
export declare function registerSession(sessionId: string, session: SessionState, sessions: Map<string, SessionState>, maxActiveSessions: number, options?: {
    evictable?: ReadonlySet<string>;
}): Promise<void>;
export declare function createSession(requestedCwd: string | undefined, requestedDirs: string[] | undefined, deps: SessionBuildDeps & {
    sessions: Map<string, SessionState>;
    maxActiveSessions: number;
    persistSession(sessionId: string, session: SessionState): Promise<void>;
}): Promise<SessionState>;
/** Shared reconstruction for `session/load` and `session/resume`: restore a
 *  persisted session binding and re-register it in memory. */
export declare function reloadSession(sessionId: string, requestedCwd: string | undefined, requestedDirs: string[] | undefined, deps: SessionBuildDeps & {
    store: SessionStore;
    sessions: Map<string, SessionState>;
    maxActiveSessions: number;
    setupLocks: KeyedAsyncLock;
}): Promise<{
    session: SessionState;
    cwd: string;
    stored: StoredSession;
}>;
/** Fork an existing session into a new independent session binding. */
export declare function forkSession(parentSessionId: string, requestedCwd: string | undefined, requestedDirs: string[] | undefined, deps: SessionBuildDeps & {
    store: SessionStore;
    sessions: Map<string, SessionState>;
    maxActiveSessions: number;
    persistSession(sessionId: string, session: SessionState): Promise<void>;
    setupLocks: KeyedAsyncLock;
}): Promise<{
    childSession: SessionState;
    cwd: string;
    childSessionId: string;
}>;
export declare function sessionRecord(session: SessionState): StoredSession;
export declare function persistSession(store: SessionStore, sessionId: string, session: SessionState): Promise<void>;
export declare function filterUpdatesForReplayFrom(updates: v1.SessionUpdate[], replayFrom: Record<string, unknown>): v1.SessionUpdate[];
/** Replay a persisted conversation's session updates (used by `session/load` and
 *  `session/resume` with `replayFrom`). */
export declare function replayConversation(replayCache: ReplayCache, session: SessionState, conversationId: string, cwd: string, emit: (update: v1.SessionUpdate) => Promise<void>, replayFrom?: unknown, v2UserMessageIdsByStep?: Record<string, string>): Promise<void>;
