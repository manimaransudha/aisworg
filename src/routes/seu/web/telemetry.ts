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
import { listSeus } from "../core/seus.js";

router.get("/telemetry", attachVM("seu/telemetry/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seuId = typeof req.query.seuId === "string" && req.query.seuId.trim() ? req.query.seuId.trim() : undefined;
    const [flowMetrics, governanceMetrics, runtimeMetrics, knowledgeMetrics, qualityMetrics, seus] = await Promise.all([
      getFlowMetrics(seuId),
      getGovernanceMetrics(seuId),
      getRuntimeMetrics(seuId),
      getKnowledgeMetrics(seuId),
      getQualityMetrics(seuId),
      listSeus(),
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
    req.vm.opt.seus = seus;
    req.vm.opt.selectedSeuId = seuId ?? null;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/telemetry/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/telemetry] GET /telemetry error", err as Error);
    next(err);
  }
});

export { router };
