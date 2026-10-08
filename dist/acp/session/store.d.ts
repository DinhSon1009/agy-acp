/** Where session bindings live. Exposed as a
 *  function (rather than a module-level constant) so callers — including
 *  tests — can control it, instead of it being fixed at module-load time. */
export declare function defaultStateDir(): string;
/** Persisted ACP session binding (fields aligned with session config + setup). */
export interface StoredSession {
    cwd: string;
    /** ACP `additionalDirectories` (does not include `cwd`). */
    additionalDirectories: string[];
    conversationId: string | null;
    lastStepIdx: number;
    /** Matches ACP config option `model` (base slug for agy --model). */
    model: string;
    /** Matches ACP config option `reasoningEffort` (maps to agy --effort). */
    reasoningEffort: string;
    /** Matches ACP config option `mode` (`default` | `accept-edits` | `plan`). Absent on older store files. */
    mode?: string;
    /** Stable v2 user-message IDs keyed by their persisted agy step index. */
    v2UserMessageIdsByStep: Record<string, string>;
    updatedAt: string;
}
export declare class SessionStore {
    #private;
    private readonly dir;
    private readonly file;
    constructor(dir: string);
    /** Restore a persisted session binding, or null if none exists. */
    restore(sessionId: string): Promise<StoredSession | null>;
    /**
     * List persisted session bindings, newest first.
     * Optional `cwd` filters to sessions whose stored working directory matches.
     */
    list(filter?: {
        cwd?: string | null;
    }): Promise<Array<{
        sessionId: string;
    } & StoredSession>>;
    /** Persist a session binding. Resolves once written (writes are serialized). */
    persist(sessionId: string, session: StoredSession): Promise<void>;
    /** Delete a persisted session binding. Resolves once written (writes are serialized). Returns true if deleted. */
    delete(sessionId: string): Promise<boolean>;
    private load;
    private writeOne;
    private deleteOne;
}
