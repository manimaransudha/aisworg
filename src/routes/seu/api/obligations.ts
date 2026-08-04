import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createObligation, listObligationsBySeu, transitionObligation } from "../core/obligations.js";

/** POST /obligations — Ch.23: create an Obligation against a Deliverable. */
router.post("/obligations", async (req: Request, res: Response) => {
  try {
    const { seuId, deliverableId, category, title, description, severity } = req.body ?? {};
    if (typeof seuId !== "string" || typeof deliverableId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, deliverableId, category and title are required" });
    }
    const obligation = await createObligation({ seuId, deliverableId, category, title, description, severity });
    res.status(201).json({ obligation });
  } catch (err) {
    logger.error("[api/seu/obligations] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /obligations?seuId=... — every Obligation for a given SEU. */
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

/** POST /obligations/:id/transition — Ch.23 §9 lifecycle: Identified -> ... -> Archived. */
router.post("/obligations/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const result = await transitionObligation({ obligationId: String(req.params.id), targetState, actorRole });

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

export { router };
