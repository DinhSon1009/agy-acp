import * as v1 from "@agentclientprotocol/sdk";
import * as v2 from "@agentclientprotocol/sdk/experimental/v2";
import { parseAskQuestion } from "./permissions.js";
/** Send `elicitation/complete` notification to v1 client when a URL elicitation completes. */
export async function notifyElicitationCompleteV1(client, elicitationId) {
    await client.notify(v1.methods.client.elicitation.complete, { elicitationId });
}
/** Send `elicitation/complete` notification to v2 client when a URL elicitation completes. */
export async function notifyElicitationCompleteV2(client, elicitationId) {
    await client.notify(v2.methods.client.elicitation.complete, { elicitationId });
}
function sanitizePtyText(value) {
    return String(value)
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}
function toolRawInput(toolCall) {
    const raw = toolCall;
    return raw.rawInput && typeof raw.rawInput === "object" && !Array.isArray(raw.rawInput)
        ? raw.rawInput
        : {};
}
function pickString(input, ...keys) {
    for (const key of keys) {
        const value = input[key];
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return undefined;
}
/** Parse all questions inside ask_question toolCall payload. */
export function parseAskQuestionFull(toolCall) {
    const input = toolRawInput(toolCall);
    const questionsRaw = input.questions ?? input.Questions;
    const questionsList = Array.isArray(questionsRaw) ? questionsRaw : [];
    if (questionsList.length === 0) {
        const fallback = parseAskQuestion(toolCall);
        if (!fallback)
            return null;
        return {
            question: fallback.question,
            questionCount: fallback.questionCount,
            items: [
                {
                    question: fallback.question,
                    options: fallback.options,
                    multiSelect: fallback.multiSelect
                }
            ]
        };
    }
    const items = [];
    for (const entryRaw of questionsList) {
        if (!entryRaw || typeof entryRaw !== "object" || Array.isArray(entryRaw))
            continue;
        const entry = entryRaw;
        const question = pickString(entry, "question", "Question") ??
            String(toolCall.title ?? "Question");
        const optionsRaw = entry.options ?? entry.Options;
        const optionsList = Array.isArray(optionsRaw) ? optionsRaw : [];
        const options = optionsList
            .map((opt) => {
            if (typeof opt === "string")
                return opt.trim();
            if (opt && typeof opt === "object" && !Array.isArray(opt)) {
                return pickString(opt, "label", "Label", "text", "Text", "id", "Id") ?? "";
            }
            return "";
        })
            .filter(Boolean);
        const multiSelect = Boolean(entry.is_multi_select ?? entry.isMultiSelect ?? entry.IsMultiSelect);
        items.push({ question, options, multiSelect });
    }
    if (items.length === 0)
        return null;
    return {
        question: items[0].question,
        questionCount: items.length,
        items
    };
}
/** Build elicitation/create params for an ask_question tool call. */
/** Build elicitation/create params for an ask_question tool call. */
export function buildElicitationRequestFromAskQuestion(toolCall, sessionId, questionIndex = 0) {
    const parsed = parseAskQuestionFull(toolCall);
    if (!parsed || parsed.items.length === 0)
        return null;
    const raw = toolCall;
    const toolCallId = typeof raw.toolCallId === "string" ? raw.toolCallId : undefined;
    const qIdx = questionIndex >= 0 && questionIndex < parsed.items.length ? questionIndex : 0;
    const item = parsed.items[qIdx];
    const properties = {};
    const required = [];
    const key = `q${qIdx}`;
    required.push(key);
    if (item.options.length > 0 && !item.multiSelect) {
        properties[key] = {
            type: "string",
            title: item.question,
            oneOf: item.options.map((opt) => ({ const: opt, title: opt }))
        };
    }
    else if (item.options.length > 0 && item.multiSelect) {
        properties[key] = {
            type: "array",
            title: item.question,
            items: {
                anyOf: item.options.map((opt) => ({ const: opt, title: opt }))
            }
        };
    }
    else {
        // Free-text input
        properties[key] = {
            type: "string",
            title: item.question
        };
    }
    const message = parsed.items.length > 1
        ? `[Question ${qIdx + 1}/${parsed.items.length}] ${item.question}`
        : item.question;
    return {
        sessionId,
        toolCallId,
        mode: "form",
        message,
        requestedSchema: {
            type: "object",
            properties,
            required
        }
    };
}
/** Convert user elicitation submission into PTY keys for ask_question. */
export function encodeElicitationKeys(toolCall, content, questionIndex = 0) {
    if (!content)
        return "\x1b";
    const parsed = parseAskQuestionFull(toolCall);
    if (!parsed || parsed.items.length === 0)
        return null;
    const qIdx = questionIndex >= 0 && questionIndex < parsed.items.length ? questionIndex : 0;
    const item = parsed.items[qIdx];
    const key = `q${qIdx}`;
    const val = content[key] ?? content[item.question] ?? content["q0"] ?? content["q"];
    if (val == null)
        return "\x1b";
    if (item.options.length > 0 && !item.multiSelect) {
        const strVal = sanitizePtyText(val).trim();
        let index = item.options.findIndex((opt) => opt === strVal);
        if (index === -1) {
            const num = Number(strVal);
            if (!isNaN(num) && num >= 0 && num < item.options.length) {
                index = num;
            }
        }
        if (index >= 0) {
            return `${"\x1b[B".repeat(index)}\r`;
        }
        else {
            return `${strVal}\r`;
        }
    }
    else if (item.options.length > 0 && item.multiSelect) {
        const selected = Array.isArray(val) ? val.map(String) : [String(val)];
        const selectedIndices = new Set();
        for (const sel of selected) {
            const idx = item.options.findIndex((opt) => opt === sel.trim());
            if (idx >= 0)
                selectedIndices.add(idx);
            else {
                const num = Number(sel);
                if (!isNaN(num) && num >= 0 && num < item.options.length) {
                    selectedIndices.add(num);
                }
            }
        }
        if (selectedIndices.size === 0) {
            return "\r";
        }
        else {
            let keys = "";
            const maxIdx = Math.max(...selectedIndices);
            for (let k = 0; k <= maxIdx; k++) {
                if (selectedIndices.has(k)) {
                    keys += " ";
                }
                if (k < maxIdx) {
                    keys += "\x1b[B";
                }
            }
            keys += "\r";
            return keys;
        }
    }
    else {
        const textVal = sanitizePtyText(val);
        return `${textVal}\r`;
    }
}
//# sourceMappingURL=elicitation.js.map