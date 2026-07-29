import pkg from "pg";
import * as dotenv from "dotenv";
import path from "path";
import {logger} from "./logger.js";

const {Pool, types} = pkg;

// Force Numeric (OID 1700) and INT8 (OID 20) to be parsed as float/int
// Postgres NUMERIC/DECIMAL is OID 1700
types.setTypeParser(1700, (val) => parseFloat(val));
// Postgres BIGINT/INT8 is OID 20
types.setTypeParser(20, (val) => parseInt(val, 10));
// Force DATE (1082) to stay as string (YYYY-MM-DD)
types.setTypeParser(1082, (val) => val);
// Force TIMESTAMP (1114) and TIMESTAMPTZ (1184) to return ISO strings for compatibility with legacy formatting logic
types.setTypeParser(1114, (val) => (typeof val === 'string') ? new Date(val + 'Z').toISOString() : (val instanceof Date ? val.toISOString() : val));
types.setTypeParser(1184, (val) => (typeof val === 'string') ? new Date(val).toISOString() : (val instanceof Date ? val.toISOString() : val));

// Only load src/.env if DATABASE_URL is missing (root .env should take precedence)
if (!process.env.DATABASE_URL) {
    dotenv.config({path: path.join(process.cwd(), "src/.env")});
}

let connectionString = process.env.DATABASE_URL;
// Fix for PG SSL Warning: treatment of 'require' vs 'verify-full'
if (connectionString && connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
    connectionString += (connectionString.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
}

const pool = new Pool({
    connectionString: connectionString,
    // ssl: { rejectUnauthorized: false }, // local db
    max: parseInt(process.env.MAX_CONNECTIONS) || 10,
    connectionTimeoutMillis: parseInt(process.env.DB_TIMEOUT) || 60000,
    idleTimeoutMillis: 20000
});

pool.on("error", (err) => {
    logger.error("Unexpected PG error", err);
});

export default pool;
export const query = (text, params) => pool.query(text, params);

/**
 * Custom error for database connection issues
 */
export class DatabaseConnectionError extends Error {
    constructor (message, cause) {
        super(message);
        this.name = 'DatabaseConnectionError';
        this.cause = cause;
        this.isConnectionError = true;
    }
}

/**
 * Helper to identify if an error is a connection error.
 * Updated for 'pg' driver patterns.
 */
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


