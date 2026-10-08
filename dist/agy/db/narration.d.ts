/** True if every non-empty line is a narration line ("I will …" / "I'll …"). */
export declare function isNarration(text: string): boolean;
/** Join parts, dropping narration-only ones. Returns null if nothing remains. */
export declare function filterNarration(parts: string[]): string | null;
