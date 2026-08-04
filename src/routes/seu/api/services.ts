import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { listServices } from "../core/services.js";

/** GET /services — Ch.11: every declared Service and its Service Level. */
router.get("/services", async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ services: await listServices() });
  } catch (err) {
    logger.error("[api/seu/services] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
