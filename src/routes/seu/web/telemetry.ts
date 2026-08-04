import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { getFlowMetrics, getGovernanceMetrics } from "../core/telemetry.js";

/** GET /aisworg/seu/telemetry — Ch.35: Flow and Governance metrics, platform-wide, derived from real activity. */
router.get("/telemetry", attachVM("seu/telemetry/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [flowMetrics, governanceMetrics] = await Promise.all([getFlowMetrics(), getGovernanceMetrics()]);
    req.vm.req.title = "Engineering Telemetry";
    req.vm.req.flowMetrics = flowMetrics;
    req.vm.req.governanceMetrics = governanceMetrics;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/telemetry/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/telemetry] GET /telemetry error", err as Error);
    next(err);
  }
});

export { router };
