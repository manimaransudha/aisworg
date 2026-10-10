import pkg from "pg";
import * as dotenv from "dotenv";
import path from "path";
import {logger} from "./logger.js";

const {Pool, types} = pkg;

types.setTypeParser(1700, (val) => parseFloat(val));
types.setTypeParser(20, (val) => parseInt(val, 10));
types.setTypeParser(1082, (val) => val);
types.setTypeParser(1114, (val) => (typeof val === 'string') ? new Date(val + 'Z').toISOString() : (val instanceof Date ? val.toISOString() : val));
types.setTypeParser(1184, (val) => (typeof val === 'string') ? new Date(val).toISOString() : (val instanceof Date ? val.toISOString() : val));

if (!process.env.DATABASE_URL) {
    dotenv.config({path: path.join(process.cwd(), "src/.env")});
}

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
}

const pool = new Pool({
    connectionString: connectionString,
    max: parseInt(process.env.MAX_CONNECTIONS) || 10,
    connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT) || 60000,
    idleTimeoutMillis: 20000,
    allowExitOnIdle: true
});

pool.on("error", (err) => {
    logger.error("Unexpected PG error", err);
});

export default pool;
export const query = (text, params) => pool.query(text, params);

export function bulkInsert(table, columns, rows) {
    if (rows.length === 0) {
        return Promise.resolve({ rows: [] });
    }
    const values = [];
    const placeholders = rows.map((row, i) => {
        const base = i * columns.length;
        const ph = columns.map((_, j) => `$${base + j + 1}`);
        values.push(...row);
        return `(${ph.join(", ")})`;
    });
    const text = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders.join(", ")} RETURNING *`;
    return pool.query(text, values);
}

export class DatabaseConnectionError extends Error {
    constructor (message, cause) {
        super(message);
        this.name = 'DatabaseConnectionError';
        this.cause = cause;
        this.isConnectionError = true;
    }
}

export function isConnectionError(err) {
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

