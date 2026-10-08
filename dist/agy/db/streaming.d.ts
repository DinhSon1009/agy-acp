import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { GenMetadataUsage } from "./gen-metadata.js";
import type { StepRow } from "./types.js";
export interface PendingInteraction {
    update: SessionUpdate;
    row: StepRow;
    toolName: string;
    /**
     * True when agy itself is blocked awaiting this decision (status 9, the
     * interactive confirmation menu). False for an edit that already completed
     * without ever pausing (accept-edits / skip-permissions / any non-gated
     * mode) — offered for review after the fact, since the write already
     * happened.
     */
    blocked: boolean;
}
export interface StreamOptions {
    dir: string;
    /** Bound conversation id, or null to bind the DB agy creates for a fresh prompt. */
    conversationId: string | null;
    /** Highest idx already delivered to the client before this turn. */
    baseStepIdx: number;
    /** Highest gen_metadata idx seen before this turn. */
    baseGenMetadataIdx?: number;
    skipNarration: boolean;
    cwd?: string;
    /** Snapshot of conversation ids before the prompt, for binding a new DB. */
    snapshot: Set<string> | null;
}
export declare class StreamPoller {
    private readonly opts;
    private readonly translator;
    private db;
    private boundId;
    private _pending;
    private _hasRows;
    private _busy;
    private _latestStepTerminal;
    private _latestStepType;
    private _latestStepStatus;
    private _revision;
    private dataVersion;
    private failedDataVersion;
    private failedDataVersionAttempts;
    private rowSnapshot;
    private readonly activePending;
    private readonly observedUserStepIdxs;
    private _lastUserStepIdx;
    private _latestSystemMessageStepIdx;
    private _latestTaskCompletionStepIdx;
    private _hasBackgroundWaiting;
    /** Launched background task id -> idx of the first row that carried it. */
    private readonly _launchedTaskIdxs;
    private readonly _completedTaskIds;
    private _latestGenMetadata;
    private _lastGenMetadataIdx;
    private readonly _promptGenMetadataRows;
    private _lastObservedRows;
    constructor(opts: StreamOptions);
    get conversationId(): string | null;
    get latestGenMetadata(): GenMetadataUsage | null;
    get lastGenMetadataIdx(): number;
    /**
     * Accumulate all generation metadata rows produced during this prompt turn
     * for terminal token usage reporting.
     */
    accumulatedTurnUsage(): {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        thoughtTokens?: number | null;
        cachedReadTokens?: number | null;
    } | undefined;
    /**
     * Evaluates the non-cancellation stop reason for the turn based on observed
     * model errors, output ceilings, and token limits.
     */
    detectStopReason(): "end_turn" | "max_tokens" | "refusal";
    get lastStepIdx(): number;
    get hadUpdates(): boolean;
    /** User-prompt rows observed during this prompt-scoped polling session. */
    get userStepIdxs(): number[];
    get lastUserStepIdx(): number;
    get latestSystemMessageStepIdx(): number;
    get hasUnansweredSystemMessage(): boolean;
    /**
     * True while this user turn should stay open for background work.
     * Driven strictly by SQLite protobuf task_details launch and completion state.
     */
    get hasActiveBackgroundTasks(): boolean;
    /** Newly observed status-9 tool calls from the most recent poll. */
    takePending(): PendingInteraction[];
    /** Requeue a still-blocked interaction when the TUI redraws an identical gate. */
    requeuePending(id: string): boolean;
    get turnCompleteCandidate(): boolean;
    /**
     * True when the latest terminal step is a safe single-idle-marker completion.
     *
     * Intermediate successful tool rows are turn-complete candidates (so denied
     * commands and legacy multi-marker paths still work) but must not unlock the
     * fresh-PTY single-marker shortcut: a delayed startup redraw can capture the
     * same data_version as that intermediate tool and look like turn end.
     */
    get isConclusiveTurnEnd(): boolean;
    /**
     * Successful terminal tool with no trailing message and no pending follow-up.
     * Failed/cancelled tools and task-completion wakes stay open for recovery text.
     */
    get isSuccessfulToolOnlyEnd(): boolean;
    private hasNewerWake;
    /** Increments whenever the observed rows (including growing in-place rows) change. */
    get revision(): number;
    /** Read steps appended since the turn began and translate the new ones. */
    poll(): SessionUpdate[];
    private ensureDb;
    close(): void;
}
