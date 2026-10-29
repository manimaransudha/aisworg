import pkg from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import * as dotenv from "dotenv";
import path from "path";
import {logger} from "./logger.js";

const {Pool, types} = pkg;

types.setTypeParser(1700, (val) => parseFloat(val));
types.setTypeParser(20, (val) => parseInt(val, 10));
types.setTypeParser(1082, (val) => val);
types.setTypeParser(1114, (val: string | Date) => (typeof val === 'string') ? new Date(val + 'Z').toISOString() : (val instanceof Date ? val.toISOString() : val));
types.setTypeParser(1184, (val: string | Date) => (typeof val === 'string') ? new Date(val).toISOString() : (val instanceof Date ? val.toISOString() : val));

if (!process.env.DATABASE_URL) {
    dotenv.config({path: path.join(process.cwd(), "src/.env")});
}

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
}

const pool = new Pool({
    connectionString: connectionString,
    max: parseInt(process.env.MAX_CONNECTIONS ?? "", 10) || 10,
    connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT ?? "", 10) || 60000,
    idleTimeoutMillis: 20000,
    keepAlive: true,
    keepAliveInitialDelayMillis: parseInt(process.env.DB_KEEPALIVE_DELAY ?? "", 10) || 10000,
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT ?? "", 10) || 60000,
    allowExitOnIdle: true
});

pool.on("error", (err) => {
    logger.error("Unexpected PG error", err);
});

