import type { PlanEntry as ACPPlanEntry, SessionUpdate } from "@agentclientprotocol/sdk";
export type PlanEntry = ACPPlanEntry & {
    id?: string;
};
/** Stable plan id derived from the absolute brain file path. */
export declare function planIdForPath(targetFile: string): string;
/** True when a write target is an agy brain *plan* artifact (not any brain md). */
export declare function isPlanFile(targetFile: string): boolean;
/**
 * Parse markdown list items into ACP plan entries.
 *
 * Recognizes:
 *   - `- [ ] task` / `* [x] task` / `1. [~] task`  (checkbox → status)
 *   - `- task` / `* task` / `1. task`               (plain list → pending)
 *
 * When no list items exist, falls back to a single entry from the first
 * meaningful line (heading stripped).
 */
export declare function parsePlanEntries(markdown: string): PlanEntry[];
/**
 * Reconcile freshly parsed entries against the previous snapshot of the same
 * plan so entry IDs preserve task identity across successive list edits.
 * Occurrence-based IDs alone reshuffle when a duplicate task is inserted
 * before an existing one (the new row steals the old row's ID, and an ID-keyed
 * client reads that as reverting the old task and appending a new one).
 *
 * Matching runs most-specific first:
 *   1. same content AND same status — a status-stable duplicate keeps its ID
 *      even when an identical task is inserted before it;
 *   2. same content, any status — a checkbox flip keeps the entry's ID.
 * Rows with no previous counterpart get a fresh content-hash ID, bumped until
 * unique against every ID already claimed in this snapshot.
 */
export declare function reconcilePlanEntryIds(previous: readonly PlanEntry[] | undefined, next: PlanEntry[]): PlanEntry[];
/** Build a classic ACP v1 `plan` session update from plan markdown. */
export declare function planUpdateFromMarkdown(targetFile: string, markdown: string, previous?: readonly PlanEntry[]): SessionUpdate;
/** Build an ACP `plan_removed` session update when plan artifact is cleared/deleted. */
export declare function planRemovedFromPath(targetFile: string): SessionUpdate;
