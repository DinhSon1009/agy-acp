import type { SessionConfigOption as V1SessionConfigOption } from "@agentclientprotocol/sdk";
export declare const NO_REASONING_VALUE = "none";
export declare function defaultReasoningEffortForBase(selectedBaseModel: string, catalog: ModelCatalog): string;
export interface ModelCatalog {
    readonly entries: readonly string[];
    baseModels(): string[];
    effortsFor(baseModel: string): string[];
    resolve(baseModel: string, reasoningEffort: string): string;
    split(fullModel: string): {
        base: string;
        reasoningEffort?: string;
    };
    /** Map a legacy agy display name (or base slug) to its ACP model slug, if known. */
    slugForAgyBase(agyBase: string): string | undefined;
    /** Map a display name, slug, or legacy base string to its ACP model slug. */
    resolveBaseModelSlug(nameOrSlug: string): string | undefined;
    /**
     * Value for `agy --model`: base slug (modern) or legacy display base name.
     * Effort is passed separately via `--effort`.
     */
    agyBaseName(slug: string): string;
    /** Human-readable label for the model picker. */
    displayName(slug: string): string;
}
export declare function buildModelCatalog(entries: string[]): ModelCatalog;
export declare function modelConfigOption(selectedBaseModel: string, catalog: ModelCatalog): V1SessionConfigOption;
export declare function reasoningEffortConfigOption(selectedBaseModel: string, selectedReasoningEffort: string, catalog: ModelCatalog): V1SessionConfigOption;
export declare function reasoningEffortValues(selectedBaseModel: string, catalog: ModelCatalog): string[];
export declare function toModelSlug(model: string): string;
export declare function prettifyModelSlug(slug: string): string;
