import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { grantQualityGateWaiver, listQualityGateWaivers } from "../core/qualityGateWaivers.js";

router.post("/seus/:id/quality-gate-waivers", async (req: Request, res: Response) => {
  try {
    const { qualityGateId, entityType, entityId, rationale, expiresAt } = req.body ?? {};
    if (typeof qualityGateId !== "string" || !qualityGateId.trim()) return res.status(400).json({ error: "qualityGateId is required" });
    if (typeof entityType !== "string" || !entityType.trim() || typeof entityId !== "string" || !entityId.trim()) {
      return res.status(400).json({ error: "entityType and entityId are required" });
    }
    if (typeof rationale !== "string" || !rationale.trim()) return res.status(400).json({ error: "rationale is required" });
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
    if (!actorId) return res.status(401).json({ error: "authentication required" });

    const result = await grantQualityGateWaiver({
      qualityGateId,
      seuId: String(req.params.id),
      entityType,
      entityId,
      rationale,
      actorId,
      expiresAt: typeof expiresAt === "string" ? expiresAt : null,
    });
    if (!result.ok) return res.status(403).json({ error: result.reason });
    res.status(200).json({ waiver: result.waiver });
  } catch (err) {
    logger.error("[api/seu/qualityGateWaivers] POST waiver error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id/quality-gate-waivers", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ waivers: await listQualityGateWaivers(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/qualityGateWaivers] GET waivers error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
