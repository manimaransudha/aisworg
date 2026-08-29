// CR-076 (owner: "GET /objectives should have a requireTenant and include
// tenant filtering" — a third shape alongside requireBadge/requireTenantScope:
// this one never denies. requireTenantScope gates access to ONE already-
// identified entity (a :id, or a referenced field); a list route has no
// single entity to check against — it needs the viewer's own tenant scope
// attached so its own query can filter with it. "The db level checks are
// okay" (owner) — this middleware only resolves and attaches the value;
// the actual filtering stays the route's own DB call, same as it already is
// on web/objectives.ts's list route.
import type { Request, Response, NextFunction } from "express";

export function requireTenant() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    req.tenantScope = { isRoot, tenantId: req.session?.user?.tenant_id ?? null };
    next();
  };
}
