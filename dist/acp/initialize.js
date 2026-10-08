// ACP `initialize` handshake: negotiate protocol version and advertise capabilities.
// Docs: https://agentclientprotocol.com/protocol/v1/initialization
import * as v1 from "@agentclientprotocol/sdk";
import * as v2 from "@agentclientprotocol/sdk/experimental/v2";
import { v1AuthMethods, v2AuthMethods } from "../agy/auth.js";
const AGENT_INFO = { name: "agy-acp", title: "Google Antigravity CLI" };
export function parseClientToolCallName(rawCaps, defaultEnabled = false) {
    if (!rawCaps || typeof rawCaps !== "object")
        return { name: defaultEnabled };
    const caps = rawCaps;
    const clientCaps = caps.clientCapabilities ??
        caps.capabilities ??
        caps;
    const capabilityMeta = clientCaps._meta ??
        caps._meta;
    const nestedToolCall = clientCaps.toolCall ??
        clientCaps.tool_call;
    const toolCallName = clientCaps.toolCallName ??
        clientCaps.tool_call_name ??
        nestedToolCall?.name ??
        clientCaps.unstable_toolCallName ??
        clientCaps.unstable_tool_call_name ??
        clientCaps.unstable?.toolCallName ??
        clientCaps.unstable?.tool_call_name ??
        capabilityMeta?.toolCallName ??
        capabilityMeta?.tool_call_name;
    if (typeof toolCallName === "boolean")
        return { name: toolCallName };
    if (toolCallName && typeof toolCallName === "object") {
        return { name: Boolean(toolCallName.name ?? true) };
    }
    return { name: defaultEnabled };
}
function parseClientElicitation(rawCaps) {
    if (!rawCaps || typeof rawCaps !== "object")
        return { form: false, url: false };
    const caps = rawCaps;
    const elicitation = (caps.elicitation ?? caps.clientCapabilities?.elicitation ?? caps.capabilities?.elicitation);
    if (!elicitation || typeof elicitation !== "object")
        return { form: false, url: false };
    return {
        form: Boolean(elicitation.form != null && typeof elicitation.form === "object"),
        url: Boolean(elicitation.url != null && typeof elicitation.url === "object")
    };
}
/** v1 `initialize`: also returns the client's advertised `fs`, `elicitation`, and `toolCallName` capabilities. */
export function handleInitializeV1(params, agentVersion) {
    return {
        clientFs: {
            readTextFile: params.clientCapabilities?.fs?.readTextFile ?? false,
            writeTextFile: params.clientCapabilities?.fs?.writeTextFile ?? false
        },
        clientElicitation: parseClientElicitation(params.clientCapabilities),
        clientToolCallName: parseClientToolCallName(params.clientCapabilities, false),
        response: {
            protocolVersion: params.protocolVersion === v1.PROTOCOL_VERSION ? params.protocolVersion : v1.PROTOCOL_VERSION,
            agentCapabilities: {
                loadSession: true,
                promptCapabilities: {
                    image: true,
                    audio: false,
                    embeddedContext: true
                },
                mcpCapabilities: {
                    http: false,
                    sse: false,
                    acp: false
                },
                sessionCapabilities: {
                    list: {},
                    additionalDirectories: {},
                    resume: {},
                    close: {},
                    fork: {}
                },
                auth: {
                    logout: {}
                },
                toolCallName: {}
            },
            authMethods: v1AuthMethods(),
            agentInfo: { ...AGENT_INFO, version: agentVersion }
        }
    };
}
export function handleInitializeV2(params, agentVersion) {
    return {
        clientElicitation: parseClientElicitation(params),
        clientToolCallName: parseClientToolCallName(params, true),
        response: {
            protocolVersion: params.protocolVersion === v2.PROTOCOL_VERSION ? params.protocolVersion : v2.PROTOCOL_VERSION,
            info: { ...AGENT_INFO, version: agentVersion },
            // Advertising `session` commits to the v2 baseline methods (new/list/resume/close/prompt/cancel/update).
            capabilities: {
                session: {
                    prompt: {
                        image: {},
                        embeddedContext: {}
                    },
                    additionalDirectories: {},
                    fork: {}
                },
                auth: {},
                toolCallName: {},
                _meta: {
                    toolCallName: {}
                }
            },
            // Non-empty authMethods commits the agent to auth/login + auth/logout.
            authMethods: v2AuthMethods()
        }
    };
}
//# sourceMappingURL=initialize.js.map