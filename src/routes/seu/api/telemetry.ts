import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { getFlowMetrics, getGovernanceMetrics, getRuntimeMetrics, getKnowledgeMetrics, getQualityMetrics } from "../core/telemetry.js";

/** GET /telemetry?seuId=... — Ch.35: Flow, Governance, Runtime, Knowledge, and Quality metrics, platform-wide by default, or narrowed to one SEU (Build order step 2). */
router.get("/telemetry", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" && req.query.seuId.trim() ? req.query.seuId.trim() : undefined;
    const [flowMetrics, governanceMetrics, runtimeMetrics, knowledgeMetrics, qualityMetrics] = await Promise.all([
      getFlowMetrics(seuId),
      getGovernanceMetrics(seuId),
      getRuntimeMetrics(seuId),
      getKnowledgeMetrics(seuId),
      getQualityMetrics(seuId),
    ]);
    res.status(200).json({ seuId: seuId ?? null, flowMetrics, governanceMetrics, runtimeMetrics, knowledgeMetrics, qualityMetrics });
  } catch (err) {
    logger.error("[api/seu/telemetry] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
