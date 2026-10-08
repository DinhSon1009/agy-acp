export interface ToolCall {
    callId: string;
    namePrimary: string;
    rawInputJson: string;
    nameSecondary: string;
}
export interface ToolRun {
    call: ToolCall | undefined;
    titlePrimary: string;
    titleSecondary: string;
}
/** One grep_search hit. Field numbers are reverse-engineered from real agy
 *  conversation DBs: 1 = relative file path, 2 = line number (varint),
 *  3 = matched line text, 4 = absolute file path. Field 5 has not been
 *  observed populated in real DBs but is retained for forward-compat. */
export interface SearchHit {
    field1: string;
    /** 1-based line number of the match, or 0 when agy omits it. */
    field2: number;
    field3: string;
    field4: string;
    field5: string;
}
export interface WriteFileResult {
    summary: string;
}
export interface GrepSearchResult {
    query: string;
    includeGlob: string;
    textOutput: string;
    hits: SearchHit[];
    shellCommand: string;
    cwdUri: string;
}
export interface ViewFileResult {
    fileUri: string;
    startLine: number;
    endLine: number;
    content: string;
    nextLine: number;
    fileSizeOrTotal: number;
}
export interface DirEntry {
    name: string;
    isDirectory: number;
    fileSize: number;
}
export interface ListDirectoryResult {
    dirUri: string;
    entries: DirEntry[];
}
export interface UserPromptContent {
    text: string;
}
export interface UserPrompt {
    text: string;
    content: UserPromptContent | undefined;
}
export interface AgentText {
    text: string;
    thought?: string;
}
export interface TitleUpdate {
    title: string;
}
/**
 * Step-payload field 28 — run_command result (decoded from real conversation DBs).
 * Field numbers are load-bearing reverse-engineered facts, not a public schema.
 */
export interface CommandResult {
    cwd: string;
    exitCode?: number;
    /** Shell stdout/stderr text when present (may include truncation markers). */
    output: string;
    command: string;
}
/**
 * Step-payload field 42 — search_web result metadata.
 * Full hit lists are not persisted by agy; only query / refined query (or
 * search URL) appear in the conversation DB.
 */
export interface WebSearchResult {
    query: string;
    /** Refined query text, or a Google search URL, depending on the step. */
    refinedQueryOrUrl: string;
}
/**
 * Step-payload field 40 — read_url_content result.
 * Body text is often huge HTML; callers should truncate for UI display.
 */
export interface UrlContentResult {
    url: string;
    title: string;
    description: string;
    /** Fetched document body when embedded in the payload. */
    body: string;
    /** Optional path to a brain artifact with the full content. */
    contentPath: string;
}
/**
 * Step-payload field 24 — model/provider error wrapper.
 *
 * Observed layout in real conversation DBs:
 *   24 → 3 → {
 *     2: provider summary,
 *     3: HTTP / stack diagnostic,
 *     5: structured response JSON,
 *     9: retry or final user-facing message
 *   }
 */
export interface ModelProviderError {
    summary: string;
    diagnostic: string;
    responseJson: string;
    userMessage: string;
}
/** The subagent metadata blob (from subagent_info / step payload field 127). */
export interface SubagentInfo {
    conversationId: string;
    logUri: string;
    role?: string;
    type?: string;
}
/**
 * Step-payload field 114 — task_notification / system message wrapper.
 * Field numbers from observed conversation DBs:
 *   1 = message string ([Message] timestamp=... sender=... content=...)
 *   2 = details / status
 *   3 = notification type ("task_notification" / etc.)
 */
export interface TaskNotification {
    message: string;
    details?: string;
    type?: string;
}
/** The blob in the `task_details` column. */
export interface TaskDetails {
    taskId: string;
    logUri: string;
    description: string;
}
/** The blob in the `step_payload` column. Step-type meaning:
 *  5,7,8,9,17,21,33,101,127,138 = tool run; 15 = agent text; 23 = title update. */
export interface StepPayload {
    validityCheck: number;
    toolRun: ToolRun | undefined;
    writeFile: WriteFileResult | undefined;
    grepSearch: GrepSearchResult | undefined;
    viewFile: ViewFileResult | undefined;
    listDirectory: ListDirectoryResult | undefined;
    userPrompt: UserPrompt | undefined;
    agentText: AgentText | undefined;
    titleUpdate: TitleUpdate | undefined;
    commandResult: CommandResult | undefined;
    webSearch: WebSearchResult | undefined;
    urlContent: UrlContentResult | undefined;
    modelProviderError: ModelProviderError | undefined;
    subagentInfo: SubagentInfo | undefined;
    taskNotification: TaskNotification | undefined;
}
/**
 * Strip leading non-text bytes sometimes present before command output text
 * (truncation metadata / control chars from the wire format).
 */
export declare function sanitizeCommandOutput(raw: string): string;
export declare function decodeTaskDetails(bytes: Uint8Array): TaskDetails;
export declare function decodeSubagentInfo(bytes: Uint8Array): SubagentInfo;
export declare function decodeTaskNotification(bytes: Uint8Array): TaskNotification;
export declare function decodeStepPayload(bytes: Uint8Array): StepPayload;
