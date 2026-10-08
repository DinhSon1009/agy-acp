import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { GenMetadataUsage } from "./gen-metadata.js";
import type { StepRow } from "./types.js";
export type TranslateMode = "stream" | "replay";
export interface TranslatorOptions {
    mode: TranslateMode;
    skipNarration: boolean;
    /** Project working dir, used to render display paths in tool calls. */
    cwd?: string;
}
export declare class Translator {
    private readonly opts;
    private readonly agentTextLengths;
    private readonly thoughtTextLengths;
    private readonly emittedProviderErrorMessageIds;
    private readonly toolSnapshots;
    private readonly fileContents;
    private readonly planEntries;
    private readonly imageArtifacts;
    readonly locationReadability: Map<string, boolean>;
    private readonly pendingAgentParts;
    private pendingAgentMessageId;
    private pendingAgentStartStepIdx;
    private pendingAgentEndStepIdx;
    private pendingAgentSupersededPaths;
    private _lastTitle;
    private _lastStepIdx;
    private _hadUpdates;
    private lastEmittedUsageUsed;
    constructor(opts: TranslatorOptions);
    /** Highest step idx seen so far. */
    get lastStepIdx(): number;
    /** Whether any update has been produced across all batches. */
    get hadUpdates(): boolean;
    /**
     * Reset row-derived file state before replaying a complete prompt-scoped
     * snapshot. StreamPoller rereads all rows after its fixed base idx whenever
     * SQLite changes; rebuilding this cache makes oldText derivation independent
     * of the previous poll's terminal state.
     */
    resetFileContentsForFullReplay(): void;
    /** Translate a batch of rows into ordered ACP updates, advancing state. */
    translate(rows: StepRow[]): SessionUpdate[];
    /** Translate new generation usage metrics into an ACP usage_update notification. */
    translateUsage(usages: GenMetadataUsage[]): SessionUpdate[];
    private translateRow;
    private pushDispatched;
    /**
     * Emit a tool/plan/thought update. Tools re-emit as `tool_call_update` when
     * the snapshot changes; plans re-emit as a full `plan` replacement when the
     * markdown-derived entries change. Unrelated update kinds pass through.
     */
    private emitProgressive;
    private emitThought;
    private emitProviderError;
    private handleTitle;
    private handleAgentText;
    private flushAgentBuffer;
}
