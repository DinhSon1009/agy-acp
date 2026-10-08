// ACP session/list handler: list persisted session bindings from disk store.
// Docs: https://agentclientprotocol.com/protocol/v1/session-list
export async function handleListSessions(params = {}, store) {
    const listed = await store.list({ cwd: params.cwd ?? null });
    return {
        sessions: listed.map((entry) => ({
            sessionId: entry.sessionId,
            cwd: entry.cwd,
            additionalDirectories: entry.additionalDirectories,
            updatedAt: entry.updatedAt
        }))
    };
}
//# sourceMappingURL=list.js.map