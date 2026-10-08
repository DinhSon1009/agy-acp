import type { SessionState } from "./types.js";
export declare function cancelQueuedPrompts(session: SessionState): void;
export declare function handleCancel(sessionId: string, sessions: Map<string, SessionState>, meta?: Record<string, unknown> | null): Promise<void>;
