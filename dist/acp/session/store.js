// ACP Session Setup / List: persist bindings for session/load, session/resume,
// and session/list across server restarts.
// Docs: https://agentclientprotocol.com/protocol/v1/session-setup
//
// Writes are serialized through an in-process promise chain (so concurrent
// persists can't clobber each other) and committed atomically via temp-file +
// rename.
//
// Stored under its own directory (not the sibling `antigravity-acp` project's
// `~/.agy-acp`) so the two tools can't collide if both happen to be installed.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
/** Where session bindings live. Exposed as a
 *  function (rather than a module-level constant) so callers — including
 *  tests — can control it, instead of it being fixed at module-load time. */
export function defaultStateDir() {
    return path.join(os.homedir(), ".agy-acp-state");
}
export class SessionStore {
    dir;
    #writeChain = Promise.resolve();
    file;
    constructor(dir) {
        this.dir = dir;
        this.file = path.join(dir, "sessions.json");
    }
    /** Restore a persisted session binding, or null if none exists. */
    async restore(sessionId) {
        const store = await this.load();
        return store.sessions[sessionId] ?? null;
    }
    /**
     * List persisted session bindings, newest first.
     * Optional `cwd` filters to sessions whose stored working directory matches.
     */
    async list(filter) {
        const store = await this.load();
        const cwd = filter?.cwd ?? null;
        return Object.entries(store.sessions)
            .filter(([, session]) => cwd == null || session.cwd === cwd)
            .map(([sessionId, session]) => ({ sessionId, ...session }))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    /** Persist a session binding. Resolves once written (writes are serialized). */
    persist(sessionId, session) {
        const op = this.#writeChain.then(() => this.writeOne(sessionId, session));
        this.#writeChain = op.catch((error) => {
            console.error(`[agy-acp] WARN: failed to persist session: ${error.message}`);
        });
        return op;
    }
    /** Delete a persisted session binding. Resolves once written (writes are serialized). Returns true if deleted. */
    delete(sessionId) {
        let deleted = false;
        this.#writeChain = this.#writeChain
            .then(async () => {
            deleted = await this.deleteOne(sessionId);
        })
            .catch((error) => {
            console.error(`[agy-acp] WARN: failed to delete session: ${error.message}`);
        });
        return this.#writeChain.then(() => deleted);
    }
    async load() {
        try {
            const parsed = JSON.parse(await fs.promises.readFile(this.file, "utf-8"));
            const sessions = {};
            for (const [id, raw] of Object.entries(parsed.sessions ?? {})) {
                sessions[id] = normalizeStoredSession(raw);
            }
            return { sessions };
        }
        catch {
            return { sessions: {} };
        }
    }
    async writeOne(sessionId, session) {
        const store = await this.load();
        store.sessions[sessionId] = session;
        await fs.promises.mkdir(this.dir, { recursive: true });
        const tmp = `${this.file}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify(store, null, 2));
        await fs.promises.rename(tmp, this.file);
    }
    async deleteOne(sessionId) {
        const store = await this.load();
        if (!(sessionId in store.sessions)) {
            return false;
        }
        delete store.sessions[sessionId];
        await fs.promises.mkdir(this.dir, { recursive: true });
        const tmp = `${this.file}.tmp`;
        await fs.promises.writeFile(tmp, JSON.stringify(store, null, 2));
        await fs.promises.rename(tmp, this.file);
        return true;
    }
}
/** Map legacy disk keys to current ACP-aligned field names. */
function normalizeStoredSession(raw) {
    const cwd = raw.cwd ?? "";
    const additionalDirectories = raw.additionalDirectories ??
        (Array.isArray(raw.workspaces) ? raw.workspaces.filter((w) => w !== cwd) : []);
    return {
        cwd,
        additionalDirectories,
        conversationId: raw.conversationId ?? null,
        lastStepIdx: raw.lastStepIdx ?? -1,
        model: raw.model ?? raw.modelId ?? "",
        reasoningEffort: raw.reasoningEffort ?? raw.reasoningEffect ?? "",
        mode: raw.mode,
        v2UserMessageIdsByStep: normalizeMessageIdMap(raw.v2UserMessageIdsByStep),
        updatedAt: raw.updatedAt ?? new Date(0).toISOString()
    };
}
function normalizeMessageIdMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    return Object.fromEntries(Object.entries(value).filter(([stepIdx, messageId]) => /^\d+$/.test(stepIdx) && typeof messageId === "string" && messageId.length > 0));
}
//# sourceMappingURL=store.js.map