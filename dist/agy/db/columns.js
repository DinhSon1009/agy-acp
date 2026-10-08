// Decoders for the auxiliary `steps` columns that sit alongside `step_payload`:
// `error_details`, `permissions`, and `task_details`. Like step-payload.ts,
// these are protobuf blobs with no published schema; the field numbers were
// determined by inspecting real agy conversation databases. `permissions` in
// particular is nested three levels deep (entry -> target -> kind/value).
import { readInt, readMessage, readSubmessage } from "./protowire.js";
import { decodeSubagentInfo, decodeTaskDetails } from "./step-payload.js";
/** error_details: { 1: message, 2: detail, 3: stackTrace }.
 *  `message` is sometimes absent (e.g. cancellations); callers should fall
 *  back to `detail`. */
export function decodeErrorDetails(bytes) {
    return readMessage(bytes, { message: "", detail: "", stackTrace: "" }, {
        1: (m, r) => (m.message = r.string()),
        2: (m, r) => (m.detail = r.string()),
        3: (m, r) => (m.stackTrace = r.string())
    });
}
function decodePermissionTarget(bytes) {
    return readMessage(bytes, { kind: "", value: "" }, {
        1: (m, r) => (m.kind = r.string()),
        2: (m, r) => (m.value = r.string())
    });
}
function decodePermissionEntry(bytes) {
    return readMessage(bytes, { target: undefined, decision: 0 }, {
        1: (m, r) => (m.target = readSubmessage(r, decodePermissionTarget)),
        2: (m, r) => (m.decision = readInt(r))
    });
}
/** permissions: { 2: { 1: { 1: kind, 2: value }, 2: decision } }.
 *  Returns null when no permission entry is present. */
export function decodePermissions(bytes) {
    let entry;
    readMessage(bytes, {}, {
        2: (_msg, r) => (entry = readSubmessage(r, decodePermissionEntry))
    });
    if (!entry)
        return null;
    return {
        kind: entry.target?.kind ?? "",
        value: entry.target?.value ?? "",
        decision: entry.decision
    };
}
export { decodeSubagentInfo, decodeTaskDetails };
//# sourceMappingURL=columns.js.map