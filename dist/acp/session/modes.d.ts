import type { SessionConfigOption as V1SessionConfigOption, SessionModeState } from "@agentclientprotocol/sdk";
import type { SessionModeId } from "../../agy/cli.js";
export declare const MODE_CONFIG_ID = "mode";
/** Shared labels/descriptions for config option `mode` and native ACP session modes. */
export declare const AGY_MODE_OPTIONS: ReadonlyArray<{
    value: SessionModeId;
    name: string;
    description: string;
}>;
/** Native ACP session mode state (v1 `modes` on new/load/resume). Same ids as config `mode`. */
export declare function sessionModeState(mode: SessionModeId): SessionModeState;
export declare function modeConfigOption(mode: SessionModeId): V1SessionConfigOption;
