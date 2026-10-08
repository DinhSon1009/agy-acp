import type { SessionUpdate } from "@agentclientprotocol/sdk";
export interface ClientFileSystem {
    readTextFile(path: string): Promise<void>;
    writeTextFile(path: string, content: string): Promise<void>;
}
/**
 * Returns true if the edit was handed off to the client (disk ends up back
 * at newText, written by the client itself). Returns false — leaving disk
 * untouched at newText — if there was nothing to route or the client
 * rejected the write-through, so the caller can fall back to the local
 * permission-bridge review.
 */
export declare function routeEditThroughClient(toolCall: SessionUpdate, bridge: ClientFileSystem): Promise<boolean>;
/**
 * Prime the client's buffer snapshot for a live-gated edit *before* agy
 * applies it, while disk still genuinely holds the pre-edit text. Used so
 * the later write-through (see {@link writeEditThroughClient}) doesn't need
 * to revert-then-replay disk itself — which races against the client's own
 * file watcher if the buffer is already open there. Best effort: failures
 * are swallowed, since a missed prime just means the later write-through
 * won't produce a clean diff and the caller falls back silently.
 */
export declare function primeEditReadThroughClient(toolCall: SessionUpdate, bridge: ClientFileSystem): Promise<void>;
/**
 * Write an edit through the client after agy has already applied it *and*
 * the pre-edit state was primed via {@link primeEditReadThroughClient} —
 * no local revert needed, since disk was never touched by us in between.
 */
export declare function writeEditThroughClient(toolCall: SessionUpdate, bridge: ClientFileSystem): Promise<boolean>;
