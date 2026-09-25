// CR-110 — in-memory cache of route_authority, loaded once and consulted by
// the global route-authority gate (middleware/routeAuthorityGate.ts) on
// every request — no per-route requireBadge/requireRole call needed
// anymore. Refreshed on demand by the table's own CRUD screen
// (routeAuthorityRegistry.ts) after a write, so an edit takes effect on the
// very next request, no restart.
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

// Same operation, exported under the name the CRUD screen calls after a
// write — kept as a distinct export so call sites read as intent ("refresh
// after I just changed a row"), not as "loading for the first time".
export const refreshRouteAuthorityCache = loadRouteAuthorityCache;

export interface RouteAuthorityMatch {
  path: string;
  params: Record<string, string>;
  badges: string[];
  roles: string[];
  matchMode: "all" | "any";
}

// Ambiguity between a literal route (/objectives/new) and a parameterised
// one (/objectives/:id) that both match the same incoming path is resolved
// by preferring the fewest params, then the longest (most specific) pattern
// — the same "literal beats param" precedence Express itself gives routes
// registered in a sane order.
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
