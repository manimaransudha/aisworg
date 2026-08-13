import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createExternalInteraction, listExternalInteractionsBySeu, transitionExternalInteraction } from "../core/externalInteractions.js";
import type { InteractionDirection } from "../../../dblayer/seuTypes.js";

/** POST /external-interactions — Ch.36: record an External Interaction against a SEU (optionally a Deliverable). */
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
    const interaction = await createExternalInteraction({ seuId, deliverableId, interactionType, direction: direction as InteractionDirection, targetSystem, purpose });
    res.status(201).json({ interaction });
  } catch (err) {
    logger.error("[api/seu/externalInteractions] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /external-interactions?seuId=... — every External Interaction for a given SEU. */
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

/** POST /external-interactions/:id/transition — Ch.36 §9 lifecycle: Created -> ... -> Archived (or -> Failed). */
router.post("/external-interactions/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const result = await transitionExternalInteraction({ interactionId: String(req.params.id), targetState, actorRole, actorId });

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
