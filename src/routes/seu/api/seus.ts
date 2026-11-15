import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { notImplemented } from "./notImplemented.js";
import { seuTenantScopeApi } from "../../../middleware/seuTenantScope.js";
import { getSeuGraph } from "../core/seuGraph.js";
import { logger } from "../../../utils/logger.js";

router.param("id", seuTenantScopeApi);

// CR-143 — The data of the Engineering Execution Graph: the nodes, the edges and the moment the data describes.
router.get("/seus/:id/graph", async (req: Request, res: Response) => {
  try {
    const graph = await getSeuGraph(String(req.params.id));
    if (!graph) return res.status(404).json({ error: "SEU not found." });
    return res.json(graph);
  } catch (err) {
    logger.error("[api/seu/seus] GET /seus/:id/graph error", err as Error);
    return res.status(400).json({ error: (err as Error).message });
  }
});

// Unused, untested and so considered not implemented.
router.post("/commission", notImplemented);
router.get("/seus/:id", notImplemented);
router.get("/seus/:id/events", notImplemented);
router.get("/seus/:id/governance-model", notImplemented);

export { router };
