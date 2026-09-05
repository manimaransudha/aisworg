// Service Definition Registry (CR-086 follow-on) — mirrors
// web/deliverableDefinitionRegistry.ts's own Registry page structure exactly.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listServiceDefinitionsWithNextStates, copyServiceDefinitionAsNewDraft } from "../core/serviceDefinitions.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const SERVICE_DEFINITION_STATES = ["Defined", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/service-definitions — every published Version of every Service Definition. */
router.get("/service-definitions", attachVM("seu/service-definitions/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Service Definitions";
    const params = parseListParams(req.query, { sortable: ["code", "version", "status"], defaultSort: "code", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const rows = await listServiceDefinitionsWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    const activeStatus = typeof req.query.status === "string" && SERVICE_DEFINITION_STATES.includes(req.query.status) ? req.query.status : "";
    const scoped = activeStatus ? rows.filter((r) => r.serviceDefinition.status === activeStatus) : rows;
    const list = paginateList(scoped, params, {
      searchFields: [(r) => r.serviceDefinition.code, (r) => r.serviceDefinition.name],
      sortFields: { code: (r) => r.serviceDefinition.code, version: (r) => r.serviceDefinition.version, status: (r) => r.serviceDefinition.status },
    });
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/service-definitions";
    req.vm.opt.states = SERVICE_DEFINITION_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
    const canCopy = actorId ? (await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "service_define" })).allowed : false;
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/service-definitions/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/serviceDefinitionRegistry] GET /service-definitions error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/service-definitions/:id/copy — Registry "Copy" action: a new, editable Definition at the same version, ready to re-author. */
router.post("/service-definitions/:id/copy", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/service-definitions";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
  if (!actorId) return flashError(req, res, backTo, "Sign in required.");
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "service_define" });
  if (!auth.allowed) return flashError(req, res, backTo, "You don't hold the service_define badge.");
  try {
    const result = await copyServiceDefinitionAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return flashError(req, res, backTo, `Copy failed: ${result.errors.join("; ")}`);
    return flashSuccess(req, res, `/aisworg/seu/sdk/service-authoring/${result.draftId}`, "Service Definition copied — a new Draft is ready to edit.");
  } catch (err) {
    logger.error("[web/seu/serviceDefinitionRegistry] POST /service-definitions/:id/copy error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
