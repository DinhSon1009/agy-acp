/** Thrown when a claim is aborted; unwinds the turn pipeline to its reporter. */
export declare class TurnCancelled extends Error {
    constructor(message?: string);
}
export declare function isTurnCancelled(error: unknown): boolean;
/**
 * Run `fn` for an abort signal, now or later. Plain `addEventListener` never
 * fires for a signal that is already aborted, which repeatedly produced turns
 * that ran after they had been cancelled.
 */
export declare function onAbort(signal: AbortSignal, fn: () => void): () => void;
export type TurnKind = "foreground" | "queued" | "steer";
/** A request's ownership of (or reservation on) the session's single turn slot. */
export declare class TurnClaim {
    readonly kind: TurnKind;
    /**
     * For claimed queued prompts, the client-visible queue id. Lets a targeted
     * `session/cancel` find the turn its queued item grew into, so it aborts
     * exactly that claim instead of falling back to a session-wide abort.
     */
    readonly tag?: string;
    private readonly controller;
    private isReleased;
    constructor(kind: TurnKind, parent?: AbortSignal, tag?: string);
    get signal(): AbortSignal;
    get aborted(): boolean;
    get released(): boolean;
    abort(): void;
    throwIfAborted(): void;
    /** @internal — the scheduler marks a claim finished exactly once. */
    markReleased(): boolean;
}
/**
 * Await `promise`, rejecting with `TurnCancelled` as soon as `signal` aborts.
 *
 * The single implementation behind invariant I4: every client-bound delivery
 * goes through here (directly, or via `raceClaim` for turn claims), so a
 * client transport that never settles unwinds on cancel/close instead of
 * pinning the turn slot or the queue-preparation chain.
 */
export declare function raceSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>;
/** Await `promise`, rejecting as soon as `claim` is aborted. */
export declare function raceClaim<T>(promise: Promise<T>, claim: TurnClaim): Promise<T>;
/** Lazily attach a scheduler to a session-like object. */
export declare function turnsOf(session: {
    turns?: TurnScheduler;
}): TurnScheduler;
export declare class TurnScheduler {
    private active?;
    /** Steer reservations in FIFO order; the head is next to take the slot. */
    private reservations;
    private waiters;
    private closed;
    /** True when a turn is running or a steer has reserved the next turn. */
    busy(): boolean;
    get activeClaim(): TurnClaim | undefined;
    /**
     * Take the slot for a request that found the session idle. Synchronous by
     * design: no await may separate the busy check from the claim (I1).
     */
    claimIdle(kind: Exclude<TurnKind, "steer">, parent?: AbortSignal, tag?: string): TurnClaim;
    /**
     * Reserve the next turn for a steer. Synchronous, so the claim — and its
     * abort controller — exist before the first await (I1, I2). The reservation
     * keeps the session `busy()`, so no queued follow-up can slip in front.
     */
    reserveSteer(parent?: AbortSignal): TurnClaim;
    /**
     * Wait for `claim` to reach the head of the reservation queue, stop whatever
     * is running, and hand it the slot. Throws `TurnCancelled` if the claim is
     * aborted at any point, including while the backend is being killed.
     *
     * A reservation stays in the queue until it is *released*, not merely until
     * it is promoted. Otherwise a later steer would reach the head while an
     * earlier one was running and displace it before it ever reached the backend.
     */
    promote(claim: TurnClaim, cancelActive: () => Promise<void>): Promise<void>;
    /**
     * Finish a claim. Idempotent, and safe to call from a `finally` on any exit
     * path — success, cancellation, or setup failure.
     */
    release(claim: TurnClaim): void;
    /** Abort every live claim (`session/cancel`). Queued items are untouched. */
    abortAll(): void;
    /** Abort everything and refuse further claims (close / delete / evict). */
    close(): void;
    private change;
    /** Resolve on the next ownership change, or reject if `claim` is aborted. */
    private nextChange;
}
