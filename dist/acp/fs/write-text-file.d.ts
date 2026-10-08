import type { AgentContext as V1AgentContext } from "@agentclientprotocol/sdk";
export declare function writeTextFile(client: V1AgentContext, sessionId: string, path: string, content: string): Promise<void>;
