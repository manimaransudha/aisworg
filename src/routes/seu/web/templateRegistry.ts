// Template Registry (owner, 2026-08-19: "Build the template and profile
// registry") — closes Ch.6 §20.12's "no Template/Profile registry page"
// gap, and is the UI trigger §20.3/CR-024 flagged as missing for Template
// reactivation. Mirrors web/packs.ts's own Registry page structure exactly,
// including the same generic transition form.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listTemplatesWithNextStates, copyTemplateAsNewDraft } from "../core/templates.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const TEMPLATE_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/templates — every published Version of every Template. */
router.get("/templates", attachVM("seu/templates/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Templates";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status", "code"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const templates = await listTemplatesWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    // Template's `code` IS its category (CR-021, Ch.6 §20.1/§20.14) — one tab
    // per code, not a separate category field the way Pack/Profile have.
    const categories = [...new Set(templates.map((t) => t.template.code))].sort();
    const activeCategory = typeof req.query.category === "string" && categories.includes(req.query.category) ? req.query.category : "";
    const activeStatus = typeof req.query.status === "string" && TEMPLATE_STATES.includes(req.query.status) ? req.query.status : "";
    let scoped = activeCategory ? templates.filter((t) => t.template.code === activeCategory) : templates;
    if (activeStatus) scoped = scoped.filter((t) => t.template.status === activeStatus);
    const list = paginateList(scoped, params, {
      searchFields: [(t) => t.template.name, (t) => t.template.code],
      sortFields: { name: (t) => t.template.name, version: (t) => t.template.template_version, status: (t) => t.template.status, code: (t) => t.template.code },
    });
    list.category = activeCategory || undefined;
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/templates";
    req.vm.opt.categories = categories;
    req.vm.opt.activeCategory = activeCategory;
    req.vm.opt.states = TEMPLATE_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
    const canCopy = actorId ? (await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "template_define" })).allowed : false;
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/templates/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/templateRegistry] GET /templates error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/templates/:id/copy — Registry "Copy" action: a new, editable Draft at the next available version. */
router.post("/templates/:id/copy", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/templates";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
  if (!actorId) return flashError(req, res, backTo, "Sign in required.");
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "template_define" });
  if (!auth.allowed) return flashError(req, res, backTo, "You don't hold the template_define badge.");
  try {
    const result = await copyTemplateAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return flashError(req, res, backTo, `Copy failed: ${result.errors.join("; ")}`);
    return flashSuccess(req, res, `/aisworg/seu/sdk/template-authoring/${result.draftId}`, "Template copied — a new Draft is ready to edit.");
  } catch (err) {
    logger.error("[web/seu/templateRegistry] POST /templates/:id/copy error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
