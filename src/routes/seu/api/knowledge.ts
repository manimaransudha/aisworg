import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { addKnowledgeValidationNote, createKnowledgeItem, getEngineeringCapital, listKnowledgeItemsBySeu, listKnowledgeValidationNotes, promoteKnowledgeItemScope, transitionKnowledgeItem, updateKnowledgeReferences } from "../core/knowledge.js";
import type { AcquisitionScope, KnowledgeRelationshipReferences, KnowledgeSelfReferences } from "../../../dblayer/seuTypes.js";

/** POST /knowledge — Ch.16: observe a Knowledge Item against a Deliverable. */
router.post("/knowledge", async (req: Request, res: Response) => {
  try {
    const { seuId, deliverableId, category, title, description, acquisitionScope, deliverableReferences, evidenceReferences, decisionReferences, knowledgeReferences, confidenceLevel } = req.body ?? {};
    if (typeof seuId !== "string" || typeof deliverableId !== "string" || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "seuId, deliverableId, category and title are required" });
    }
    const userId = req.session?.user?.id != null ? Number(req.session.user.id) : undefined;
    const knowledgeItem = await createKnowledgeItem({
      seuId,
      deliverableId,
      category,
      title,
      description,
      acquisitionScope: acquisitionScope as AcquisitionScope | undefined,
      deliverableReferences: deliverableReferences as KnowledgeRelationshipReferences | undefined,
      evidenceReferences: evidenceReferences as KnowledgeRelationshipReferences | undefined,
      decisionReferences: decisionReferences as KnowledgeRelationshipReferences | undefined,
      knowledgeReferences: knowledgeReferences as KnowledgeSelfReferences | undefined,
      confidenceLevel,
      userId,
    });
    res.status(201).json({ knowledgeItem });
  } catch (err) {
    logger.error("[api/seu/knowledge] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** PATCH /knowledge/:id/references — Ch.16 §10: update Related Knowledge (self-referencing; rejects the item's own id). */
router.patch("/knowledge/:id/references", async (req: Request, res: Response) => {
  try {
    const { knowledgeReferences } = req.body ?? {};
    if (typeof knowledgeReferences !== "object" || knowledgeReferences === null) {
      return res.status(400).json({ error: "knowledgeReferences (object) is required" });
    }
    const knowledgeItem = await updateKnowledgeReferences(String(req.params.id), knowledgeReferences as KnowledgeSelfReferences);
    res.status(200).json({ knowledgeItem });
  } catch (err) {
    logger.error("[api/seu/knowledge] PATCH /:id/references error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /knowledge/:id/validation-notes — Ch.16 §11/§14: append (never overwrite) a validation/review note. */
router.post("/knowledge/:id/validation-notes", async (req: Request, res: Response) => {
  try {
    const { noteText } = req.body ?? {};
    if (typeof noteText !== "string" || !noteText.trim()) {
      return res.status(400).json({ error: "noteText is required" });
    }
    const actorUserId = req.session?.user?.id != null ? Number(req.session.user.id) : undefined;
    const note = await addKnowledgeValidationNote({ knowledgeItemId: String(req.params.id), noteText, actorUserId });
    res.status(201).json({ note });
  } catch (err) {
    logger.error("[api/seu/knowledge] POST /:id/validation-notes error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /knowledge/:id/validation-notes — the full, append-only note history. */
router.get("/knowledge/:id/validation-notes", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ notes: await listKnowledgeValidationNotes(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/knowledge] GET /:id/validation-notes error", err as Error);
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
    const userId = req.session?.user?.id != null ? Number(req.session.user.id) : undefined;
    const result = await promoteKnowledgeItemScope({ knowledgeItemId: String(req.params.id), targetScope: targetScope as AcquisitionScope, actorRole, actorId, userId });

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
    const userId = req.session?.user?.id != null ? Number(req.session.user.id) : undefined;
    const result = await transitionKnowledgeItem({ knowledgeItemId: String(req.params.id), targetState, actorRole, actorId, userId });

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
