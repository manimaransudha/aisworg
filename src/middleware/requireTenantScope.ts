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
// CR-080 follow-up (owner: "just pass only tenant_id to inReach. how does it
// matter where and how the tenant_id is stored?") — the comparison itself
// never needs the row at all, only the two tenant ids to compare; the first
// version hardcoded `row.sponsoring_authority.tenant` (Objective's own
// storage shape) into the shared function, which would have silently denied
// every row of any OTHER entity (e.g. Pack, which stores a plain `tenant_id`
// column, no `sponsoring_authority` at all — reading that field off a
// PackRow is just `undefined` in JS, so the old code would compute "no
// tenant" for every Pack and refuse every non-root actor, with no error to
// notice it by). Fixed by moving row-shape knowledge out of this file
// entirely: `.forParam`/`.forField` take a `getTenantId(row)` function
// supplied by the caller, who already knows their own entity's storage
// shape; `inReach` itself only ever sees the resulting `string | null`.
//
// Never distinguishes "wrong tenant" from "doesn't exist" — always the same
// denial, so this can never confirm another tenant's row even exists.
// Fails closed when either side's tenant id is unresolved ("NULL never
// matches" — objectivesDB.findAll's own rule, reused here). root bypasses.
import type { Request, Response, NextFunction } from "express";
import { flashError } from "../utils/flash.js";
import type { DbResult } from "../dblayer/seuTypes.js";

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
  // CR-080 follow-up — Pack (unlike Objective) has a row that's meant to be
  // reachable by EVERY tenant, not just an exact match: a Platform-owned
  // Pack (web/packs.ts's own GET /packs comment: "Platform packs will be
  // available to all users of the platform"). Opt-in only, since Objective
  // has no such universally-shared row — omitted, this behaves exactly as
  // before (exact tenant match or root).
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
  // Gates every route sharing this router.param name (Express calls this
  // once per request, before any of the router's own :paramName routes).
  // getTenantId pulls the tenant id out of whatever `lookup` returns — the
  // one place this entity's own storage shape is named, kept at the call
  // site rather than baked into this shared file.
  forParam<T>(
    paramName: string,
    lookup: (id: string) => Promise<DbResult<T | null>>,
    getTenantId: (row: T) => string | null,
    opts: DenyOpts = {}
  ) {
    return async (req: Request, res: Response, next: NextFunction, value: string): Promise<void> => {
      const result = await lookup(value);
      const row = result.data ?? null;
      if (!row || !inReach(req, getTenantId(row), opts.platformTenantId)) {
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
