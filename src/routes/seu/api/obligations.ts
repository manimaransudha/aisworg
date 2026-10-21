import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { readTargetState } from "../../../utils/transitionRequest.js";
import { createObligation, listObligationsBySeu, transitionObligation, reviseObligation } from "../core/obligations.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { requireActorId, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";

router.post("/obligations", async (req: Request, res: Response) => {
  try {
    const { relatedObjectType, relatedObjectId, category, title, description, severity } = req.body ?? {};
    if (typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "relatedObjectType, relatedObjectId, category and title are required" });
    }
    const { actorId, authorBadge } = await resolveActorAndBadge(req);
    const obligation = await createObligation({ relatedObjectType: relatedObjectType as TransitionEntityType, relatedObjectId, category, title, description, severity, actorId, authorBadge });
    res.status(201).json({ obligation });
  } catch (err) {
    logger.error("[api/seu/obligations] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/obligations", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : null;
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ obligations: await listObligationsBySeu(seuId) });
  } catch (err) {
    logger.error("[api/seu/obligations] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/obligations/:id/transition", async (req: Request, res: Response) => {
  try {
    const targetState = readTargetState(req, res);
    if (targetState === null) return;
    const actorId = requireActorId(req);
    const result = await transitionObligation({ obligationId: String(req.params.id), targetState, actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Obligation not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ obligation: result.obligation, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/obligations] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch("/obligations/:id", async (req: Request, res: Response) => {
  try {
    const { title, description, category, severity, priority, completionCriteria, assignedEntityType, assignedEntityId } = req.body ?? {};
    const actorId = requireActorId(req);
    const obligation = await reviseObligation({ obligationId: String(req.params.id), actorId, title, description, category, severity, priority, completionCriteria, assignedEntityType, assignedEntityId });
    if (!obligation) return res.status(404).json({ error: "Obligation not found" });
    res.status(200).json({ obligation });
  } catch (err) {
    logger.error("[api/seu/obligations] PATCH /:id error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
