import { query } from "./db.js";

export type SortDir = "asc" | "desc";

export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  sort: string;
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
  category?: string;
  templateCode?: string;
  status?: string;
  tenant?: string;
}

const DEFAULT_PAGE_SIZE = clampInt(process.env.LIST_PAGE_SIZE_DEFAULT, 20, 1, 500);
const MAX_PAGE_SIZE = clampInt(process.env.LIST_PAGE_SIZE_MAX, 200, 1, 1000);

function clampInt(raw: unknown, dflt: number, min: number, max: number): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

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
