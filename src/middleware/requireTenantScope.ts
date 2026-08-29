// CR-076 (owner: "even tenant id checks that we have in the code has to be
// directed through a middleware. The db level checks are okay, but any scope
// check we do... hardcoded in the code also has to be a common middleware")
// — generalizes the tenant-reach check first built ad hoc for Objectives
// (web/objectives.ts's own router.param("id", ...) gate, and the separate
// hand-written check on its `?parent=` query param). Two shapes, both built
// on the same underlying comparison:
//   .forParam  — the entity IS the route's own :id (e.g. GET /objectives/:id)
//   .forField  — the entity is REFERENCED by a query/body field, not the
//                route's own :id (e.g. POST /objectives's parentObjectiveId)
//
// Never distinguishes "wrong tenant" from "doesn't exist" — always the same
// denial, so this can never confirm another tenant's row even exists.
// Fails closed on a legacy row with no sponsoring_authority yet, or a viewer
// with no resolved tenant ("NULL never matches" — objectivesDB.findAll's own
// rule, reused here). root bypasses.
import type { Request, Response, NextFunction } from "express";
import { flashError } from "../utils/flash.js";
import type { DbResult } from "../dblayer/seuTypes.js";

interface TenantScoped {
  sponsoring_authority?: { tenant: string | null } | null;
}

function isRoot(req: Request): boolean {
  return (req.session?.user?.platformBadges ?? []).includes("root");
}

interface DenyOpts {
  // "web" (default): flash + redirect, regardless of method — matches every
  // current caller (web/objectives.ts is plain <form method="POST">
  // submissions throughout, no AJAX; a JSON body on a full-page form POST
  // would just render as broken text, not a real error page). "api": always
  // JSON 404, regardless of method — a real JSON API router has no page to
  // redirect to, not even for its own GETs.
  mode?: "web" | "api";
  notFoundRedirect?: string;
  notFoundMessage?: string;
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

function inReach(req: Request, row: TenantScoped | null): boolean {
  if (!row) return false;
  if (isRoot(req)) return true;
  const viewerTenantId = req.session?.user?.tenant_id ?? null;
  const rowTenantId = row.sponsoring_authority?.tenant ?? null;
  return rowTenantId !== null && viewerTenantId !== null && rowTenantId === viewerTenantId;
}

export const requireTenantScope = {
  // Gates every route sharing this router.param name (Express calls this
  // once per request, before any of the router's own :paramName routes).
  forParam<T extends TenantScoped>(
    paramName: string,
    lookup: (id: string) => Promise<DbResult<T | null>>,
    opts: DenyOpts = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction, value: string): Promise<void> => {
      const result = await lookup(value);
      const row = result.data ?? null;
      if (!inReach(req, row)) {
        denyNotFound(req, res, opts);
        return;
      }
      next();
    };
  },

  // Gates a single route whose relevant entity is named by a query/body
  // field, not the route's own :id (e.g. ?parent=<id>, or a form field).
  // A no-op when the field is absent/empty — the field is usually optional
  // (e.g. a Strategic root has no parent at all); this only fires once
  // there's something to actually check.
  forField<T extends TenantScoped>(
    source: "query" | "body",
    fieldName: string,
    lookup: (id: string) => Promise<DbResult<T | null>>,
    opts: DenyOpts = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const raw = source === "query" ? req.query[fieldName] : req.body?.[fieldName];
      const value = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      if (!value) return next();

      const result = await lookup(value);
      const row = result.data ?? null;
      if (!inReach(req, row)) {
        denyNotFound(req, res, opts);
        return;
      }
      next();
    };
  },
};