// DB_POOL_TRACE=1 logs this process's pool usage so connection exhaustion can be traced to a caller and a test file.
// Every line carries the process id and the entry file (the test file under node --test) with the pool's
// total/idle/waiting counts. A query is logged when it had to wait for a connection or when it failed.
if (process.env.DB_POOL_TRACE) {
    const tag = () => `[poolTrace pid=${process.pid} ${path.basename(process.argv[1] ?? "?")}] total=${pool.totalCount}/${pool.options.max} idle=${pool.idleCount} waiting=${pool.waitingCount}`;
    const caller = () => (new Error().stack ?? "").split("\n").slice(2).map((l) => l.trim()).find((l) => /\/src\/(dblayer|routes|domain)\//.test(l) && !l.includes("utils/db.ts")) ?? "(no src frame)";
    pool.on("connect", () => logger.info(`${tag()} event=connect`));
    pool.on("remove", () => logger.info(`${tag()} event=remove`));
    const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
    (pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = (...args: unknown[]) => {
        const at = caller();
        const waited = pool.waitingCount > 0 || pool.idleCount === 0;
        if (waited) logger.info(`${tag()} event=query-no-idle caller=${at}`);
        return originalQuery(...args).catch((err: unknown) => {
            logger.error(`${tag()} event=query-failed caller=${at} message=${(err as Error).message}`);
            throw err;
        });
    };
    const originalConnect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
    (pool as unknown as { connect: (...args: unknown[]) => unknown }).connect = (...args: unknown[]) => {
        logger.info(`${tag()} event=client-checkout caller=${caller()}`);
        return originalConnect(...args);
    };
}


// Lookup memo (opt-in, seed runs only). Inside `withLookupMemo`, an identical read-only SELECT is answered from memory
// after its first execution, so a seed run loads each lookup list once instead of repeating the round trip.
// Every other statement that passes through this process while the memo is active, whether it goes through `query`,
// `bulkInsert` or a client taken from the pool, drops the entries that read the table it writes. A statement the memo
// cannot classify, and a ROLLBACK, drop everything. Code outside the scope always reads the database.
type LookupMemo = Map<string, { sql: string; result: Promise<QueryResult<QueryResultRow>> }>;
const lookupMemo = new AsyncLocalStorage<LookupMemo>();
const NOT_MEMOISABLE = /\bfor\s+(update|share)\b|nextval|currval|lastval|random\s*\(|now\s*\(|clock_timestamp|statement_timestamp|current_timestamp|pg_advisory|txid_current/i;
const WRITE_TARGET = /^\s*(?:insert\s+into|update|delete\s+from|truncate(?:\s+table)?)\s+(?:only\s+)?"?([a-z0-9_]+)"?/i;

const memoisable = (text: string): boolean => /^\s*select\b/i.test(text) && !NOT_MEMOISABLE.test(text);

function noteStatement(text: string): void {
    const memo = lookupMemo.getStore();
    if (!memo || memoisable(text) || /^\s*select\b/i.test(text)) return;
    if (/^\s*(begin|commit|start\s+transaction|savepoint|release|set)\b/i.test(text)) return;
    const target = WRITE_TARGET.exec(text)?.[1];
    if (!target || /^\s*with\b/i.test(text)) {
        memo.clear();
        return;
    }
    const mentions = new RegExp(`\\b${target}\\b`, "i");
    for (const [key, entry] of memo) if (mentions.test(entry.sql)) memo.delete(key);
}

// True while the current async context runs inside `withLookupMemo` (a seed run).
export const isLookupMemoActive = (): boolean => lookupMemo.getStore() !== undefined;

export function withLookupMemo<T>(work: () => Promise<T>): Promise<T> {
    return lookupMemo.run(new Map(), work);
}

function runStatement<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const memo = lookupMemo.getStore();
    if (!memo || !memoisable(text)) {
        const done = executor().query<T>(text, params);
        return memo ? done.then((r) => { noteStatement(text); return r; }) : done;
    }
    const key = `${text}\u0000${JSON.stringify(params ?? [])}`;
    let entry = memo.get(key);
    if (!entry) {
        entry = { sql: text, result: executor().query<T>(text, params) as Promise<QueryResult<QueryResultRow>> };
        memo.set(key, entry);
        entry.result.catch(() => memo.delete(key));
    }
    return entry.result.then((r) => ({ ...r, rows: structuredClone(r.rows) }) as unknown as QueryResult<T>);
}

// A write made through a client taken straight from the pool still invalidates the memo.
const poolConnect = pool.connect.bind(pool) as (...args: unknown[]) => Promise<PoolClient>;
(pool as unknown as { connect: (...args: unknown[]) => Promise<PoolClient> }).connect = (...args: unknown[]) => {
    // pg-pool's own pool.query uses the callback form; it is left as it is.
    if (typeof args[0] === "function") return poolConnect(...args);
    return poolConnect(...args).then(noteClient);
};
function noteClient(client: PoolClient): PoolClient {
    const flagged = client as PoolClient & { __memoNotes?: true };
    if (!flagged.__memoNotes) {
        flagged.__memoNotes = true;
        const clientQuery = client.query.bind(client) as (...a: unknown[]) => Promise<unknown>;
        (client as unknown as { query: (...a: unknown[]) => Promise<unknown> }).query = (...a: unknown[]) => {
            const out = clientQuery(...a);
            const text = typeof a[0] === "string" ? a[0] : (a[0] as { text?: string } | undefined)?.text;
            if (text && out && typeof (out as Promise<unknown>).then === "function") {
                return (out as Promise<unknown>).then((r) => {
                    if (/^\s*rollback\b/i.test(text)) lookupMemo.getStore()?.clear();
                    else noteStatement(text);
                    return r;
                });
            }
            return out;
        };
    }
    return client;
}

export default pool;
// The connection of the transaction running in the current async context, if any (CR-128).
const transactionClient = new AsyncLocalStorage<PoolClient>();
const executor = (): Pick<PoolClient, "query"> => transactionClient.getStore() ?? pool;

// Runs `work` in one transaction. Every `query` and `bulkInsert` it makes, however deep in the DB layer, uses the
// same connection. It commits when `work` returns and rolls back when `work` throws. A call made inside a running
// transaction joins it. A DB-layer function that returns `{ error }` instead of throwing does not roll back by
// itself: the caller of that function must throw on the error.
export async function withTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (transactionClient.getStore()) return work();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await transactionClient.run(client, work);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackErr) {
            logger.error("Transaction rollback failed", rollbackErr as Error);
        }
        throw err;
    } finally {
        client.release();
    }
}

export const query = <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> => runStatement<T>(text, params);

export function bulkInsert<T extends QueryResultRow = QueryResultRow>(table: string, columns: string[], rows: unknown[][], options: { onConflict?: string } = {}): Promise<QueryResult<T>> {
    if (rows.length === 0) {
        return Promise.resolve({ rows: [] } as unknown as QueryResult<T>);
    }
    const values: unknown[] = [];
    const placeholders = rows.map((row, i) => {
        const base = i * columns.length;
        const ph = columns.map((_, j) => `$${base + j + 1}`);
        values.push(...row);
        return `(${ph.join(", ")})`;
    });
    const text = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders.join(", ")}${options.onConflict ? ` ${options.onConflict}` : ""} RETURNING *`;
    return runStatement<T>(text, values);
}

export class DatabaseConnectionError extends Error {
    cause?: unknown;
    isConnectionError: true;
    constructor (message: string, cause?: unknown) {
        super(message);
        this.name = 'DatabaseConnectionError';
        this.cause = cause;
        this.isConnectionError = true;
    }
}

export function isConnectionError(err: any): boolean {
    if (!err) return false;
    return (
        err.isConnectionError === true ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        (typeof err.message === 'string' && (
            err.message.includes('DatabaseConnectionError') ||
            err.message.includes('fetch failed') ||
            err.message.includes('UND_ERR_CONNECT_TIMEOUT')
        ))
    );
}

