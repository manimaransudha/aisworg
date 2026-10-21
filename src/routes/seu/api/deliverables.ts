import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { readTargetState } from "../../../utils/transitionRequest.js";
import { createDeliverable, transitionDeliverable } from "../core/deliverables.js";
import { explainDeliverable, impactOfDeliverable } from "../core/traceability.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";

router.post("/seus/:id/deliverables", async (req: Request, res: Response) => {
  try {
    const { name, category } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ error: "name and category are required" });
    }
    const result = await createDeliverable({ seuId: String(req.params.id), name, category, actorId: requireActorId(req) });
    res.status(201).json({ deliverable: result.deliverable });
  } catch (err) {
    logger.error("[api/seu/deliverables] POST /seus/:id/deliverables error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/deliverables/:id/transition", async (req: Request, res: Response) => {
  try {
    const targetState = readTargetState(req, res);
    if (targetState === null) return;
    const actorId = requireActorId(req);

    const result = await transitionDeliverable({ deliverableId: String(req.params.id), targetState, actorId, requestedBy: actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "deliverable not found" });
      const detail = "rows" in result ? { rows: result.rows } : { detail: result.detail };
      return res.status(409).json({ reason: result.reason, ...detail });
    }
    res.status(202).json({ fromState: result.fromState, toState: result.toState });
  } catch (err) {
    logger.error("[api/seu/deliverables] POST /deliverables/:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/deliverables/:id/traceability", async (req: Request, res: Response) => {
  try {
    const [explanation, impact] = await Promise.all([
      explainDeliverable(String(req.params.id)),
      impactOfDeliverable(String(req.params.id)),
    ]);
    if (!explanation || !impact) return res.status(404).json({ error: "deliverable not found" });
    res.status(200).json({ explanation, impact });
  } catch (err) {
    logger.error("[api/seu/deliverables] GET /deliverables/:id/traceability error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
