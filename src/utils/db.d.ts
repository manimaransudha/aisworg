import type { Pool, QueryResult, QueryResultRow } from "pg";

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>>;

export function bulkInsert<T extends QueryResultRow = QueryResultRow>(
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<QueryResult<T>>;

declare const pool: Pool;
export default pool;

export class DatabaseConnectionError extends Error {
  cause?: unknown;
  isConnectionError: true;
  constructor(message: string, cause?: unknown);
}

export function isConnectionError(err: unknown): boolean;
