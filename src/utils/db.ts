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

export const query = <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> => executor().query<T>(text, params);

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
    return executor().query<T>(text, values);
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

