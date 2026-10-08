import { type GenMetadataUsage } from "./gen-metadata.js";
import type { StepRow } from "./types.js";
export declare function conversationDbPath(dir: string, id: string): string;
/** A live identity for a conversation DB file, used to validate caches. */
export interface DbStat {
    mtimeMs: number;
    size: number;
    walMtimeMs?: number;
    walSize?: number;
    journalMtimeMs?: number;
    journalSize?: number;
    changeCounter: number;
    /**
     * Committed WAL state from the wal-index (`-shm`) header: the committed frame
     * count (mxFrame) and the cumulative checksum chain through that frame. In
     * WAL mode the main-file change counter only advances on checkpoint, and WAL
     * file metadata/content cannot prove the committed state is unchanged: commit
     * frames reach the file before mxFrame is published, RESTART checkpoints
     * leave the file allocated, and rolled-back spill frames are reused without
     * bumping header salts. The wal-index is the same publication point SQLite
     * readers consult, so keying on it ties the fingerprint to exactly the
     * snapshot a replay build reads. A torn shm read only causes a spurious
     * rebuild (safe direction), never a stale hit.
     */
    walMxFrame?: number;
    walFrameCksum0?: number;
    walFrameCksum1?: number;
}
/** Stat a conversation DB, or null if it doesn't exist. */
export declare function statConversation(dir: string, id: string): DbStat | null;
/** An open, reusable read handle on one conversation's steps and gen_metadata tables. */
export declare class ConversationDb {
    private readonly db;
    private readonly stmt;
    private readonly dataVersionStmt;
    private readonly genMetadataStmt;
    private readonly latestGenMetadataStmt;
    private constructor();
    /** Open a conversation DB, or null if missing/unreadable or lacking a steps table. */
    static open(dir: string, id: string): ConversationDb | null;
    /** Read decoded step rows with idx > afterStepIdx, in order.
     *
     * A row whose blob fails to decode (e.g. a torn read of a row agy is still
     * writing to) is logged and dropped rather than thrown — one bad row must
     * not take down the whole poll loop. Since it's dropped, not consumed, its
     * idx isn't advanced past, so it's naturally retried on the next read once
     * the write settles. */
    readAfter(afterStepIdx: number): StepRow[] & {
        hasDecodeError: boolean;
    };
    /** Read decoded gen_metadata entries with idx > afterIdx, in order. */
    readGenMetadataAfter(afterIdx: number): GenMetadataUsage[];
    /** Read the latest gen_metadata entry. */
    readLatestGenMetadata(): GenMetadataUsage | null;
    /** SQLite generation counter, incremented when another connection commits. */
    dataVersion(): number;
    close(): void;
}
/** One-shot read of decoded step rows with idx > afterStepIdx. Returns null if
 *  the DB is missing/unreadable. */
export declare function readRows(dir: string, id: string, afterStepIdx: number): StepRow[] | null;
/** One-shot read of the latest generation usage metrics. Returns null if missing/unreadable. */
export declare function readLatestSessionUsage(dir: string, id: string): GenMetadataUsage | null;
