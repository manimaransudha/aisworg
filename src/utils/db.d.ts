// Type declaration for db.js — doesn't change its runtime behavior at all.
// Without this, TS infers `query`'s return type from `pool.query(text, params)`
// with implicit-any args, which resolves to the wrong pg overload (QueryArrayResult,
// rows: any[][]) instead of QueryResult<T> (rows: T[]).
import type { Pool, QueryResult, QueryResultRow } from "pg";

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>>;

declare const pool: Pool;
export default pool;

export class DatabaseConnectionError extends Error {
  cause?: unknown;
  isConnectionError: true;
  constructor(message: string, cause?: unknown);
}

export function isConnectionError(err: unknown): boolean;
