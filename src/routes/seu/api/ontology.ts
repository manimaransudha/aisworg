import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { setAlias, clearAlias, listAliases, resolveLabels } from "../core/ontology.js";

router.get("/ontology/concepts", async (req: Request, res: Response) => {
  try {
    const conceptType = typeof req.query.conceptType === "string" ? req.query.conceptType : "";
    if (!conceptType) return res.status(400).json({ error: "conceptType query parameter is required" });
    const { data } = await ontologyDB.findConceptsByType(conceptType, { isRoot: false, tenantId: null });
    res.status(200).json({ concepts: data ?? [] });
  } catch (err) {
    logger.error("[api/seu/ontology] GET /ontology/concepts error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/tenants/:id/vocabulary", async (req: Request, res: Response) => {
  try {
    const conceptType = typeof req.query.conceptType === "string" ? req.query.conceptType : "";
    if (!conceptType) return res.status(400).json({ error: "conceptType query parameter is required" });
    res.status(200).json({ conceptType, labels: await resolveLabels(String(req.params.id), conceptType) });
  } catch (err) {
    logger.error("[api/seu/ontology] GET vocabulary error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/tenants/:id/aliases", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ aliases: await listAliases(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/ontology] GET aliases error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/tenants/:id/aliases", async (req: Request, res: Response) => {
  try {
    const { conceptType, canonicalCode, displayLabel } = req.body ?? {};
    if (typeof conceptType !== "string" || !conceptType.trim() || typeof canonicalCode !== "string" || !canonicalCode.trim()) {
      return res.status(400).json({ error: "conceptType and canonicalCode are required" });
    }
    if (typeof displayLabel !== "string" || displayLabel.trim() === "") {
      await clearAlias(String(req.params.id), conceptType, canonicalCode);
      return res.status(200).json({ cleared: true });
    }
    const alias = await setAlias({ tenantId: String(req.params.id), conceptType, canonicalCode, displayLabel });
    res.status(200).json({ alias });
  } catch (err) {
    logger.error("[api/seu/ontology] POST aliases error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
