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
import { listDeliverableDefinitionsWithNextStates, copyDeliverableDefinitionAsNewDraft } from "../core/deliverableDefinitions.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { resolveHeldBadges, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";
 
const DELIVERABLE_DEFINITION_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

router.get("/deliverable-definitions", attachVM("seu/deliverable-definitions/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Deliverable Definitions";
    const params = parseListParams(req.query, { sortable: ["code", "version", "status"], defaultSort: "code", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const rows = await listDeliverableDefinitionsWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    const activeStatus = typeof req.query.status === "string" && DELIVERABLE_DEFINITION_STATES.includes(req.query.status) ? req.query.status : "";
    const scoped = activeStatus ? rows.filter((r) => r.deliverableDefinition.status === activeStatus) : rows;
    const list = paginateList(scoped, params, {
      searchFields: [(r) => r.deliverableDefinition.code],
      sortFields: { code: (r) => r.deliverableDefinition.code, version: (r) => r.deliverableDefinition.version, status: (r) => r.deliverableDefinition.status },
    });
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/deliverable-definitions";
    req.vm.opt.states = DELIVERABLE_DEFINITION_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const held = await resolveHeldBadges(req);
    const canCopy = held.has("deliverabledefinition_define");
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/deliverable-definitions/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/deliverableDefinitionRegistry] GET /deliverable-definitions error", err as Error);
    next(err);
  }
});

router.post("/deliverable-definitions/:id/copy", async (req: Request, res: Response) => {
  const { actorId } = await resolveActorAndBadge(req);
  try {
    const result = await copyDeliverableDefinitionAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return redirects.seu.deliverableDefinitionsCopy.error(req, res, `Copy failed: ${result.errors.join("; ")}`);
    return redirects.seu.deliverableDefinitionsCopy.success(req, res, "Deliverable Definition copied — a new Draft is ready to edit.", `/aisworg/seu/sdk/deliverable-authoring/${result.draftId}`);
  } catch (err) {
    logger.error("[web/seu/deliverableDefinitionRegistry] POST /deliverable-definitions/:id/copy error", err as Error);
    return redirects.seu.deliverableDefinitionsCopy.error(req, res, (err as Error).message);
  }
});

export { router };
