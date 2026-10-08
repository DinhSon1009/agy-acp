import type { SessionUpdate } from "@agentclientprotocol/sdk";
/**
 * Option ids for permission menus and ask_question.
 * Edit tools use standard ACP ids (`allow-once` / `reject-once` / `allow-always`)
 * so clients can map them to native Keep / Reject UI.
 */
export type PermissionChoice = string;
export interface PermissionMenuOption {
    optionId: PermissionChoice;
    kind: "allow_once" | "allow_always" | "reject_once" | "reject_always";
    name: string;
}
export interface AskQuestionPrompt {
    question: string;
    options: string[];
    multiSelect: boolean;
}
export interface AskQuestionPayload {
    questions: AskQuestionPrompt[];
    questionCount: number;
    question: string;
    options: string[];
    multiSelect: boolean;
}
/**
 * Status-9 tools that can be answered through ACP `session/request_permission`
 * and PTY key injection. `ask_question` is handled separately (MCQ, not a
 * permission panel).
 */
export declare function isBridgeablePermissionTool(toolName: string): boolean;
export declare function isEditToolName(toolName: string): boolean;
/** True when an ACP tool_call update is a file edit (kind or tool name). */
export declare function isEditToolCall(toolCall: SessionUpdate): boolean;
/** True when this status-9 tool can be bridged (permission menu, multi-select MCQ, or elicitation). */
export declare function canBridgeInteraction(toolName: string, toolCall?: SessionUpdate, options?: {
    hasElicitation?: boolean;
}): boolean;
export declare const MAX_BRIDGABLE_MULTI_SELECT_OPTIONS = 6;
/** ask_question is safe to bridge when it has non-empty options for all questions. */
export declare function isBridgeableAskQuestion(ask: AskQuestionPayload): boolean;
/** Normalize client-selected option ids (standard ACP or legacy agy-*). */
export declare function normalizePermissionChoice(choice: string): PermissionChoice;
export declare function permissionKeys(choice: PermissionChoice): string | null;
/**
 * Map an ACP option id to PTY keypresses for the given interaction.
 * Returns null when the choice cannot be applied safely.
 */
export declare function interactionKeys(choice: PermissionChoice, toolName: string, toolCall?: SessionUpdate, questionIndex?: number): string | null;
/** Parse ask_question rawInput into a stable shape for bridging. */
export declare function parseAskQuestion(toolCall: SessionUpdate): AskQuestionPayload | null;
/** Build ACP permission options for the given pending tool interaction. */
export declare function permissionOptions(toolCall: SessionUpdate, toolName?: string, questionIndex?: number): PermissionMenuOption[];
export declare function askQuestionOptions(toolCall: SessionUpdate, questionIndex?: number): PermissionMenuOption[];
