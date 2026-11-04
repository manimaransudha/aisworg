import type { Request } from "express";
import { lookupRouteAuthority } from "./routeAuthorityCache.js";
import { resolveHeldRoles } from "./heldRoles.js";

export async function resolveNavRouteVisibility(req: Request, targets: Array<{ method: string; path: string }>): Promise<Record<string, boolean>> {
  const user = req.session?.user;
  const result: Record<string, boolean> = {};
  if (!user) {
    for (const t of targets) result[`${t.method} ${t.path}`] = false;
    return result;
  }

  const heldRoles = await resolveHeldRoles(user.id, {});

  for (const t of targets) {
    const key = `${t.method} ${t.path}`;
    const found = lookupRouteAuthority(t.method, t.path);
    if (!found) {
      result[key] = false;
      continue;
    }
    const { roles, matchMode } = found;
    // A link is shown on the roles alone; badges are checked when an operation or transition runs.
    result[key] =
      roles.length === 0 ||
      heldRoles.isSuperuser ||
      (matchMode === "any" ? roles.some((r) => heldRoles.has(r)) : roles.every((r) => heldRoles.has(r)));
  }
  return result;
}
