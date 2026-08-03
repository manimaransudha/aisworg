import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createDeliverable, transitionDeliverable } from "../core/deliverables.js";

/** POST /seus/:id/deliverables — Ch.15: create a Deliverable beyond whatever the Template catalogue pre-seeded. */
router.post("/seus/:id/deliverables", async (req: Request, res: Response) => {
  try {
    const { name, category, dependsOn } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ error: "name and category are required" });
    }
    const result = await createDeliverable({
      seuId: String(req.params.id),
      name,
      category,
      dependsOnDeliverableIds: dependsOn?.deliverableIds,
      dependsOnServiceIds: dependsOn?.serviceIds,
    });
    res.status(201).json({ deliverable: result.deliverable, dependencyEdges: result.dependencyEdges });
  } catch (err) {
    logger.error("[api/seu/deliverables] POST /seus/:id/deliverables error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /deliverables/:id/transition — Ch.15/Ch.29: dependency readiness, then Authority + Policy. */
router.post("/deliverables/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const result = await transitionDeliverable({ deliverableId: String(req.params.id), targetState, actorRole });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "deliverable not found" });
      const detail = "edges" in result ? { edges: result.edges } : { detail: result.detail };
      return res.status(409).json({ reason: result.reason, ...detail });
    }
    res.status(200).json({ deliverable: result.deliverable, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/deliverables] POST /deliverables/:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
