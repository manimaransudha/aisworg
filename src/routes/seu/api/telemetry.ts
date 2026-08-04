import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { getFlowMetrics, getGovernanceMetrics } from "../core/telemetry.js";

/** GET /telemetry — Ch.35: Flow and Governance metrics derived from real Phase 3-6 activity, platform-wide. */
router.get("/telemetry", async (_req: Request, res: Response) => {
  try {
    const [flowMetrics, governanceMetrics] = await Promise.all([getFlowMetrics(), getGovernanceMetrics()]);
    res.status(200).json({ flowMetrics, governanceMetrics });
  } catch (err) {
    logger.error("[api/seu/telemetry] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
