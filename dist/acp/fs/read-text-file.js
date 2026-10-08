// ACP fs/read_text_file: ask the client to read a file, so its own buffer/view
// (e.g. an editor's open document) is the source of truth for later diffing.
// Docs: https://agentclientprotocol.com/protocol/v1/file-system#reading-files
import * as v1 from "@agentclientprotocol/sdk";
export async function readTextFile(client, sessionId, path) {
    await client.request(v1.methods.client.fs.readTextFile, { sessionId, path });
}
//# sourceMappingURL=read-text-file.js.map