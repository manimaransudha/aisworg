import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createEvidence, listEvidenceBySeu, transitionEvidence } from "../core/evidence.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";

/** POST /evidence — Ch.17: collect an Evidence Item against any governed entity (relatedObjectType/relatedObjectId — polymorphic, Open Design Questions.md #3). */
router.post("/evidence", async (req: Request, res: Response) => {
  try {
    const { seuId, relatedObjectType, relatedObjectId, category, title, description, source, confidenceLevel } = req.body ?? {};
    if (typeof seuId !== "string" || typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, relatedObjectType, relatedObjectId, category and title are required" });
    }
    const evidence = await createEvidence({ seuId, relatedObjectType: relatedObjectType as TransitionEntityType, relatedObjectId, category, title, description, source, confidenceLevel });
    res.status(201).json({ evidence });
  } catch (err) {
    logger.error("[api/seu/evidence] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /evidence?seuId=... — every Evidence Item for a given SEU. */
router.get("/evidence", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : null;
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ evidence: await listEvidenceBySeu(seuId) });
  } catch (err) {
    logger.error("[api/seu/evidence] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /evidence/:id/transition — Ch.17 §9 lifecycle: Collected -> ... -> Archived. */
router.post("/evidence/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const result = await transitionEvidence({ evidenceId: String(req.params.id), targetState, actorRole });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Evidence not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ evidence: result.evidence, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/evidence] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
