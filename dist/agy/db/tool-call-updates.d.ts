import type { SessionUpdate, ToolKind } from "@agentclientprotocol/sdk";
import { type PlanEntry } from "../../acp/agent-plan/index.js";
import type { StepRow } from "./types.js";
/** Absolute path -> last known file body from prior view_file / write steps. */
export type FileContentCache = Map<string, string>;
/** Cached image artifact for a completed tool call (callKey -> image block + path). */
export type ImageArtifactCache = Map<string, {
    block: {
        type: "image";
        data: string;
        mimeType: string;
    };
    path: string;
}>;
/** Options shared by tool builders that need project context. */
export interface UpdateContext {
    cwd?: string;
    /** Prior file contents for full-file write diffs. */
    fileContents?: FileContentCache;
    /** Plan id -> entries of the previous plan snapshot (stable entry-id reconciliation). */
    planEntries?: Map<string, PlanEntry[]>;
    /** Candidate location path -> readability observed while translating. */
    locationReadability?: Map<string, boolean>;
    /** Completed generate_image artifacts cached per tool call (freezes output across file mutations). */
    imageArtifacts?: ImageArtifactCache;
    /** Normalized absolute paths modified by later completed steps in the translated batch. */
    supersededPaths?: Set<string>;
}
/** Cap on fetched URL / large tool bodies surfaced in session updates. */
export declare const MAX_TOOL_BODY_CHARS = 32000;
/** Parse the JSON-encoded tool arguments (`toolRun.call.rawInputJson`), tolerating
 *  missing or malformed payloads. Every builder below needs these args. */
export declare function parseRawInput(stepRow: StepRow): unknown;
/** Resolves the human-readable action title for a tool call update.
 *  Checks explicit toolSummary/toolAction from rawInput, protobuf titlePrimary/titleSecondary,
 *  and falls back to computed fallback or tool name. */
export declare function resolveToolTitle(stepRow: StepRow, computedFallback?: string): string;
/** Stable tool-call id: agy's own call id when present, else a synthetic id
 *  derived from the step's position and type. */
export declare function toolCallId(stepRow: StepRow): string;
/** Map agy permission decision varint to a short outcome label.
 *  Observed values: 0 = denied, 1 = granted. */
export declare function permissionOutcome(decision: number): "denied" | "granted" | "unknown";
/** Truncate a large tool body for editor-friendly display. */
export declare function truncateToolBody(text: string, max?: number): {
    text: string;
    truncated: boolean;
};
/** Decoded agy tool identity, preferring the primary field when both exist. */
export declare function decodedToolName(stepRow: StepRow): string;
/**
 * Build a `tool_call` update with the envelope common to every tool step: the
 * parsed args become `rawInput`, a decoded error becomes `rawOutput` plus a
 * content block, and `permissions`/`task_details` (when present) are appended
 * as content. Every builder below routes through here.
 */
export declare function toolCallUpdate(opts: {
    stepRow: StepRow;
    title: string;
    kind: ToolKind;
    name?: string;
    status?: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
    content?: Record<string, unknown>[];
    locations?: Record<string, unknown>[];
}): SessionUpdate;
/** True when a tool name is pure agent reasoning (emit agent_thought_chunk). */
export declare function isThoughtToolName(name: string): boolean;
/** Build an agent_thought_chunk from a think-style tool step. */
export declare function thoughtUpdate(stepRow: StepRow): SessionUpdate;
/** Return true if `filePath` is positively known to be a readable file. */
export declare function isReadableFile(filePath: string | null | undefined): boolean;
/** Step types 8/9/17(view_file|list_dir): a file read or directory listing. */
export declare function readUpdate(stepRow: StepRow, ctx?: UpdateContext): SessionUpdate;
/** Step types 7/33(grep_search|search_web): a filesystem or web search. */
export declare function searchUpdate(stepRow: StepRow, ctx?: UpdateContext): SessionUpdate;
/** Step type 21 (run_command): a shell command execution. */
export declare function executeUpdate(stepRow: StepRow): SessionUpdate;
/** Step type 31 (read_url_content): fetch URL + optional decoded body (field 40). */
export declare function fetchUpdate(stepRow: StepRow): SessionUpdate;
/** Step type 5 (write_to_file|replace_file_content|multi_replace_file_content),
 *  and step 17 artifact writes (e.g. a generated `plan.md` for user review).
 *  Brain plan markdown becomes a structured ACP `plan` update (not an edit tool). */
export declare function editUpdate(stepRow: StepRow, ctx?: UpdateContext): SessionUpdate | SessionUpdate[];
/** Step type 138 (ask_question): the agent poses one or more multiple-choice questions. */
export declare function questionUpdate(stepRow: StepRow): SessionUpdate;
/** Step type 127 (invoke_subagent): delegates one or more tasks to subagents. */
export declare function subagentUpdate(stepRow: StepRow): SessionUpdate;
/** Extract candidate file paths modified by a terminal step (status === 3, 6, 7). */
export declare function getCompletedStepTargetPaths(stepRow: StepRow, cwd?: string): string[];
/** Tool call for generate_image (image creation / manipulation tool). */
export declare function imageGenerationUpdate(stepRow: StepRow, ctx?: UpdateContext): SessionUpdate;
/**
 * Step type 132 orchestration tools (manage_task/schedule/send_message/
 * manage_subagents), plus the generic fallback for any tool without a
 * dedicated builder above.
 */
export declare function otherUpdate(stepRow: StepRow): SessionUpdate;
