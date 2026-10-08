// Read-only access to agy's per-conversation SQLite databases.
//
// A `ConversationDb` keeps one DB handle + prepared statement open so the
// streaming poll loop can read repeatedly without re-opening the file each
// tick. One-shot `readRows` is provided for replay, where a single read is all
// that's needed.
import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { decodeErrorDetails, decodePermissions, decodeSubagentInfo, decodeTaskDetails } from "./columns.js";
import { decodeGenMetadata } from "./gen-metadata.js";
import { decodeStepPayload } from "./step-payload.js";
const SELECT_ROWS = "SELECT idx, step_type, status, step_payload, error_details, permissions, task_details " +
    "FROM steps WHERE idx > ? ORDER BY idx";
function toUint8(v) {
    if (v instanceof Uint8Array)
        return v;
    if (Buffer.isBuffer(v))
        return new Uint8Array(v);
    return new Uint8Array(0);
}
/** Decode an optional blob column, returning null when absent/empty. */
function decodeColumn(v, decode) {
    const bytes = toUint8(v);
    return bytes.length === 0 ? null : decode(bytes);
}
function rowToStep(r) {
    return {
        idx: r.idx,
        stepType: r.step_type,
        status: r.status ?? 0,
        stepPayload: decodeStepPayload(toUint8(r.step_payload)),
        error: decodeColumn(r.error_details, decodeErrorDetails),
        permission: decodeColumn(r.permissions, decodePermissions),
        task: decodeColumn(r.task_details, decodeTaskDetails),
        subagent: decodeColumn(r.subagent_details, decodeSubagentInfo)
    };
}
export function conversationDbPath(dir, id) {
    return path.join(dir, `${id}.db`);
}
/** Known wal-index format version (WalIndexHdr.iVersion). */
const WAL_INDEX_VERSION = 3007000;
/** Read committed WAL state from the wal-index (`-shm`) header, or null when
 *  absent/short/unparseable. Fixed 48-byte read; never reads the WAL itself. */
