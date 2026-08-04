import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createDecision, listDecisionsBySeu, transitionDecision } from "../core/decisions.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";

/** POST /decisions — Ch.19: identify a Decision against any governed entity (relatedObjectType/relatedObjectId — polymorphic, Open Design Questions.md #3). */
router.post("/decisions", async (req: Request, res: Response) => {
  try {
    const { seuId, relatedObjectType, relatedObjectId, knowledgeId, evidenceId, category, title, engineeringQuestion, selectedAlternative, rationale } = req.body ?? {};
    if (typeof seuId !== "string" || typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, relatedObjectType, relatedObjectId, category and title are required" });
    }
    const decision = await createDecision({ seuId, relatedObjectType: relatedObjectType as TransitionEntityType, relatedObjectId, knowledgeId, evidenceId, category, title, engineeringQuestion, selectedAlternative, rationale });
    res.status(201).json({ decision });
  } catch (err) {
    logger.error("[api/seu/decisions] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /decisions?seuId=... — every Decision for a given SEU. */
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

/** POST /decisions/:id/transition — Ch.19 §9 lifecycle: Identified -> ... -> Archived. */
router.post("/decisions/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const result = await transitionDecision({ decisionId: String(req.params.id), targetState, actorRole });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Decision not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ decision: result.decision, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/decisions] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
