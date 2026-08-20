import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { findCandidateTemplates } from "../core/templates.js";

/** GET /templates?capabilityCodes=a,b,c — Ch.6 §11: select/validate a Template against required Capabilities. */
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.capabilityCodes === "string" ? req.query.capabilityCodes : "";
    const capabilityCodes = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const candidates = await findCandidateTemplates(capabilityCodes, req.session?.user?.tenant_id ?? null);
    res.status(200).json({ candidates });
  } catch (err) {
    logger.error("[api/seu/templates] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
