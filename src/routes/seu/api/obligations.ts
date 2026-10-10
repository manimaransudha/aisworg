import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createObligation, listObligationsBySeu, transitionObligation, reviseObligation } from "../core/obligations.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";

async function resolveObligationAuthorBadge(actorId: string): Promise<string> {
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
  return isRoot ? "root" : [...badgeTypes][0] ?? "general";
}

router.post("/obligations", async (req: Request, res: Response) => {
  try {
    const { relatedObjectType, relatedObjectId, category, title, description, severity } = req.body ?? {};
    if (typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "relatedObjectType, relatedObjectId, category and title are required" });
    }
    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });
    const actorId = String(req.session.user.id);
    const authorBadge = await resolveObligationAuthorBadge(actorId);
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
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });
    const actorId = String(req.session.user.id);
    const result = await transitionObligation({ obligationId: String(req.params.id), targetState, actorRole, actorId });

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
    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });
    const actorId = String(req.session.user.id);
    const obligation = await reviseObligation({ obligationId: String(req.params.id), actorId, title, description, category, severity, priority, completionCriteria, assignedEntityType, assignedEntityId });
    if (!obligation) return res.status(404).json({ error: "Obligation not found" });
    res.status(200).json({ obligation });
  } catch (err) {
    logger.error("[api/seu/obligations] PATCH /:id error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
