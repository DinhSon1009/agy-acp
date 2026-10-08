export interface ModelUsageStats {
    promptTokens: number;
    candidatesTokens: number;
    cachedTokens: number;
    thoughtTokens: number;
    contentTokens: number;
}
export interface GenMetadataUsage {
    idx: number;
    promptTokens: number;
    candidatesTokens: number;
    cachedTokens: number;
    thoughtTokens: number;
    contentTokens: number;
    totalInputTokens: number;
    totalTokens: number;
    contextWindowSize?: number;
    maxOutputTokens?: number;
    modelSlug?: string;
    modelDisplayName?: string;
}
export declare function decodeGenMetadata(idx: number, bytes: Uint8Array): GenMetadataUsage | null;
