import { decodeSubagentInfo, decodeTaskDetails, type SubagentInfo, type TaskDetails } from "./step-payload.js";
export interface ErrorDetails {
    /** Short, user-facing summary (e.g. "User denied permission for command(...)"). */
    message: string;
    /** The underlying error detail / stderr. */
    detail: string;
    /** Full error with attached stack trace. */
    stackTrace: string;
}
/** error_details: { 1: message, 2: detail, 3: stackTrace }.
 *  `message` is sometimes absent (e.g. cancellations); callers should fall
 *  back to `detail`. */
export declare function decodeErrorDetails(bytes: Uint8Array): ErrorDetails;
export interface PermissionInfo {
    /** The permission category, e.g. "command". */
    kind: string;
    /** The target the agent asked permission for, e.g. the command string. */
    value: string;
    /** Raw decision varint as stored by agy (semantics not fully specified). */
    decision: number;
}
/** permissions: { 2: { 1: { 1: kind, 2: value }, 2: decision } }.
 *  Returns null when no permission entry is present. */
export declare function decodePermissions(bytes: Uint8Array): PermissionInfo | null;
export { decodeSubagentInfo, decodeTaskDetails };
export type { SubagentInfo, TaskDetails };
