import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createDecision, listDecisionsBySeu } from "../core/decisions.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";

router.post("/decisions", async (req: Request, res: Response) => {
  try {
    const { seuId, originatingType, originatingId, relatedObjects, relatedSeu, knowledgeIds, evidenceIds, category, title, engineeringQuestion, alternatives } = req.body ?? {};
    if (typeof seuId !== "string" || !Array.isArray(relatedObjects) || relatedObjects.length === 0 || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, relatedObjects (non-empty array), category and title are required" });
    }
    const actorId = requireActorId(req);
    const decision = await createDecision({
      seuId,
      actorId,
      originatingType,
      originatingId,
      relatedObjects,
      relatedSeu,
      knowledgeIds,
      evidenceIds,
      category,
      title,
      engineeringQuestion,
      alternatives,
    });
    res.status(201).json({ decision });
  } catch (err) {
    logger.error("[api/seu/decisions] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/decisions", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : null;
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ decisions: await listDecisionsBySeu(seuId) });
  } catch (err) {
    logger.error("[api/seu/decisions] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// CR-131: no caller; the web route .../decisions/:decisionId/transition/:verb performs the hop.
// router.post("/decisions/:id/transition", async (req: Request, res: Response) => {
//   try {
//     const targetState = readTargetState(req, res);
//     if (targetState === null) return;
//     const actorId = requireActorId(req);
//     const result = await transitionDecision({ decisionId: String(req.params.id), targetState, actorId });
//
//     if (!result.ok) {
//       if (result.reason === "not_found") return res.status(404).json({ error: "Decision not found" });
//       return res.status(409).json({ reason: result.reason, detail: result.detail });
//     }
//     res.status(200).json({ decision: result.decision, appliedTransition: result.appliedTransition });
//   } catch (err) {
//     logger.error("[api/seu/decisions] POST /:id/transition error", err as Error);
//     res.status(400).json({ error: (err as Error).message });
//   }
// });

export { router };
