import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import {
  getFlowMetrics,
  getGovernanceMetrics,
  getRuntimeMetrics,
  getKnowledgeMetrics,
  getQualityMetrics,
  checkSustainedPolicyWaivers,
  checkSustainedCapabilityShortages,
} from "../core/telemetry.js";
// import { listSeus } from "../core/seus.js";
import { listSeusPaginated } from "../core/seus.js";
import { parseListParams } from "../../../utils/listQuery.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";

router.get("/telemetry", attachVM("seu/telemetry/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platformBadges: string[] = req.session?.user?.platformBadges ?? [];
    const isRoot = platformBadges.includes("root");
    const sessionTenantId = req.session?.user?.tenant_id ?? null;
    if (!isRoot && !sessionTenantId) throw new Error("the session user has no tenant");
    // A selected SEU is used only when the viewer's tenant owns it.
    const requestedSeuId = typeof req.query.seuId === "string" && req.query.seuId.trim() ? req.query.seuId.trim() : undefined;
    const requestedSeu = requestedSeuId ? (await seusDB.findById(requestedSeuId)).data : null;
    const selectedSeu = requestedSeu && (isRoot || requestedSeu.tenant_id === sessionTenantId) ? requestedSeu : null;
    const seuId = selectedSeu?.id;
    const selectedObjective = selectedSeu ? (await objectivesDB.findById(selectedSeu.objective_id)).data : null;
    const params = parseListParams(req.query, { sortable: ["objective", "state", "created"], defaultSort: "created", defaultDir: "desc" });
    const seus = await listSeusPaginated(params, {
      userId: requireActorId(req),
      isAdmin: isRoot || platformBadges.includes("tenant_admin") || platformBadges.includes("tenant_manage"),
      tenantId: isRoot ? null : sessionTenantId,
    });
    seus.seuId = seuId;
    const [flowMetrics, governanceMetrics, runtimeMetrics, knowledgeMetrics, qualityMetrics] = await Promise.all([
      getFlowMetrics(seuId),
      getGovernanceMetrics(seuId),
      getRuntimeMetrics(seuId),
      getKnowledgeMetrics(seuId),
      getQualityMetrics(seuId),
      // listSeus(),
    ]);

    try {
      await Promise.all([checkSustainedPolicyWaivers(), checkSustainedCapabilityShortages()]);
    } catch (patternErr) {
      logger.error("[web/seu/telemetry] sustained-pattern check error", patternErr as Error);
    }

    req.vm.req.title = "Engineering Telemetry";
    req.vm.req.flowMetrics = flowMetrics;
    req.vm.req.governanceMetrics = governanceMetrics;
    req.vm.req.runtimeMetrics = runtimeMetrics;
    req.vm.req.knowledgeMetrics = knowledgeMetrics;
    req.vm.req.qualityMetrics = qualityMetrics;
    req.vm.req.seuList = seus;
    req.vm.opt.listBasePath = "/aisworg/seu/telemetry";
    req.vm.opt.selectedSeuId = seuId ?? null;
    req.vm.opt.selectedSeuObjective = selectedObjective?.statement ?? null;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/telemetry/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/telemetry] GET /telemetry error", err as Error);
    next(err);
  }
});

export { router };
