import type { ContentBlock } from "@agentclientprotocol/sdk";
/**
 * Encode client ContentBlocks into a single agy prompt string.
 *
 * - text → block.text as-is
 * - image / image resource → write bytes, reference with agy `@path` transport
 * - resource_link (non-image) → uri only (client-supplied)
 * - embedded text resource → resource.text only (client-supplied body)
 * - non-image blobs → omitted (no invented "blob omitted" copy)
 *
 * Parts are joined with newlines; empty parts are dropped.
 */
export declare function contentBlocksToPrompt(blocks: ContentBlock[], cwd: string): Promise<string>;
/** Flatten client content to plain text for display/logging — no invented copy. */
export declare function contentBlocksToText(blocks: ContentBlock[]): string;
export declare function extensionForMimeType(mimeType: string): string;
export declare function mimeTypeForPath(filePath: string): string | null;
export declare function isImageMimeType(mimeType: string | null | undefined): boolean;
export declare function filePathFromUri(uri: string): string | null;
/**
 * Attempt to read a local image file and return an ACP image ContentBlock.
 * Returns null if the file does not exist, is not an image, or exceeds maxBytes.
 */
export declare function tryReadImageContentBlock(filePath: string, maxBytes?: number): {
    type: "image";
    data: string;
    mimeType: string;
} | null;
export interface SpannedContentBlock {
    block: ContentBlock;
    start: number;
    end: number;
}
/**
 * Splits agent markdown text into spanned alternating text and image ContentBlocks with their
 * character offset ranges [start, end] within the input text.
 * Excludes escaped openers (\!) and markdown code contexts (inline spans, fenced blocks).
 */
export declare function splitTextAndImagesWithRanges(text: string, cwd?: string, supersededPaths?: Set<string>): SpannedContentBlock[];
/**
 * Splits agent markdown text into alternating text and image ContentBlocks
 * when local markdown image embeds (![caption](/path/to/img)) reference readable images on disk.
 * Excludes escaped openers (\!) and markdown code contexts (inline spans, fenced blocks).
 */
export declare function splitTextAndImages(text: string, cwd?: string, supersededPaths?: Set<string>): ContentBlock[];
