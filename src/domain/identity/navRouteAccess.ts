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
