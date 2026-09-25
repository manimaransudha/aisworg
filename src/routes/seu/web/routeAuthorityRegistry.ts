// CR-110 — Route Authority admin screen. The ONE exception to "every badge
// check comes from route_authority": this screen's own gate is a literal
// badge read from an env var, not a table lookup — the table can't govern
// access to its own editor. Default `root` if the env var is unset.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { routeAuthorityDB } from "../../../dblayer/routeAuthorityDB.js";
import { refreshRouteAuthorityCache } from "../../../domain/identity/routeAuthorityCache.js";
import { listGrantableNounVerbBadges, listAdminSurfaceBadgeCodes } from "../core/identity.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";

const backTo = "/aisworg/seu/route-authority";
const adminBadge = process.env.ROUTE_AUTHORITY_ADMIN_BADGE || "root";
const gate = requireBadge([adminBadge], { redirectTo: "/aisworg" });

async function grantableBadgeCodes(): Promise<string[]> {
  const [nounVerb, adminSurface] = await Promise.all([listGrantableNounVerbBadges(), listAdminSurfaceBadgeCodes()]);
  return [...new Set([...nounVerb, ...adminSurface])].sort();
}

async function grantableRoleCodes(): Promise<string[]> {
  const { data } = await ontologyDB.findConceptsByType("authorised-role", { isRoot: true, tenantId: null });
  return (data ?? []).map((c) => c.code).sort();
}

function parseMultiValue(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** GET /aisworg/seu/route-authority — every gated route's required badge(s)/role(s). */
router.get("/route-authority", gate, attachVM("seu/route-authority/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: rows } = await routeAuthorityDB.findAll();
    req.vm.req.title = "Route Authority";
    const params = parseListParams(req.query, { sortable: ["method", "path"], defaultSort: "path", defaultDir: "asc" });
    req.vm.req.list = paginateList(rows ?? [], params, {
      searchFields: [(r) => r.path, (r) => r.method],
      sortFields: { method: (r) => r.method, path: (r) => r.path },
    });
    req.vm.opt.listBasePath = backTo;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/route-authority/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/routeAuthorityRegistry] GET /route-authority error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/route-authority/new */
router.get("/route-authority/new", gate, attachVM("seu/route-authority/edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "New route authority row";
    req.vm.req.row = null;
    req.vm.req.badgeCodes = await grantableBadgeCodes();
    req.vm.req.roleCodes = await grantableRoleCodes();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/route-authority/edit", req.vm);
  } catch (err) {
    logger.error("[web/seu/routeAuthorityRegistry] GET /route-authority/new error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/route-authority/:id/edit */
router.get("/route-authority/:id/edit", gate, attachVM("seu/route-authority/edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: row } = await routeAuthorityDB.findById(req.params.id);
    if (!row) return flashError(req, res, backTo, "Route authority row not found.");
    req.vm.req.title = `Edit ${row.method} ${row.path}`;
    req.vm.req.row = row;
    req.vm.req.badgeCodes = await grantableBadgeCodes();
    req.vm.req.roleCodes = await grantableRoleCodes();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/route-authority/edit", req.vm);
  } catch (err) {
    logger.error("[web/seu/routeAuthorityRegistry] GET /route-authority/:id/edit error", err as Error);
    next(err);
  }
});

function readForm(body: Record<string, unknown>): { method: string; path: string; badges: string[]; roles: string[]; matchMode: "all" | "any"; description: string | null } | { error: string } {
  const method = String(body.method ?? "").trim().toUpperCase();
  const path = String(body.path ?? "").trim();
  if (!method) return { error: "Method is required." };
  if (!path.startsWith("/")) return { error: "Path must start with /." };
  const matchMode = body.matchMode === "any" ? "any" : "all";
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  return { method, path, badges: parseMultiValue(body.badges), roles: parseMultiValue(body.roles), matchMode, description };
}

/** POST /aisworg/seu/route-authority — create a new row. */
router.post("/route-authority", gate, async (req: Request, res: Response) => {
  try {
    const parsed = readForm(req.body ?? {});
    if ("error" in parsed) return flashError(req, res, `${backTo}/new`, parsed.error);
    const { data, error } = await routeAuthorityDB.create(parsed);
    if (error || !data) return flashError(req, res, `${backTo}/new`, error?.message ?? "Could not create row.");
    await refreshRouteAuthorityCache();
    return flashSuccess(req, res, backTo, `${data.method} ${data.path} added.`);
  } catch (err) {
    logger.error("[web/seu/routeAuthorityRegistry] POST /route-authority error", err as Error);
    return flashError(req, res, `${backTo}/new`, (err as Error).message);
  }
});

/** POST /aisworg/seu/route-authority/:id/update */
router.post("/route-authority/:id/update", gate, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const parsed = readForm(req.body ?? {});
    if ("error" in parsed) return flashError(req, res, `${backTo}/${id}/edit`, parsed.error);
    const { data, error } = await routeAuthorityDB.update(id, parsed);
    if (error || !data) return flashError(req, res, `${backTo}/${id}/edit`, error?.message ?? "Could not update row.");
    await refreshRouteAuthorityCache();
    return flashSuccess(req, res, backTo, `${data.method} ${data.path} updated.`);
  } catch (err) {
    logger.error("[web/seu/routeAuthorityRegistry] POST /route-authority/:id/update error", err as Error);
    return flashError(req, res, `${backTo}/${id}/edit`, (err as Error).message);
  }
});

/** POST /aisworg/seu/route-authority/:id/delete */
router.post("/route-authority/:id/delete", gate, async (req: Request, res: Response) => {
  try {
    const { error } = await routeAuthorityDB.delete(req.params.id);
    if (error) return flashError(req, res, backTo, error.message);
    await refreshRouteAuthorityCache();
    return flashSuccess(req, res, backTo, "Row deleted.");
  } catch (err) {
    logger.error("[web/seu/routeAuthorityRegistry] POST /route-authority/:id/delete error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
