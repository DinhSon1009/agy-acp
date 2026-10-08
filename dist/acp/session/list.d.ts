import type { ListSessionsRequest, ListSessionsResponse } from "@agentclientprotocol/sdk/experimental/v2";
import type { SessionStore } from "./store.js";
export declare function handleListSessions(params: ListSessionsRequest | undefined, store: SessionStore): Promise<ListSessionsResponse>;
