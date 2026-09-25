// CR-110 — navbar link visibility, generically keyed off route_authority for
// every nav link's own target route, instead of hardcoded users.role/badge
// literals (navbar.ejs's old _isGeneral gate, app.js's old Ontology
// role/root check). A link whose target has no route_authority row is
// treated as NOT visible — mirrors routeAuthorityGate's own fail-closed
// behaviour, so the nav never shows a link the gate would then 403. A row
// with empty badges[] and roles[] is always visible. Uses the same
// in-memory routeAuthorityCache (path-to-regexp matching, so pattern rows
// like /aisworg/seu/sdk/:slug resolve correctly) and the same
// resolveHeldBadges/resolveHeldRoles primitives the gate itself uses — this
// is the navbar's own visibility signal ONLY; the route's own gate lookup on
// request is still the real enforcement, they just read the same table.
import type { Request } from "express";
import { lookupRouteAuthority } from "./routeAuthorityCache.js";
import { resolveHeldBadges } from "./heldBadges.js";
import { resolveHeldRoles } from "./heldRoles.js";

export async function resolveNavRouteVisibility(req: Request, targets: Array<{ method: string; path: string }>): Promise<Record<string, boolean>> {
  const user = req.session?.user;
  const result: Record<string, boolean> = {};
  if (!user) {
    for (const t of targets) result[`${t.method} ${t.path}`] = false;
    return result;
  }

  const rootBypassAllowed = process.env.NODE_ENV !== "production";
  const held = await resolveHeldBadges(req);
  const heldRoles = await resolveHeldRoles(user.id, {});

  for (const t of targets) {
    const key = `${t.method} ${t.path}`;
    const found = lookupRouteAuthority(t.method, t.path);
    if (!found) {
      result[key] = false;
      continue;
    }
    const { badges, roles, matchMode } = found;
    const badgesOk =
      badges.length === 0 ||
      (held.isRoot && rootBypassAllowed) ||
      (matchMode === "any" ? badges.some((b) => held.has(b)) : badges.every((b) => held.has(b)));
    const rolesOk =
      roles.length === 0 ||
      heldRoles.isSuperuser ||
      (matchMode === "any" ? roles.some((r) => heldRoles.has(r)) : roles.every((r) => heldRoles.has(r)));
    result[key] = badgesOk && rolesOk;
  }
  return result;
}