function readWalIndexState(shmPath) {
    try {
        const fd = fs.openSync(shmPath, "r");
        try {
            const buf = Buffer.alloc(48);
            if (fs.readSync(fd, buf, 0, 48, 0) !== 48)
                return null;
            // The wal-index uses the writer's native byte order; detect it via the
            // known iVersion constant at offset 0.
            const little = buf.readUInt32LE(0) === WAL_INDEX_VERSION;
            if (!little && buf.readUInt32BE(0) !== WAL_INDEX_VERSION)
                return null;
            const u32 = (off) => (little ? buf.readUInt32LE(off) : buf.readUInt32BE(off));
            return { mxFrame: u32(16), frameCksum0: u32(24), frameCksum1: u32(28) };
        }
        finally {
            fs.closeSync(fd);
        }
    }
    catch {
        return null;
    }
}
/** Stat a conversation DB, or null if it doesn't exist. */
export function statConversation(dir, id) {
    const dbPath = conversationDbPath(dir, id);
    try {
        const s = fs.statSync(dbPath);
        let walMtimeMs;
        let walSize;
        let walMxFrame;
        let walFrameCksum0;
        let walFrameCksum1;
        try {
            const ws = fs.statSync(`${dbPath}-wal`);
            walMtimeMs = ws.mtimeMs;
            walSize = ws.size;
            const walIndex = readWalIndexState(`${dbPath}-shm`);
            if (walIndex) {
                walMxFrame = walIndex.mxFrame;
                walFrameCksum0 = walIndex.frameCksum0;
                walFrameCksum1 = walIndex.frameCksum1;
            }
        }
        catch {
            // no wal file
        }
        let journalMtimeMs;
        let journalSize;
        try {
            const js = fs.statSync(`${dbPath}-journal`);
            journalMtimeMs = js.mtimeMs;
            journalSize = js.size;
        }
        catch {
            // no journal file
        }
        let changeCounter = 0;
        try {
            const fd = fs.openSync(dbPath, "r");
            try {
                const buf = Buffer.alloc(4);
                if (fs.readSync(fd, buf, 0, 4, 24) === 4) {
                    changeCounter = buf.readUInt32BE(0);
                }
            }
            finally {
                fs.closeSync(fd);
            }
        }
        catch {
            // ignore read errors
        }
        return {
            mtimeMs: s.mtimeMs,
            size: s.size,
            walMtimeMs,
            walSize,
            walMxFrame,
            walFrameCksum0,
            walFrameCksum1,
            journalMtimeMs,
            journalSize,
            changeCounter
        };
    }
    catch {
        return null;
    }
}
/** An open, reusable read handle on one conversation's steps and gen_metadata tables. */
export class ConversationDb {
    db;
    stmt;
    dataVersionStmt;
    genMetadataStmt;
    latestGenMetadataStmt;
    constructor(db, stmt, dataVersionStmt, genMetadataStmt, latestGenMetadataStmt) {
        this.db = db;
        this.stmt = stmt;
        this.dataVersionStmt = dataVersionStmt;
        this.genMetadataStmt = genMetadataStmt;
        this.latestGenMetadataStmt = latestGenMetadataStmt;
    }
    /** Open a conversation DB, or null if missing/unreadable or lacking a steps table. */
    static open(dir, id) {
        const dbPath = conversationDbPath(dir, id);
        if (!fs.existsSync(dbPath))
            return null;
        try {
            const db = new Database(dbPath, { readonly: true, fileMustExist: true });
            const hasSteps = db
                .prepare("SELECT COUNT(*) > 0 AS present FROM sqlite_master WHERE type='table' AND name='steps'")
                .get();
            if (!hasSteps?.present) {
                db.close();
                console.error(`[agy-acp] WARN: steps table not found in ${id}.db — schema changed?`);
                return null;
            }
            const columns = db.prepare("PRAGMA table_info(steps)").all();
            const columnNames = new Set(columns.map((c) => c.name));
            const subagentCol = columnNames.has("subagent_details")
                ? "subagent_details"
                : columnNames.has("subagent_info")
                    ? "subagent_info AS subagent_details"
                    : "NULL AS subagent_details";
            const selectQuery = `SELECT idx, step_type, status, step_payload, error_details, permissions, task_details, ${subagentCol} ` +
                "FROM steps WHERE idx > ? ORDER BY idx";
            const hasGenMetadata = db
                .prepare("SELECT COUNT(*) > 0 AS present FROM sqlite_master WHERE type='table' AND name='gen_metadata'")
                .get();
            const genMetadataStmt = hasGenMetadata?.present
                ? db.prepare("SELECT idx, data FROM gen_metadata WHERE idx > ? ORDER BY idx")
                : null;
            const latestGenMetadataStmt = hasGenMetadata?.present
                ? db.prepare("SELECT idx, data FROM gen_metadata ORDER BY idx DESC LIMIT 1")
                : null;
            return new ConversationDb(db, db.prepare(selectQuery), db.prepare("PRAGMA data_version"), genMetadataStmt, latestGenMetadataStmt);
        }
        catch {
            return null;
        }
    }
    /** Read decoded step rows with idx > afterStepIdx, in order.
     *
     * A row whose blob fails to decode (e.g. a torn read of a row agy is still
     * writing to) is logged and dropped rather than thrown — one bad row must
     * not take down the whole poll loop. Since it's dropped, not consumed, its
     * idx isn't advanced past, so it's naturally retried on the next read once
     * the write settles. */
    readAfter(afterStepIdx) {
        const rows = this.stmt.all(afterStepIdx);
        const out = [];
        let hasDecodeError = false;
        for (const r of rows) {
            try {
                out.push(rowToStep(r));
            }
            catch (error) {
                hasDecodeError = true;
                console.error(`[agy-acp] WARN: failed to decode step ${r.idx}, skipping: ${error.message}`);
            }
        }
        out.hasDecodeError = hasDecodeError;
        return out;
    }
    /** Read decoded gen_metadata entries with idx > afterIdx, in order. */
    readGenMetadataAfter(afterIdx) {
        if (!this.genMetadataStmt)
            return [];
        const rows = this.genMetadataStmt.all(afterIdx);
        const out = [];
        for (const r of rows) {
            try {
                const decoded = decodeGenMetadata(r.idx, toUint8(r.data));
                if (decoded)
                    out.push(decoded);
            }
            catch (error) {
                console.error(`[agy-acp] WARN: failed to decode gen_metadata ${r.idx}: ${error.message}`);
            }
        }
        return out;
    }
    /** Read the latest gen_metadata entry. */
    readLatestGenMetadata() {
        if (!this.latestGenMetadataStmt)
            return null;
        const row = this.latestGenMetadataStmt.get();
        if (!row)
            return null;
        try {
            return decodeGenMetadata(row.idx, toUint8(row.data));
        }
        catch {
            return null;
        }
    }
    /** SQLite generation counter, incremented when another connection commits. */
    dataVersion() {
        const row = this.dataVersionStmt.get();
        return row?.data_version ?? 0;
    }
    close() {
        this.db.close();
    }
}
/** One-shot read of decoded step rows with idx > afterStepIdx. Returns null if
 *  the DB is missing/unreadable. */
export function readRows(dir, id, afterStepIdx) {
    const conn = ConversationDb.open(dir, id);
    if (!conn)
        return null;
    try {
        return conn.readAfter(afterStepIdx);
    }
    finally {
        conn.close();
    }
}
/** One-shot read of the latest generation usage metrics. Returns null if missing/unreadable. */
export function readLatestSessionUsage(dir, id) {
    const conn = ConversationDb.open(dir, id);
    if (!conn)
        return null;
    try {
        return conn.readLatestGenMetadata();
    }
    finally {
        conn.close();
    }
}
//# sourceMappingURL=database.js.map