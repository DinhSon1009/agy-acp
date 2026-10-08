import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { type DbStat } from "./database.js";
export interface ReplayOptions {
    skipNarration: boolean;
    cwd?: string;
}
export interface ReplayResult {
    updates: SessionUpdate[];
    /** Highest step idx covered (advances even for steps that emit nothing). */
    maxIdx: number;
}
/** True when two DB fingerprints are identical across every tracked field. */
export declare function isDbStatUnchanged(a: DbStat, b: DbStat): boolean;
/**
 * Replays conversations into ACP updates, caching results so repeat loads of an
 * unchanged conversation are cheap.
 */
export declare class ReplayCache {
    private readonly cache;
    constructor(capacity: number);
    /** Replay a conversation, using/refreshing the cache. Null if unreadable. */
    get(dir: string, id: string, opts: ReplayOptions): ReplayResult | null;
    /** Manually invalidate cache for a specific conversation ID. */
    invalidate(id: string): void;
    /** Clear all cached conversations. */
    clear(): void;
}
