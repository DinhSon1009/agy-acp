import type { SessionUpdate } from "@agentclientprotocol/sdk";
/** Files larger than this are treated as out-of-scope (reported, not diffed). */
export declare const MAX_TEXT_BYTES: number;
export interface FileRecord {
    /** Absolute path in the first configured root spelling — what we emit. */
    path: string;
    /** Physical identity (`fs.realpath`); the snapshot's map key. */
    canonicalPath: string;
    sha1: string;
    size: number;
    /** utf-8 contents, or null when binary or oversized (out of scope for a diff). */
    text: string | null;
}
/** A configured workspace root, in both the configured and physical spelling. */
export interface WorkspaceRoot {
    display: string;
    canonical: string;
}
export interface WorkingTreeSnapshot {
    /** Deduplicated by physical identity, in configured order (cwd first). */
    roots: WorkspaceRoot[];
    /** canonical path -> content the client has been told the file holds. */
    files: Map<string, FileRecord>;
    /**
     * Absolute paths (files or directories) the listing deliberately skipped:
     * gitignored entries, symlinks, and the non-git walker's skip list. Recorded
     * in the same root spelling as {@link files}, so a path that only becomes
     * visible later (agy edited an ignore rule) is recognizable as pre-existing
     * rather than invented as a creation whose pre-turn content we never had.
     */
    excluded: string[];
}
export interface ReflectedEdit {
    path: string;
    /** Pre-edit content; null when the file is newly created this turn. */
    oldText: string | null;
    newText: string;
}
export type UnsupportedReason = "binary" | "oversized" | "deleted" | "previously-excluded";
export interface UnsupportedChange {
    path: string;
    reason: UnsupportedReason;
}
export interface ReconcileResult {
    reflected: ReflectedEdit[];
    unsupported: UnsupportedChange[];
}
/** True when `buf` decodes as UTF-8 without replacement. */
export declare function isValidUtf8(buf: Buffer): boolean;
/** Snapshot the working tree across one or more configured roots. */
export declare function snapshotWorkingTree(rootPaths: string[]): Promise<WorkingTreeSnapshot>;
export interface ReportedBlock {
    /** Text the block replaced, or null when it reported a whole file body. */
    oldText: string | null;
    newText: string;
}
export interface ReportedContent {
    path: string;
    /**
     * The diff blocks the update reported for this path. Disk is recorded only
     * when they account for every difference from the content already recorded;
     * otherwise a change reached the file before the tool-call was polled, the
     * current bytes were never reported, and reconciliation must still emit them.
     * Omit to record disk unconditionally, which only a caller that knows the
     * client has the current state may do — a completed local revert.
     */
    blocks?: ReportedBlock[];
    /** True when `blocks` carry the whole file body (a `write_to_file` call). */
    wholeFile?: boolean;
}
/**
 * Record the current on-disk content of paths whose change has *already* been
 * reported to the client (a recognized structured edit, or a synthetic one this
 * module produced), so end-of-turn reconciliation only emits what is still
 * unreflected. Call it while disk holds the reported content — before any
 * write-through revert/replay dance, and again after a rejected edit is
 * reverted. Paths outside the configured roots are ignored, which keeps the
 * snapshot to files this workspace is responsible for.
 */
export declare function observeEditedPaths(snapshot: WorkingTreeSnapshot, reported: ReportedContent[]): Promise<void>;
/**
 * Diff the working tree against what the client has been told (see
 * {@link observeEditedPaths}). Added/modified text files become `reflected`
 * edits; anything we cannot represent as a text diff becomes `unsupported`.
 */
export declare function reconcileWorkingTree(snapshot: WorkingTreeSnapshot): Promise<ReconcileResult>;
/** Absolute path -> project-relative for display; unchanged if outside cwd. */
export declare function toDisplayPath(filePath: string, cwd?: string): string;
/**
 * Build a synthetic completed-edit `tool_call` update for a reconciled change.
 * Shaped so {@link diffBlocks} (edit/revert.ts) reads it back and the client
 * fs write-through routes it exactly like a recognized edit. `turnToken`, when
 * provided, keeps the tool-call ID unique across turns in the same session.
 */
export declare function buildReconcileEditUpdate(edit: ReflectedEdit, index: number, cwd?: string, turnToken?: string): SessionUpdate;
