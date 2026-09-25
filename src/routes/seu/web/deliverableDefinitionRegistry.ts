// Deliverable Definition Registry (CR-049 Phase 1 follow-up) — mirrors
// web/templateRegistry.ts's own Registry page structure exactly, minus the
// category-tab dimension (Deliverable Definition has no category concept
// the way Template's code doubles as one).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listDeliverableDefinitionsWithNextStates, copyDeliverableDefinitionAsNewDraft } from "../core/deliverableDefinitions.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const DELIVERABLE_DEFINITION_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/deliverable-definitions — every published Version of every Deliverable Definition. */
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
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/deliverable-definitions";
    req.vm.opt.states = DELIVERABLE_DEFINITION_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
    const canCopy = actorId ? (await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "deliverable_define" })).allowed : false;
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/deliverable-definitions/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/deliverableDefinitionRegistry] GET /deliverable-definitions error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/deliverable-definitions/:id/copy — Registry "Copy" action: a new, editable Draft at the next available version. */
router.post("/deliverable-definitions/:id/copy", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/deliverable-definitions";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
  if (!actorId) return flashError(req, res, backTo, "Sign in required.");
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "deliverable_define" });
  if (!auth.allowed) return flashError(req, res, backTo, "You don't hold the deliverable_define badge.");
  try {
    const result = await copyDeliverableDefinitionAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return flashError(req, res, backTo, `Copy failed: ${result.errors.join("; ")}`);
    return flashSuccess(req, res, `/aisworg/seu/sdk/deliverable-authoring/${result.draftId}`, "Deliverable Definition copied — a new Draft is ready to edit.");
  } catch (err) {
    logger.error("[web/seu/deliverableDefinitionRegistry] POST /deliverable-definitions/:id/copy error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
