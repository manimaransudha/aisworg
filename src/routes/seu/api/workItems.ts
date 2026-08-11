import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { completeWorkItem, type WorkItemOutcome } from "../core/workItems.js";
import { sweepStalledWorkItems } from "../core/workItemHeartbeat.js";

// Participant Integration & Attestation — Plan, step 1 (Model A): the "result-in"
// side of the two-sided contract (§0.1). A Participant that finished (or failed,
// or is blocked on) an out-of-process Work Item reports the result here, and the
// platform drives the governed transition the Work Item was dispatched for.
//
// This is ONE edge adapter — the in-house, session-authenticated HTTP form.
// It is deliberately thin: it normalises the request into the tenant-invariant
// { workItemId, outcome, reference } shape and hands off to core. Per-tenant
// callback formats, webhooks, HMAC/signature verification, and AI-orchestrator
// protocols are all *other* adapters that will normalise to the same shape and
// call the same core (Plan §6 / Phase-12 slice) — the core never changes when
// a new edge is added. Auth today is the shared session guard on the /api/seu
// mount (requireRole('general')); a real webhook adapter would carry its own
// per-tenant auth at the edge, not here.
const VALID_OUTCOMES: WorkItemOutcome[] = ["done", "failed", "blocked"];

/** POST /work-items/:id/result — result-in callback (Ch.32/Ch.33, async form). */
router.post("/work-items/:id/result", async (req: Request, res: Response) => {
  try {
    const { outcome, reference } = req.body ?? {};
    if (typeof outcome !== "string" || !VALID_OUTCOMES.includes(outcome as WorkItemOutcome)) {
      return res.status(400).json({ error: `outcome must be one of ${VALID_OUTCOMES.join(", ")}` });
    }
    if (reference != null && typeof reference !== "string") {
      return res.status(400).json({ error: "reference, when present, must be a string" });
    }

    const result = await completeWorkItem({
      workItemId: String(req.params.id),
      outcome: outcome as WorkItemOutcome,
      reference: typeof reference === "string" ? reference : null,
    });

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      return res.status(status).json({ reason: result.reason, detail: result.detail });
    }

    if (result.outcome === "done") {
      return res.status(200).json({
        outcome: "done",
        workItem: result.workItem,
        deliverable: result.deliverable,
        appliedTransition: result.appliedTransition,
      });
    }
    // failed/blocked: accepted, transition not applied, an Attention Item was raised.
    return res.status(200).json({ outcome: result.outcome, workItem: result.workItem });
  } catch (err) {
    logger.error("[api/seu/workItems] POST /work-items/:id/result error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// POST /work-items/sweep-stalled — the scheduler hook (Plan step 4). A cron /
// heartbeat calls this periodically; it raises an Escalation Attention Item for
// every outstanding Work Item past its Capability's turnaround SLA. Idempotent
// (one open Escalation per stalled Deliverable), so it is safe to call as often
// as the scheduler likes. Real cron wiring is deployment-time; the endpoint is
// the seam.
router.post("/work-items/sweep-stalled", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : undefined;
    const result = await sweepStalledWorkItems({ seuId });
    res.status(200).json(result);
  } catch (err) {
    logger.error("[api/seu/workItems] POST /work-items/sweep-stalled error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
