import type { SessionUpdate } from "@agentclientprotocol/sdk";
export interface DiffBlock {
    path: string;
    oldText: string | null;
    newText: string;
}
export declare function diffBlocks(toolCall: SessionUpdate): DiffBlock[];
export declare function hasUniqueOccurrence(str: string, substr: string): boolean;
/**
 * Restore the pre-edit text this same translator pass recorded for each diff
 * block. Only acts when the file's current content still matches what the
 * edit wrote — if it has diverged further (a later edit landed on top), or
 * if the replacement text appears multiple times ambiguously, the block is
 * left alone rather than guessing.
 *
 * Returns the blocks actually restored, so callers can attribute exactly the
 * restoration that happened: a diverged block that was declined still holds
 * content the client has not seen, and a restored block says nothing about
 * the rest of its file.
 */
export declare function revertEditToolCall(toolCall: SessionUpdate): DiffBlock[];
