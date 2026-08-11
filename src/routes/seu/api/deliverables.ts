import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createDeliverable, transitionDeliverable } from "../core/deliverables.js";
import { explainDeliverable, impactOfDeliverable } from "../core/traceability.js";

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
    const requestedBy = req.session?.user?.id ?? null;
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const actingBadgeGrantId = typeof req.body?.actingBadgeGrantId === "string" ? req.body.actingBadgeGrantId : undefined;

    // Participant Integration — Plan step 4: the assigner may override the
    // SLA-derived default deadline with an explicit target completion time.
    let targetCompletionAt: Date | undefined;
    if (typeof req.body?.targetCompletionAt === "string" && req.body.targetCompletionAt.trim() !== "") {
      const parsed = new Date(req.body.targetCompletionAt);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: "targetCompletionAt must be a valid ISO date/time" });
      targetCompletionAt = parsed;
    }

    const result = await transitionDeliverable({ deliverableId: String(req.params.id), targetState, actorRole, actorId, actingBadgeGrantId, requestedBy, targetCompletionAt });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "deliverable not found" });
      const detail = "edges" in result ? { edges: result.edges } : { detail: result.detail };
      return res.status(409).json({ reason: result.reason, ...detail });
    }
    // Model A (Participant Integration Plan): a successful transition is now a
    // *dispatch*, not an applied state change. The Deliverable stays in its
    // current state until the Participant reports a result to the result-in
    // callback (POST /work-items/:id/result). 202 Accepted reflects "accepted,
    // outstanding" rather than 200 "done".
    res.status(202).json({ dispatched: true, workItemId: result.workItemId, participantId: result.participantId, pendingTransition: result.pendingTransition });
  } catch (err) {
    logger.error("[api/seu/deliverables] POST /deliverables/:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// GET /deliverables/:id/traceability — Ch.20 query surface (Participant
// Integration Plan step 3). Read-only: backward navigation + provenance
// (explanation) and forward navigation + impact analysis (impact), assembled
// from platform-held records only.
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
