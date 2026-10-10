import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { listAttentionItems, listAttentionItemsBySeu, transitionAttentionItem } from "../core/attentionItems.js";

router.get("/attention-items", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : null;
    const attentionItems = seuId ? await listAttentionItemsBySeu(seuId) : await listAttentionItems();
    res.status(200).json({ attentionItems });
  } catch (err) {
    logger.error("[api/seu/attentionItems] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/attention-items/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });
    const actorId = String(req.session.user.id);
    const result = await transitionAttentionItem({ attentionItemId: String(req.params.id), targetState, actorRole, actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Attention Item not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ attentionItem: result.attentionItem, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/attentionItems] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
