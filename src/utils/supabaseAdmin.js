// src/utils/supabaseAdmin.js
// This is legacy
import {logger} from "./logger.js";
import * as dotenv from "dotenv";
import {createClient} from '@supabase/supabase-js';

import path from "path";

// Load environment variables from src/.env relative to project root
dotenv.config({path: path.join(process.cwd(), 'src/.env')});

const supabaseUrl = process.env.SUPABASE_URL || (process.env.NODE_ENV === 'test' ? 'https://dummy.supabase.co' : null);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NODE_ENV === 'test' ? 'dummy-key' : null); // full privileges

if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (process.env.NODE_ENV !== 'test') {
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment variables.");
    }
}

/**
 * Custom error for database connection issues
 */
class DatabaseConnectionError extends Error {
    constructor (message, cause) {
        super(message);
        this.name = 'DatabaseConnectionError';
        this.cause = cause;
        this.isConnectionError = true;
    }
}

/**
 * Custom fetch wrapper for Supabase to handle timeouts and retries
 */
const robustFetch = async (url, options = {}, retries = 3, backoff = 1000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        // Detect connection timeout or fetch failure
        const isTimeout = error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
            error.message?.includes('Connect Timeout') || error.message?.includes('UND_ERR_CONNECT_TIMEOUT');

        const isNetworkError = error.name === 'TypeError' && error.message?.includes('fetch failed');

        if (retries > 0 && (isTimeout || isNetworkError)) {
            logger.warn(`Fetch failed (${error.name || 'NetworkError'}). Retrying in ${backoff}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return robustFetch(url, options, retries - 1, backoff * 2);
        }

        // If all retries failed and it's a connection/timeout issue, throw specific error
        if (isTimeout || isNetworkError) {
            throw new DatabaseConnectionError('Database connection timed out or failed after multiple retries.', error);
        }

        throw error;
    }
};
/**
 * Helper to identify if an error (potentially wrapped by Supabase) is a connection error.
 */
function isConnectionError(err) {
    if (!err) return false;
    return (
        err.isConnectionError === true ||
        (typeof err.message === 'string' && err.message.includes('DatabaseConnectionError')) ||
        (typeof err.details === 'string' && err.details.includes('DatabaseConnectionError')) ||
        (typeof err.message === 'string' && (err.message.includes('fetch failed') || err.message.includes('UND_ERR_CONNECT_TIMEOUT')))
    );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: {
        fetch: robustFetch
    }
});
