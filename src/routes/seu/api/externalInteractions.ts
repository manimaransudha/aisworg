import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { readTargetState } from "../../../utils/transitionRequest.js";
import { createExternalInteraction, listExternalInteractionsBySeu, transitionExternalInteraction } from "../core/externalInteractions.js";
import { requireActorId, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";
import type { InteractionDirection } from "../../../dblayer/seuTypes.js";

router.post("/external-interactions", async (req: Request, res: Response) => {
  try {
    const { seuId, deliverableId, interactionType, direction, targetSystem, purpose } = req.body ?? {};
    if (
      typeof seuId !== "string" ||
      typeof interactionType !== "string" || !interactionType.trim() ||
      (direction !== "Inbound" && direction !== "Outbound") ||
      typeof targetSystem !== "string" || !targetSystem.trim()
    ) {
      return res.status(400).json({ error: "seuId, interactionType, direction ('Inbound'|'Outbound') and targetSystem are required" });
    }
    const { actorId, authorBadge } = await resolveActorAndBadge(req);
    const interaction = await createExternalInteraction({ seuId, deliverableId, interactionType, direction: direction as InteractionDirection, targetSystem, purpose, actorId, authorBadge });
    res.status(201).json({ interaction });
  } catch (err) {
    logger.error("[api/seu/externalInteractions] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/external-interactions", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : null;
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ interactions: await listExternalInteractionsBySeu(seuId) });
  } catch (err) {
    logger.error("[api/seu/externalInteractions] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/external-interactions/:id/transition", async (req: Request, res: Response) => {
  try {
    const targetState = readTargetState(req, res);
    if (targetState === null) return;
    const actorId = requireActorId(req);
    const result = await transitionExternalInteraction({ interactionId: String(req.params.id), targetState, actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "External Interaction not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ interaction: result.interaction, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/externalInteractions] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
