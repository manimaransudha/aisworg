import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createObjective } from "../core/objectives.js";

/** POST /objectives — Ch.1: create an Objective with explicitly declared required Capabilities. */
router.post("/objectives", async (req: Request, res: Response) => {
  try {
    const { statement, requiredCapabilityCodes } = req.body ?? {};
    if (typeof statement !== "string" || !statement.trim() || !Array.isArray(requiredCapabilityCodes) || requiredCapabilityCodes.length === 0) {
      return res.status(400).json({ error: "statement (string) and a non-empty requiredCapabilityCodes (string[]) are required" });
    }

    const { objective, requiredCapabilities } = await createObjective({
      statement,
      requiredCapabilityCodes,
      requestedBy: req.session?.user?.id ?? null,
    });

    res.status(201).json({
      id: objective.id,
      status: objective.status,
      requiredCapabilities: requiredCapabilities.map((c) => ({ id: c.id, code: c.code, name: c.name })),
    });
  } catch (err) {
    logger.error("[api/seu/objectives] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
