import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createEvidence, listEvidenceBySeu, linkEvidenceToObject, recordValidationAssessment } from "../core/evidence.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { requireActorId, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";

router.post("/evidence", async (req: Request, res: Response) => {
  try {
    const { seuId, relatedObjectType, relatedObjectId, category, title, description, source, supersedesEvidenceId } = req.body ?? {};
    if (typeof seuId !== "string" || typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, relatedObjectType, relatedObjectId, category and title are required" });
    }
    const { actorId, authorBadge } = await resolveActorAndBadge(req);

    const evidence = await createEvidence({
      seuId, relatedObjectType: relatedObjectType as TransitionEntityType, relatedObjectId, category, title, description, source,
      supersedesEvidenceId, actorId, authorBadge,
    });
    res.status(201).json({ evidence });
  } catch (err) {
    logger.error("[api/seu/evidence] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/evidence/:id/validate", async (req: Request, res: Response) => {
  try {
    const { dimension, status, notes } = req.body ?? {};
    if (typeof dimension !== "string" || !dimension.trim() || typeof status !== "string" || !status.trim()) {
      return res.status(400).json({ error: "dimension and status are required" });
    }
    const result = await recordValidationAssessment({ evidenceId: String(req.params.id), dimension, status, notes });
    if (!result.ok) return res.status(404).json({ error: "Evidence not found" });
    res.status(200).json({ evidence: result.evidence });
  } catch (err) {
    logger.error("[api/seu/evidence] POST /:id/validate error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

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

// CR-128 (owner): the API transition route has no caller and is commented out. Transitions go through the web route with a verb.
// router.post("/evidence/:id/transition", async (req: Request, res: Response) => {
//   try {
//     const targetState = readTargetState(req, res);
//     if (targetState === null) return;
//     const actorId = requireActorId(req);
//     const result = await transitionEvidence({ evidenceId: String(req.params.id), targetState, actorId });
//
//     if (!result.ok) {
//       if (result.reason === "not_found") return res.status(404).json({ error: "Evidence not found" });
//       return res.status(409).json({ reason: result.reason, detail: result.detail });
//     }
//     res.status(200).json({ evidence: result.evidence, appliedTransition: result.appliedTransition });
//   } catch (err) {
//     logger.error("[api/seu/evidence] POST /:id/transition error", err as Error);
//     res.status(400).json({ error: (err as Error).message });
//   }
// });

router.post("/evidence/:id/link", async (req: Request, res: Response) => {
  try {
    const { relatedObjectType, relatedObjectId } = req.body ?? {};
    if (typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string") {
      return res.status(400).json({ error: "relatedObjectType and relatedObjectId are required" });
    }
    const { actorId, authorBadge } = await resolveActorAndBadge(req);

    const result = await linkEvidenceToObject(String(req.params.id), relatedObjectType as TransitionEntityType, relatedObjectId, actorId, authorBadge);
    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Evidence not found" });
      return res.status(400).json({ error: result.detail ?? "invalid link" });
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("[api/seu/evidence] POST /:id/link error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
