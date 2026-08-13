import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createKnowledgeItem, getEngineeringCapital, listKnowledgeItemsBySeu, promoteKnowledgeItemScope, transitionKnowledgeItem } from "../core/knowledge.js";
import type { AcquisitionScope } from "../../../dblayer/seuTypes.js";

/** POST /knowledge — Ch.16: observe a Knowledge Item against a Deliverable. */
router.post("/knowledge", async (req: Request, res: Response) => {
  try {
    const { seuId, deliverableId, evidenceId, category, title, description, acquisitionScope } = req.body ?? {};
    if (typeof seuId !== "string" || typeof deliverableId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, deliverableId, category and title are required" });
    }
    const knowledgeItem = await createKnowledgeItem({
      seuId,
      deliverableId,
      evidenceId,
      category,
      title,
      description,
      acquisitionScope: acquisitionScope as AcquisitionScope | undefined,
    });
    res.status(201).json({ knowledgeItem });
  } catch (err) {
    logger.error("[api/seu/knowledge] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /knowledge?seuId=... — every Knowledge Item for a given SEU. */
router.get("/knowledge", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : null;
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ knowledgeItems: await listKnowledgeItemsBySeu(seuId) });
  } catch (err) {
    logger.error("[api/seu/knowledge] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /knowledge/capital — Ch.16 §13 / Book 1 Ch.21 §21.6: Engineering Capital, platform-wide. */
router.get("/knowledge/capital", async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ engineeringCapital: await getEngineeringCapital() });
  } catch (err) {
    logger.error("[api/seu/knowledge] GET /capital error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /knowledge/:id/promote-scope — Ch.16 §12: governed Acquisition Scope promotion; raises an Organisational Learning Obligation (Ch.23 §7). */
router.post("/knowledge/:id/promote-scope", async (req: Request, res: Response) => {
  try {
    const { targetScope } = req.body ?? {};
    if (typeof targetScope !== "string" || !targetScope.trim()) {
      return res.status(400).json({ error: "targetScope is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const result = await promoteKnowledgeItemScope({ knowledgeItemId: String(req.params.id), targetScope: targetScope as AcquisitionScope, actorRole, actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Knowledge Item not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ knowledgeItem: result.knowledgeItem, appliedTransition: result.appliedTransition, obligation: result.obligation });
  } catch (err) {
    logger.error("[api/seu/knowledge] POST /:id/promote-scope error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /knowledge/:id/transition — Ch.16 §9 lifecycle: Observed -> ... -> Archived. */
router.post("/knowledge/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const result = await transitionKnowledgeItem({ knowledgeItemId: String(req.params.id), targetState, actorRole, actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Knowledge Item not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ knowledgeItem: result.knowledgeItem, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/knowledge] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
