import type { Request, Response, NextFunction } from "express";

export function requireTenant() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    req.tenantScope = { isRoot, tenantId: req.session?.user?.tenant_id ?? null };
    next();
  };
}
