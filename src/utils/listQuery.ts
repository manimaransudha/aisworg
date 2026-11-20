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
  seuId?: string;
  objectiveId?: string;
  participantId?: string;
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

// The words of a search string, lower-cased; a search matches when each word is found.
export function searchTerms(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

// The typos a search word tolerates: none for a short word, one for a word of 4 to 7 letters, two for a longer one.
const typosAllowed = (word: string): number => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0);

// A fuzzy match of one search word in one field's text (both lower-case): the word is part of the text, or it is within the typos allowed of a
// word of the text, or of the start of one (a word typed only in part).
export function fuzzyIncludes(text: string, term: string): boolean {
  if (text.includes(term)) return true;
  const allowed = typosAllowed(term);
  if (allowed === 0) return false;
  return text.split(/[^a-z0-9]+/).some((word) => word.length > 0 && (editDistance(term, word) <= allowed || editDistance(term, word.slice(0, term.length)) <= allowed));
}

export function paginateList<T>(
  items: T[],
  params: ListParams,
  opts: { searchFields?: ((x: T) => unknown)[]; sortFields: Record<string, (x: T) => unknown> }
): ListResult<T> {
  let rows = items;

  if (params.q && opts.searchFields?.length) {
    // A fuzzy search, ignoring case: every word of the search must be found, with the typos fuzzyIncludes allows, within one single field.
    const terms = searchTerms(params.q);
    rows = rows.filter((r) => {
      const values = opts.searchFields!.map((f) => f(r)).filter((v) => v != null).map((v) => String(v).toLowerCase());
      return values.some((v) => terms.every((t) => fuzzyIncludes(v, t)));
    });
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

export interface GroupPage<T> {
  key: string;
  total: number;
  page: number;
  totalPages: number;
  items: T[];
}

export interface GroupedListResult<T> extends ListResult<T> {
  groups: GroupPage<T>[];
}

// Search and sort run over the whole list, the rows are then grouped, and each group is paginated on its own.
// groupPages carries each group's requested page (the tpage[<key>] query parameter); the page size is the list's own.
export function paginateGroupedList<T>(
  items: T[],
  params: ListParams,
  opts: { searchFields?: ((x: T) => unknown)[]; sortFields: Record<string, (x: T) => unknown>; groupKey: (x: T) => string; groupPages?: unknown /* the request query */ }
): GroupedListResult<T> {
  const all = paginateList(items, { ...params, offset: 0, limit: Number.MAX_SAFE_INTEGER }, opts);
  const byKey = new Map<string, T[]>();
  for (const row of all.items) {
    const key = opts.groupKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }
  // Express leaves tpage[<key>] as a flat key, so the whole query is read here.
  const requested = opts.groupPages && typeof opts.groupPages === "object" ? (opts.groupPages as Record<string, unknown>) : {};
  const groups: GroupPage<T>[] = [...byKey.entries()].map(([key, rows]) => {
    const totalPages = Math.max(1, Math.ceil(rows.length / params.pageSize));
    const page = Math.min(totalPages, Math.max(1, clampInt(requested[`tpage[${key}]`], 1, 1, Number.MAX_SAFE_INTEGER)));
    return { key, total: rows.length, page, totalPages, items: rows.slice((page - 1) * params.pageSize, page * params.pageSize) };
  });
  return { ...all, page: 1, totalPages: 1, groups };
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
    // Every word of the search must appear within one single column, ignoring case. The database holds no fuzzy index, so there is no typo tolerance here.
    const terms = searchTerms(params.q);
    const perColumn = config.searchColumns.map((c) => {
      const conditions = terms.map((term) => {
        values.push(`%${term}%`);
        return `${c} ILIKE $${values.length}`;
      });
      return `(${conditions.join(" AND ")})`;
    });
    where.push(`(${perColumn.join(" OR ")})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orderExpr = config.sortMap[params.sort] ?? Object.values(config.sortMap)[0];
  const orderSql = `ORDER BY ${orderExpr} ${params.dir === "asc" ? "ASC" : "DESC"}`;

  const limitP = values.length + 1;
  const offsetP = values.length + 2;
  const [countRes, dataRes] = await Promise.all([
    query(`SELECT count(*)::int AS n FROM ${config.from} ${whereSql}`, values),
    query(`SELECT ${config.select} FROM ${config.from} ${whereSql} ${orderSql} LIMIT $${limitP} OFFSET $${offsetP}`, [...values, params.limit, params.offset]),
  ]);
  const total = (countRes.rows[0]?.n as number) ?? 0;
  return { items: dataRes.rows as T[], total };
}
