// Model Catalog: resolution, slug helpers, and config options for agy --model and --effort.
const MODEL_CONFIG_ID = "model";
const REASONING_EFFORT_CONFIG_ID = "reasoningEffort";
export const NO_REASONING_VALUE = "none";
export function defaultReasoningEffortForBase(selectedBaseModel, catalog) {
    const effects = catalog.effortsFor(selectedBaseModel);
    return effects[0] ?? NO_REASONING_VALUE;
}
/** Legacy `agy models` lines: `Gemini 3.5 Flash (Medium)`. */
const LEGACY_EFFORT_PATTERN = /\((low|medium|high)\)\s*$/i;
/** Legacy thinking models: `Claude Sonnet 4.6 (Thinking)`. */
const LEGACY_THINKING_PATTERN = /\(thinking\)\s*$/i;
/** Stable slug effort variants from agy ≥1.1.5: `gemini-3.5-flash-medium`. */
const SLUG_EFFORT_PATTERN = /^(.*)-(low|medium|high)$/i;
/** Stable slug thinking models: `claude-opus-4-6-thinking` (not an --effort value). */
const SLUG_THINKING_PATTERN = /-thinking$/i;
function dedupe(values) {
    return [...new Set(values)];
}
export function buildModelCatalog(entries) {
    const uniqueEntries = dedupe(entries);
    const baseOrder = [];
    const effectsByBase = new Map();
    const agyBaseBySlug = new Map();
    const displayNameBySlug = new Map();
    for (const entry of uniqueEntries) {
        const { agyBase, base, reasoningEffort, displayBase } = splitModelEntry(entry);
        if (!effectsByBase.has(base)) {
            baseOrder.push(base);
            effectsByBase.set(base, []);
            agyBaseBySlug.set(base, agyBase);
            displayNameBySlug.set(base, displayBase);
        }
        if (reasoningEffort) {
            const effects = effectsByBase.get(base);
            if (!effects.includes(reasoningEffort)) {
                effects.push(reasoningEffort);
            }
        }
    }
    return {
        entries: uniqueEntries,
        baseModels: () => baseOrder,
        effortsFor: (baseModel) => effectsByBase.get(baseModel) ?? [],
        resolve: (baseModel, reasoningEffort) => {
            const resolved = uniqueEntries.find((entry) => {
                const parsed = splitModelEntry(entry);
                return parsed.base === baseModel && parsed.reasoningEffort === reasoningEffort;
            });
            if (!resolved) {
                throw new Error(`Unknown model selection: ${baseModel} (${reasoningEffort})`);
            }
            return resolved;
        },
        split: (fullModel) => {
            const { base, reasoningEffort } = splitModelEntry(fullModel);
            return { base, reasoningEffort };
        },
        slugForAgyBase: (agyBase) => {
            const slug = toModelSlug(agyBase);
            if (agyBaseBySlug.has(slug)) {
                return slug;
            }
            // Stored full variant slug (e.g. gemini-3.5-flash-medium) or display line.
            const fromEntry = splitModelEntry(agyBase);
            return agyBaseBySlug.has(fromEntry.base) ? fromEntry.base : undefined;
        },
        resolveBaseModelSlug: (nameOrSlug) => {
            if (baseOrder.includes(nameOrSlug)) {
                return nameOrSlug;
            }
            const matchInParens = nameOrSlug.match(/\(([^)]+)\)$/);
            if (matchInParens && baseOrder.includes(matchInParens[1])) {
                return matchInParens[1];
            }
            for (const [slug, display] of displayNameBySlug.entries()) {
                const optionName = display === slug ? display : `${display} (${slug})`;
                if (display === nameOrSlug || slug === nameOrSlug || optionName === nameOrSlug) {
                    return slug;
                }
            }
            const slugFromAgyBase = toModelSlug(nameOrSlug);
            if (baseOrder.includes(slugFromAgyBase)) {
                return slugFromAgyBase;
            }
            const fromEntry = splitModelEntry(nameOrSlug);
            if (baseOrder.includes(fromEntry.base)) {
                return fromEntry.base;
            }
            return undefined;
        },
        agyBaseName: (slug) => {
            const agyBase = agyBaseBySlug.get(slug);
            if (!agyBase) {
                throw new Error(`Unknown model slug: ${slug}`);
            }
            return agyBase;
        },
        displayName: (slug) => {
            const name = displayNameBySlug.get(slug);
            if (!name) {
                throw new Error(`Unknown model slug: ${slug}`);
            }
            return name;
        }
    };
}
export function modelConfigOption(selectedBaseModel, catalog) {
    const selectedSlug = catalog.resolveBaseModelSlug(selectedBaseModel) ?? selectedBaseModel;
    const currentName = catalog.displayName(selectedSlug);
    return {
        id: MODEL_CONFIG_ID,
        name: "Model",
        description: "ACP model slug passed to agy --model (reasoningEffort is selected separately).",
        category: "model",
        type: "select",
        currentValue: currentName,
        options: catalog.baseModels().map((slug) => {
            const name = catalog.displayName(slug);
            return {
                value: name,
                name: name
            };
        })
    };
}
export function reasoningEffortConfigOption(selectedBaseModel, selectedReasoningEffort, catalog) {
    const options = reasoningEffortOptions(selectedBaseModel, catalog);
    const currentOption = options.find((o) => o.value.toLowerCase() === selectedReasoningEffort.toLowerCase() ||
        o.name.toLowerCase() === selectedReasoningEffort.toLowerCase());
    return {
        id: REASONING_EFFORT_CONFIG_ID,
        name: "Reasoning Effort",
        description: "Value for agy --effort (low | medium | high) for the selected model.",
        category: "thought_level",
        type: "select",
        currentValue: currentOption?.value ?? selectedReasoningEffort,
        options
    };
}
function reasoningEffortOptions(selectedBaseModel, catalog) {
    const efforts = catalog.effortsFor(selectedBaseModel);
    if (efforts.length === 0) {
        return [{ value: NO_REASONING_VALUE, name: "N/A" }];
    }
    return efforts.map((effort) => {
        const name = effort.charAt(0).toUpperCase() + effort.slice(1);
        return {
            value: name,
            name: name
        };
    });
}
export function reasoningEffortValues(selectedBaseModel, catalog) {
    return reasoningEffortOptions(selectedBaseModel, catalog).map((option) => option.value);
}
/** Split one `agy models` line into base model + optional effort. */
function splitModelEntry(model) {
    const trimmed = model.trim();
    // Two-column output from modern `agy models`: `gemini-3.6-flash-high   Gemini 3.6 Flash (High)`
    const twoColMatch = trimmed.match(/^([a-z0-9_.-]+)\s+(.+)$/);
    if (twoColMatch) {
        const col1 = twoColMatch[1];
        const col2 = twoColMatch[2].trim();
        const slugEffort = col1.match(SLUG_EFFORT_PATTERN);
        if (slugEffort && isLikelyModelSlug(col1)) {
            const base = toModelSlug(slugEffort[1]);
            const displayBase = col2.replace(LEGACY_EFFORT_PATTERN, "").trim();
            return {
                agyBase: base,
                base,
                displayBase,
                reasoningEffort: slugEffort[2].toLowerCase()
            };
        }
        const legacyEffort = col2.match(LEGACY_EFFORT_PATTERN);
        if (legacyEffort && legacyEffort.index !== undefined) {
            const base = toModelSlug(col1);
            const displayBase = col2.slice(0, legacyEffort.index).trim();
            return {
                agyBase: base,
                base,
                displayBase,
                reasoningEffort: legacyEffort[1].toLowerCase()
            };
        }
        const base = toModelSlug(col1);
        return {
            agyBase: base,
            base,
            displayBase: col2
        };
    }
    if (LEGACY_THINKING_PATTERN.test(trimmed)) {
        const base = toModelSlug(trimmed);
        return { agyBase: trimmed, base, displayBase: trimmed };
    }
    const legacyEffort = trimmed.match(LEGACY_EFFORT_PATTERN);
    if (legacyEffort && legacyEffort.index !== undefined) {
        const displayBase = trimmed.slice(0, legacyEffort.index).trim();
        return {
            agyBase: displayBase,
            base: toModelSlug(displayBase),
            displayBase,
            reasoningEffort: legacyEffort[1].toLowerCase()
        };
    }
    if (SLUG_THINKING_PATTERN.test(trimmed)) {
        const base = toModelSlug(trimmed);
        return {
            agyBase: base,
            base,
            displayBase: prettifyModelSlug(base)
        };
    }
    const slugEffort = trimmed.match(SLUG_EFFORT_PATTERN);
    if (slugEffort && isLikelyModelSlug(trimmed)) {
        const base = toModelSlug(slugEffort[1]);
        return {
            agyBase: base,
            base,
            displayBase: prettifyModelSlug(base),
            reasoningEffort: slugEffort[2].toLowerCase()
        };
    }
    const base = toModelSlug(trimmed);
    const looksLikeSlug = isLikelyModelSlug(trimmed) || trimmed === base;
    return {
        agyBase: looksLikeSlug ? base : trimmed,
        base,
        displayBase: looksLikeSlug ? prettifyModelSlug(base) : trimmed
    };
}
export function toModelSlug(model) {
    return model
        .toLowerCase()
        .replace(/[()]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}
function isLikelyModelSlug(value) {
    return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(value.trim()) && !/\s/.test(value);
}
export function prettifyModelSlug(slug) {
    const parts = slug.split("-").filter(Boolean);
    const merged = [];
    for (const part of parts) {
        if (/^\d+$/.test(part) && merged.length > 0 && /^\d+(?:\.\d+)*$/.test(merged[merged.length - 1])) {
            merged[merged.length - 1] = `${merged[merged.length - 1]}.${part}`;
            continue;
        }
        if (/^\d+(?:\.\d+)*$/.test(part)) {
            merged.push(part);
            continue;
        }
        if (part.toLowerCase() === "gpt" || part.toLowerCase() === "oss") {
            merged.push(part.toUpperCase());
            continue;
        }
        merged.push(part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    }
    return merged.join(" ");
}
//# sourceMappingURL=catalog.js.map