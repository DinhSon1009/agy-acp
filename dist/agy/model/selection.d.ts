import type { AgyCliSession } from "../cli.js";
import { type ModelCatalog } from "./catalog.js";
export declare function initialModelSelection(configuredModel: string | undefined, catalog: ModelCatalog): {
    baseModel: string;
    reasoningEffort: string;
};
/** Like `initialModelSelection`, but for a persisted choice: falls back to the
 *  default selection if the model no longer appears in the current catalog. */
export declare function restoredModelSelection(storedModel: string, storedReasoningEffort: string, catalog: ModelCatalog): {
    baseModel: string;
    reasoningEffort: string;
};
export declare function applyModelSelection(agy: AgyCliSession, selectedBaseModel: string, selectedReasoningEffort: string, catalog: ModelCatalog): void;
