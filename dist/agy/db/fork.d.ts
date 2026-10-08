export interface ForkedConversation {
    /** Highest `steps.idx` present in the copied database, or -1 if none. */
    maxStepIdx: number;
}
/**
 * Fork an existing agy conversation database and brain artifacts directory into a new conversation ID.
 * Uses SQLite's online backup API for an atomic, consistent snapshot without torn reads.
 *
 * `agy` has no fork flag — it resumes a conversation by `--conversation <id>`
 * against `~/.gemini/antigravity-cli/conversations/<id>.db`. The child must
 * therefore be a new conversation id whose DB is a consistent snapshot, and
 * whose ACP cursor is not behind that snapshot.
 */
export declare function forkConversation(conversationsDir: string, sourceConversationId: string, targetConversationId: string, brainBaseDir?: string): Promise<ForkedConversation>;
/** Remove a forked conversation DB (and brain dir) that never became a live session. */
export declare function discardForkedConversation(conversationsDir: string, conversationId: string, brainBaseDir?: string): void;
