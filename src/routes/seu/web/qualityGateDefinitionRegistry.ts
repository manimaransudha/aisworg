import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();
router.param("id", definitionTenantScope(qualityGateDefinitionsDB.findById, (row) => row.tenant_id, "Quality Gate Definition not found."));

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { qualityGateDefinitionsDB } from "../../../dblayer/qualityGateDefinitionsDB.js";
import { definitionTenantScope } from "../../../middleware/seuTenantScope.js";
import { logger } from "../../../utils/logger.js";
import { listQualityGateDefinitionsWithNextStates, copyQualityGateDefinitionAsNewDraft } from "../core/qualityGateDefinitions.js";
import { getQualityGateView } from "../core/qualityGateView.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
import { resolveHeldBadges, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";
 
const QUALITY_GATE_DEFINITION_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

router.get("/quality-gate-definitions", attachVM("seu/quality-gate-definitions/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Quality Gate Definitions";
    const params = parseListParams(req.query, { sortable: ["code", "version", "status"], defaultSort: "code", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const rows = await listQualityGateDefinitionsWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    const activeStatus = typeof req.query.status === "string" && QUALITY_GATE_DEFINITION_STATES.includes(req.query.status) ? req.query.status : "";
    const scoped = activeStatus ? rows.filter((r) => r.qualityGateDefinition.status === activeStatus) : rows;
    const list = paginateList(scoped, params, {
      searchFields: [(r) => r.qualityGateDefinition.code, (r) => r.qualityGateDefinition.name],
      sortFields: { code: (r) => r.qualityGateDefinition.code, version: (r) => r.qualityGateDefinition.version, status: (r) => r.qualityGateDefinition.status },
    });
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/quality-gate-definitions";
    req.vm.opt.states = QUALITY_GATE_DEFINITION_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = await getPlatformTenantId();
    req.vm.opt.tenantNameById = Object.fromEntries(((await tenantsDB.findAll()).data ?? []).map((t) => [t.id, t.name]));
    const held = await resolveHeldBadges(req);
    const { data: birth } = await transitionDefinitionsDB.findBirth("QualityGate");
    if (!birth?.verb) throw new Error("no birth Transition Definition with a verb for QualityGate");
    const canCopy = held.has(`${birth.entity_type.toLowerCase()}_${birth.verb}`);
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/quality-gate-definitions/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/qualityGateDefinitionRegistry] GET /quality-gate-definitions error", err as Error);
    next(err);
  }
});

router.get("/quality-gate-definitions/:id", attachVM("seu/quality-gate-definitions/view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const viewer = { isRoot: (req.session?.user?.platformBadges ?? []).includes("root"), tenantId: req.session?.user?.tenant_id ?? null };
    const view = await getQualityGateView(String(req.params.id), viewer);
    if (!view) return redirects.seu.qualityGateDefinitionsView.error(req, res, "Quality Gate Definition not found.");
    req.vm.req.title = `Quality Gate Definition: ${view.qualityGate.name}`;
    req.vm.req.qualityGate = view.qualityGate;
    req.vm.req.labels = view.labels;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/quality-gate-definitions/view", req.vm);
  } catch (err) {
    logger.error("[web/seu/qualityGateDefinitionRegistry] GET /quality-gate-definitions/:id error", err as Error);
    next(err);
  }
});

router.post("/quality-gate-definitions/:id/copy", async (req: Request, res: Response) => {
  const { actorId } = await resolveActorAndBadge(req);
  try {
    const result = await copyQualityGateDefinitionAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return redirects.seu.qualityGateDefinitionsCopy.error(req, res, `Copy failed: ${result.errors.join("; ")}`);
    return redirects.seu.qualityGateDefinitionsCopy.success(req, res, "Quality Gate Definition copied — a new Draft is ready to edit.", `/aisworg/seu/sdk/quality-gate-authoring/${result.draftId}`);
  } catch (err) {
    logger.error("[web/seu/qualityGateDefinitionRegistry] POST /quality-gate-definitions/:id/copy error", err as Error);
    return redirects.seu.qualityGateDefinitionsCopy.error(req, res, (err as Error).message);
  }
});

export { router };
