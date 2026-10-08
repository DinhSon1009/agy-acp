import type { AvailableCommand, ContentBlock, SessionUpdate } from "@agentclientprotocol/sdk";
export declare const MODE_SLASH = "mode";
export declare const PLAN_SLASH = "plan";
export declare const MODEL_SLASH = "model";
export declare const EFFORT_SLASH = "effort";
export declare const SKILLS_SLASH = "skills";
/** Commands advertised to clients for typeahead / slash menus. */
export declare const AVAILABLE_COMMANDS: readonly AvailableCommand[];
/** ACP session update listing the curated command set. */
export declare function availableCommandsUpdate(): SessionUpdate;
export type ParsedSlashCommand = {
    name: string;
    /** Remainder after the command name; empty string when omitted. */
    input: string;
};
/**
 * Parse a prompt that is only a single slash command (optional free-text input).
 * Returns null when the text is not a pure slash invocation (mixed content,
 * attachments already flattened into non-slash text, multi-command, etc.).
 */
export declare function parseSlashCommand(promptText: string): ParsedSlashCommand | null;
/**
 * True when the client's original ContentBlocks are a pure text slash command
 * (exactly one non-empty text block, no images/resources/links).
 *
 * Slash interception must not fire on flattened resource bodies that merely
 * contain text like `/plan` — those should be forwarded to agy as normal
 * prompt content.
 */
export declare function isClientTextSlashPrompt(blocks: ContentBlock[]): boolean;
export type SlashConfigAction = {
    kind: "set_config";
    configId: "mode" | "model" | "reasoningEffort";
    value: string;
};
export type SlashInterpretResult = {
    kind: "pass";
} | {
    kind: "error";
    message: string;
} | SlashConfigAction;
/**
 * Map a parsed slash command onto an ACP config change, or pass through to agy.
 * Model value resolution (slug / display name) is done by the caller with the
 * live catalog — this only validates structure for mode/effort and packages
 * the raw model input.
 */
export declare function interpretSlashCommand(parsed: ParsedSlashCommand): SlashInterpretResult;
/**
 * Resolve a free-text model request against the session catalog.
 * Accepts ACP base slug, display name, or legacy agy base name (case-insensitive).
 */
export declare function resolveModelValue(raw: string, catalog: {
    baseModels(): string[];
    displayName(slug: string): string;
    slugForAgyBase?(agyBase: string): string | undefined;
}): string | null;
