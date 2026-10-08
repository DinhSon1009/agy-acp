/** Snapshot the set of conversation ids (`*.db` stems) currently on disk. */
export declare function conversationSnapshot(dir: string): Set<string>;
/**
 * Find the single new conversation id created since `before`. Returns null if
 * none — or if several appeared, since we can't safely pick which one belongs
 * to this prompt.
 */
export declare function newConversationId(dir: string, before: Set<string>): string | null;
