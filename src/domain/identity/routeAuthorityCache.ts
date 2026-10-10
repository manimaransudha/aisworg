import { match, type MatchFunction } from "path-to-regexp";
import { routeAuthorityDB, type RouteAuthorityRow } from "../../dblayer/routeAuthorityDB.js";
import { logger } from "../../utils/logger.js";

interface CompiledRow {
  method: string;
  path: string;
  paramCount: number;
  matcher: MatchFunction<Record<string, string>>;
  badges: string[];
  roles: string[];
  matchMode: "all" | "any";
}

let compiled: CompiledRow[] = [];
let loaded = false;

function compile(row: RouteAuthorityRow): CompiledRow | null {
  try {
    return {
      method: row.method.toUpperCase(),
      path: row.path,
      paramCount: (row.path.match(/:[A-Za-z0-9_]+/g) ?? []).length,
      matcher: match(row.path, { decode: decodeURIComponent }),
      badges: row.badges ?? [],
      roles: row.roles ?? [],
      matchMode: row.match_mode,
    };
  } catch (err) {
    logger.error(`[routeAuthorityCache] could not compile path pattern for ${row.method} ${row.path}`, err as Error);
    return null;
  }
}

export async function loadRouteAuthorityCache(): Promise<void> {
  const { data, error } = await routeAuthorityDB.findAll();
  if (error) {
    logger.error("[routeAuthorityCache] failed to load route_authority — keeping previous cache", error);
    return;
  }
  compiled = (data ?? []).map(compile).filter((r): r is CompiledRow => r !== null);
  loaded = true;
  logger.info(`[routeAuthorityCache] loaded ${compiled.length} route_authority rows.`);
}

export const refreshRouteAuthorityCache = loadRouteAuthorityCache;

export interface RouteAuthorityMatch {
  path: string;
  params: Record<string, string>;
  badges: string[];
  roles: string[];
  matchMode: "all" | "any";
}

export function lookupRouteAuthority(method: string, path: string): RouteAuthorityMatch | undefined {
  const upper = method.toUpperCase();
  let best: { row: CompiledRow; params: Record<string, string> } | null = null;
  for (const row of compiled) {
    if (row.method !== upper) continue;
    const result = row.matcher(path);
    if (!result) continue;
    if (!best || row.paramCount < best.row.paramCount || (row.paramCount === best.row.paramCount && row.path.length > best.row.path.length)) {
      best = { row, params: result.params as Record<string, string> };
    }
  }
  if (!best) return undefined;
  return { path: best.row.path, params: best.params, badges: best.row.badges, roles: best.row.roles, matchMode: best.row.matchMode };
}

export function isRouteAuthorityCacheLoaded(): boolean {
  return loaded;
}
