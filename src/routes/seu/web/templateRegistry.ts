import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { listTemplatesWithNextStates, copyTemplateAsNewDraft } from "../core/templates.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
import { resolveHeldBadges, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";
 
const TEMPLATE_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

router.get("/templates", attachVM("seu/templates/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Templates";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status", "code"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const templates = await listTemplatesWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
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
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/templates";
    req.vm.opt.categories = categories;
    req.vm.opt.activeCategory = activeCategory;
    req.vm.opt.states = TEMPLATE_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const held = await resolveHeldBadges(req);
    const canCopy = held.has("template_define");
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/templates/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/templateRegistry] GET /templates error", err as Error);
    next(err);
  }
});

router.post("/templates/:id/copy", async (req: Request, res: Response) => {
  const { actorId } = await resolveActorAndBadge(req);
  try {
    const result = await copyTemplateAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return redirects.seu.templatesCopy.error(req, res, `Copy failed: ${result.errors.join("; ")}`);
    return redirects.seu.templatesCopy.success(req, res, "Template copied — a new Draft is ready to edit.", `/aisworg/seu/sdk/template-authoring/${result.draftId}`);
  } catch (err) {
    logger.error("[web/seu/templateRegistry] POST /templates/:id/copy error", err as Error);
    return redirects.seu.templatesCopy.error(req, res, (err as Error).message);
  }
});

export { router };
