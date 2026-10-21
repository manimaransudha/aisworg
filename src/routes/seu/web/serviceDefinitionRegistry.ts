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
import { listServiceDefinitionsWithNextStates, copyServiceDefinitionAsNewDraft } from "../core/serviceDefinitions.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
import { resolveHeldBadges, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";

const SERVICE_DEFINITION_STATES = ["Defined", "Published", "Active", "Deprecated", "Retired", "Archived"];

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
    req.vm.opt.platformTenantId = await getPlatformTenantId();
    const held = await resolveHeldBadges(req);
    const canCopy = held.has("service_define");
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/service-definitions/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/serviceDefinitionRegistry] GET /service-definitions error", err as Error);
    next(err);
  }
});

router.post("/service-definitions/:id/copy", async (req: Request, res: Response) => {
  const { actorId } = await resolveActorAndBadge(req);
  try {
    const result = await copyServiceDefinitionAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return redirects.seu.serviceDefinitionsCopy.error(req, res, `Copy failed: ${result.errors.join("; ")}`);
    return redirects.seu.serviceDefinitionsCopy.success(req, res, "Service Definition copied — a new Draft is ready to edit.", `/aisworg/seu/sdk/service-authoring/${result.draftId}`);
  } catch (err) {
    logger.error("[web/seu/serviceDefinitionRegistry] POST /service-definitions/:id/copy error", err as Error);
    return redirects.seu.serviceDefinitionsCopy.error(req, res, (err as Error).message);
  }
});

export { router };
