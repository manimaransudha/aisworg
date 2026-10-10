import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { completeWorkItem, type WorkItemOutcome } from "../core/workItems.js";
import { sweepStalledWorkItems } from "../core/workItemHeartbeat.js";

const VALID_OUTCOMES: WorkItemOutcome[] = ["done", "failed", "blocked"];

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
    return res.status(200).json({ outcome: result.outcome, workItem: result.workItem });
  } catch (err) {
    logger.error("[api/seu/workItems] POST /work-items/:id/result error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

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
