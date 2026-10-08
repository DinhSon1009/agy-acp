import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { type UpdateContext } from "./tool-call-updates.js";
import type { StepRow } from "./types.js";
export type { UpdateContext } from "./tool-call-updates.js";
/**
 * Step types recorded by agy for its own bookkeeping, with no user-facing ACP
 * representation:
 *   90  ephemeral_message    — system reminders injected into model context
 *   98  conversation_history — prior-conversation summaries injected as context
 *   101 stop_hook            — termination/auto-proceed decisions
 */
export declare const LIFECYCLE_STEP_TYPES: Set<number>;
/**
 * Translate one conversation step into an ACP update. Step-type map:
 *   14            user prompt            -> user_message_chunk
 *   15            agent text chunk       -> agent_message_chunk
 *   23            title update           -> session_info_update (+ think)
 *   5             file edit              -> tool_call (edit)
 *   17            mixed artifact tools   -> routed by tool name (or skipped)
 *   8, 9          view_file / list_dir   -> tool_call (read)
 *   7, 33         grep / web search      -> tool_call (search)
 *   21            run_command            -> tool_call (execute)
 *   31            read_url_content       -> tool_call (fetch)
 *   127           invoke_subagent        -> tool_call (other)
 *   138           ask_question           -> tool_call (other)
 *   132           orchestration tools    -> tool_call (generic fallback)
 *   90, 98, 101   lifecycle/system       -> null (skipped)
 *   default       unknown tool step      -> tool_call (generic) or null
 */
export declare function sessionUpdateFromStep(stepRow: StepRow, ctx?: UpdateContext): SessionUpdate | SessionUpdate[] | null;
