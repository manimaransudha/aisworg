import type { Request, Response, NextFunction } from "express";
import { flashError } from "../utils/flash.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "../dblayer/seuTypes.js";

function isRoot(req: Request): boolean {
  return (req.session?.user?.platformBadges ?? []).includes("root");
}

interface DenyOpts {
  mode?: "web" | "api";
  notFoundRedirect?: string;
  notFoundMessage?: string;
  platformTenantId?: string;
}

function denyNotFound(req: Request, res: Response, opts: DenyOpts): void {
  const message = opts.notFoundMessage ?? "Not found.";
  if (opts.mode === "api") {
    res.status(404).json({ success: false, message });
    return;
  }
  if (!opts.notFoundRedirect) {
    throw new Error("requireTenantScope: notFoundRedirect is required in web mode (the default) — pass mode: 'api' for a JSON-only router instead.");
  }
  flashError(req, res, opts.notFoundRedirect, message);
}

function inReach(req: Request, rowTenantId: string | null, platformTenantId?: string): boolean {
  if (isRoot(req)) return true;
  if (platformTenantId && rowTenantId === platformTenantId) return true;
  const viewerTenantId = req.session?.user?.tenant_id ?? null;
  return rowTenantId !== null && viewerTenantId !== null && rowTenantId === viewerTenantId;
}

export const requireTenantScope = {
  forParam<T>(
    paramName: string,
    lookup: (id: string) => Promise<DbResult<T | null>>,
    getTenantId: (row: T) => string | null,
    opts: DenyOpts = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction, value: string): Promise<void> => {
      const result = await lookup(value);
      const row = result.data ?? null;
      if (!row) {
        logger.warn(`[requireTenantScope.forParam] denied ${req.method} ${req.path} — no row for ${paramName}=${value}`);
        denyNotFound(req, res, opts);
        return;
      }
      if (!inReach(req, getTenantId(row), opts.platformTenantId)) {
        logger.warn(
          `[requireTenantScope.forParam] denied ${req.method} ${req.path} — tenant mismatch for ${paramName}=${value} ` +
            `(row tenant=${getTenantId(row) ?? "null"}, viewer tenant=${req.session?.user?.tenant_id ?? "null"}, viewer isRoot=${isRoot(req)})`
        );
        denyNotFound(req, res, opts);
        return;
      }
      next();
    };
  },

  forField<T>(
    source: "query" | "body",
    fieldName: string,
    lookup: (id: string) => Promise<DbResult<T | null>>,
    getTenantId: (row: T) => string | null,
    opts: DenyOpts = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const raw = source === "query" ? req.query[fieldName] : req.body?.[fieldName];
      const value = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      if (!value) return next();

      const result = await lookup(value);
      const row = result.data ?? null;
      if (!row || !inReach(req, getTenantId(row), opts.platformTenantId)) {
        denyNotFound(req, res, opts);
        return;
      }
      next();
    };
  },
};
