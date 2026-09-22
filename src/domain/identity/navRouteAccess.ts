// CR-110 — navbar link visibility keyed off route_authority's roles[] for
// the link's own target route, instead of a hardcoded legacy users.role
// check. Only meaningful for a nav link whose target route actually has a
// route_authority row with a real roles[] requirement (today: Event Bus,
// Tenant User Management) — a link whose target has no row, or an empty
// roles[], is always visible. This is the navbar's own visibility signal
// ONLY; the route's own requireRole call is still the real enforcement —
// they read the same table, but this never replaces that gate.
import { routeAuthorityDB } from "../../dblayer/routeAuthorityDB.js";
import { resolveHeldRoles } from "./heldRoles.js";

export async function resolveNavRouteVisibility(userId: number | string, targets: Array<{ method: string; path: string }>): Promise<Record<string, boolean>> {
  const { data: rows } = await routeAuthorityDB.findAll();
  const heldRoles = await resolveHeldRoles(userId);
  const result: Record<string, boolean> = {};
  for (const t of targets) {
    const key = `${t.method} ${t.path}`;
    const row = (rows ?? []).find((r) => r.method === t.method && r.path === t.path);
    const required = row?.roles ?? [];
    if (required.length === 0) {
      result[key] = true;
      continue;
    }
    const matchMode = row?.match_mode ?? "all";
    result[key] = matchMode === "any" ? required.some((r) => heldRoles.has(r)) : required.every((r) => heldRoles.has(r));
  }
  return result;
}
