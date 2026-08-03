import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createProfile } from "../core/profiles.js";

/** POST /profiles — Ch.7: apply a Profile (config/environment/optional Packs) to a Template. */
router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const { templateId, environment, configParameters } = req.body ?? {};
    if (typeof templateId !== "string" || !templateId) {
      return res.status(400).json({ error: "templateId is required" });
    }
    const profile = await createProfile({ templateId, environment, configParameters });
    res.status(201).json({ id: profile.id, code: profile.code, baseTemplateId: profile.base_template_id, environment: profile.environment });
  } catch (err) {
    logger.error("[api/seu/profiles] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
