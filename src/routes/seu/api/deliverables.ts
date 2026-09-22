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
    const { name, category } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ error: "name and category are required" });
    }
    const result = await createDeliverable({ seuId: String(req.params.id), name, category });
    res.status(201).json({ deliverable: result.deliverable });
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
    const actingBadgeType = typeof req.body?.actingBadgeType === "string" ? req.body.actingBadgeType : undefined;

    // Owner (2026-09-22): "dev/actAs.ts should add the badge to the user in
    // participants_master" — Act-As now writes the assumed badge directly
    // onto the real acting user's own participants_master.authorised_badges
    // (dev/actAs.ts's POST /dev/act-as route, at the point the switcher is
    // set), not a synthetic per-request holder. badgeAuthorityEngine.
    // getHeldBadges reads that same row for this actorId unchanged, so no
    // identity swap is needed here any more — the real actorId already
    // carries whatever's being simulated.
    const effectiveActorId = actorId;

    // Participant Integration — Plan step 4: the assigner may override the
    // SLA-derived default deadline with an explicit target completion time.
    let targetCompletionAt: Date | undefined;
    if (typeof req.body?.targetCompletionAt === "string" && req.body.targetCompletionAt.trim() !== "") {
      const parsed = new Date(req.body.targetCompletionAt);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: "targetCompletionAt must be a valid ISO date/time" });
      targetCompletionAt = parsed;
    }

    const result = await transitionDeliverable({ deliverableId: String(req.params.id), targetState, actorRole, actorId: effectiveActorId, actingBadgeType, requestedBy, targetCompletionAt });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "deliverable not found" });
      const detail = "rows" in result ? { rows: result.rows } : { detail: result.detail };
      return res.status(409).json({ reason: result.reason, ...detail });
    }
    // Governance cleared and a Command was requested — dispatch outcome
    // (assigned / deferred) is decided later, asynchronously, by
    // commandGeneratedHandler/workItemGeneratedHandler/dispatchEngine, and is
    // visible only through their own events. 202 Accepted reflects "accepted,
    // outcome pending" rather than 200 "done".
    res.status(202).json({ fromState: result.fromState, toState: result.toState });
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
