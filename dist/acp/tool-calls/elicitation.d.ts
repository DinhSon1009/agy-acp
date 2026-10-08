import type { AgentContext as V1AgentContext, SessionUpdate } from "@agentclientprotocol/sdk";
import type { AgentContext as V2AgentContext } from "@agentclientprotocol/sdk/experimental/v2";
export interface ClientElicitationCapability {
    form: boolean;
    url: boolean;
}
/** Send `elicitation/complete` notification to v1 client when a URL elicitation completes. */
export declare function notifyElicitationCompleteV1(client: V1AgentContext, elicitationId: string): Promise<void>;
/** Send `elicitation/complete` notification to v2 client when a URL elicitation completes. */
export declare function notifyElicitationCompleteV2(client: V2AgentContext, elicitationId: string): Promise<void>;
export type ElicitationMode = "form" | "url";
export type ElicitationAction = "accept" | "decline" | "cancel" | string;
export interface ElicitationCreateRequestParams {
    sessionId?: string;
    requestId?: number | string;
    toolCallId?: string;
    mode: ElicitationMode;
    message: string;
    requestedSchema?: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
    elicitationId?: string;
    url?: string;
}
export interface ElicitationCreateResponseResult {
    action: ElicitationAction;
    content?: Record<string, unknown>;
}
export interface ElicitationCompleteNotificationParams {
    elicitationId: string;
}
export interface AskQuestionItem {
    question: string;
    options: string[];
    multiSelect: boolean;
}
export interface AskQuestionPayloadFull {
    question: string;
    items: AskQuestionItem[];
    questionCount: number;
}
/** Parse all questions inside ask_question toolCall payload. */
export declare function parseAskQuestionFull(toolCall: SessionUpdate): AskQuestionPayloadFull | null;
/** Build elicitation/create params for an ask_question tool call. */
/** Build elicitation/create params for an ask_question tool call. */
export declare function buildElicitationRequestFromAskQuestion(toolCall: SessionUpdate, sessionId: string, questionIndex?: number): ElicitationCreateRequestParams | null;
/** Convert user elicitation submission into PTY keys for ask_question. */
export declare function encodeElicitationKeys(toolCall: SessionUpdate, content?: Record<string, unknown>, questionIndex?: number): string | null;
