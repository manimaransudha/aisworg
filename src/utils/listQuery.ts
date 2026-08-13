// Shared server-side list plumbing for paginated / searchable / sortable list
// views (coding_principles.md — "List UI Requirements"). Every list page reads
// its ?page/pageSize/q/sort/dir params through parseListParams, and its dbLayer
// runs one paginated query (LIMIT/OFFSET + WHERE ILIKE + ORDER BY) plus a COUNT
// via runPaginatedQuery, then shapes the ViewModel with listResult. Sort keys
// are whitelisted here and mapped to trusted SQL expressions in code — raw
// sort/dir input never reaches SQL.
import { query } from "./db.js";

export type SortDir = "asc" | "desc";

export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  sort: string; // resolved, whitelisted sort key
  dir: SortDir;
  limit: number;
  offset: number;
}

export interface ListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  q: string;
  sort: string;
  dir: SortDir;
}

const DEFAULT_PAGE_SIZE = clampInt(process.env.LIST_PAGE_SIZE_DEFAULT, 20, 1, 500);
const MAX_PAGE_SIZE = clampInt(process.env.LIST_PAGE_SIZE_MAX, 200, 1, 1000);

function clampInt(raw: unknown, dflt: number, min: number, max: number): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Parse the standard list query params off req.query, whitelisting the sort key
 * against `sortable` (unknown/absent -> defaultSort) and clamping pageSize.
 */
export function parseListParams(
  reqQuery: Record<string, unknown>,
  opts: { sortable: string[]; defaultSort: string; defaultDir?: SortDir }
): ListParams {
  const page = Math.max(1, clampInt(reqQuery.page, 1, 1, Number.MAX_SAFE_INTEGER));
  const pageSize = Math.min(MAX_PAGE_SIZE, clampInt(reqQuery.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE));
  const q = typeof reqQuery.q === "string" ? reqQuery.q.trim() : "";
  const sortRaw = typeof reqQuery.sort === "string" ? reqQuery.sort : "";
  const sort = opts.sortable.includes(sortRaw) ? sortRaw : opts.defaultSort;
  const dir: SortDir = reqQuery.dir === "asc" || reqQuery.dir === "desc" ? reqQuery.dir : opts.defaultDir ?? "desc";
  return { page, pageSize, q, sort, dir, limit: pageSize, offset: (page - 1) * pageSize };
}

/** Shape a page of rows + total count into the ViewModel-facing ListResult. */
export function listResult<T>(items: T[], total: number, p: ListParams): ListResult<T> {
  return {
    items,
    page: p.page,
    pageSize: p.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
    q: p.q,
    sort: p.sort,
    dir: p.dir,
  };
}

/**
 * In-memory paginate/search/sort for lists that are computed or aggregated
 * (no single SQL table to page over) or small/bounded enough that one fetch +
 * slice is fine. Filters over `searchFields`, sorts by the whitelisted
 * `sortFields[params.sort]` accessor, then slices to the page. For genuinely
 * large tables prefer runPaginatedQuery (true SQL LIMIT/OFFSET) — see SEUs.
 */
export function paginateList<T>(
  items: T[],
  params: ListParams,
  opts: { searchFields?: ((x: T) => unknown)[]; sortFields: Record<string, (x: T) => unknown> }
): ListResult<T> {
  let rows = items;

  if (params.q && opts.searchFields?.length) {
    const needle = params.q.toLowerCase();
    rows = rows.filter((r) =>
      opts.searchFields!.some((f) => {
        const v = f(r);
        return v != null && String(v).toLowerCase().includes(needle);
      })
    );
  }

  const sorter = opts.sortFields[params.sort] ?? Object.values(opts.sortFields)[0];
  if (sorter) {
    rows = [...rows].sort((a, b) => {
      const av = sorter(a);
      const bv = sorter(b);
      let c: number;
      if (av == null && bv == null) c = 0;
      else if (av == null) c = -1;
      else if (bv == null) c = 1;
      else if (typeof av === "number" && typeof bv === "number") c = av - bv;
      else c = String(av).localeCompare(String(bv));
      return params.dir === "asc" ? c : -c;
    });
  }

  const total = rows.length;
  return listResult(rows.slice(params.offset, params.offset + params.limit), total, params);
}

/**
 * Build and run the data query (LIMIT/OFFSET, ORDER BY, optional ILIKE search)
 * plus a matching COUNT, and return { items, total }. All SQL fragments here
 * (`select`, `from`, `searchColumns`, `sortMap` values, `baseWhere`) are
 * code-defined and trusted; only `q`, `limit`, `offset`, and `baseParams`
 * values are bound as parameters. `baseWhere` (if given) must reference its own
 * params as $1..$n matching `baseParams` in order.
 */
export async function runPaginatedQuery<T>(
  config: {
    select: string;
    from: string;
    searchColumns?: string[];
    sortMap: Record<string, string>;
    baseWhere?: string;
    baseParams?: unknown[];
  },
  params: ListParams
): Promise<{ items: T[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (config.baseWhere) {
    where.push(`(${config.baseWhere})`);
    if (config.baseParams?.length) values.push(...config.baseParams);
  }
  if (params.q && config.searchColumns?.length) {
    const p = values.length + 1;
    values.push(`%${params.q}%`);
    where.push(`(${config.searchColumns.map((c) => `${c} ILIKE $${p}`).join(" OR ")})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orderExpr = config.sortMap[params.sort] ?? Object.values(config.sortMap)[0];
  const orderSql = `ORDER BY ${orderExpr} ${params.dir === "asc" ? "ASC" : "DESC"}`;

  const countRes = await query(`SELECT count(*)::int AS n FROM ${config.from} ${whereSql}`, values);
  const total = (countRes.rows[0]?.n as number) ?? 0;

  const limitP = values.length + 1;
  const offsetP = values.length + 2;
  const dataRes = await query(
    `SELECT ${config.select} FROM ${config.from} ${whereSql} ${orderSql} LIMIT $${limitP} OFFSET $${offsetP}`,
    [...values, params.limit, params.offset]
  );
  return { items: dataRes.rows as T[], total };
}
