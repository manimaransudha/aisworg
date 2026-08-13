import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { completeWorkItem, type WorkItemOutcome } from "../core/workItems.js";
import { resolveExecutionTarget } from "../../../adapters/executionTargetResolver.js";

// Participant Integration — Plan step 5, Resolution 10. The human-on-UI
// completion surface: a LABELLED STUB. It lists a SEU's outstanding Work Items
// and lets a human report the result (done/failed/blocked + a reference)
// through the same result-in path an external orchestrator uses. It is visibly
// marked as a tenant-specific placeholder — a real tenant replaces this with
// its own intake under the contract.

/** GET /aisworg/seu/seus/:id/work-queue — the human-on-UI work queue for a SEU. */
router.get("/seus/:id/work-queue", attachVM("seu/workqueue/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seuId = String(req.params.id);
    const { data: seu } = await seusDB.findById(seuId);
    const tenantId = seu?.tenant_id ?? null;
    const { data: outstanding } = await workItemsDB.findOutstandingBySeuDetailed(seuId);
    const workItems = [];
    for (const wi of outstanding ?? []) {
      const target = await resolveExecutionTarget(tenantId, wi.producing_capability_id);
      workItems.push({
        id: wi.id,
        deliverableName: wi.deliverable_name,
        fromState: wi.from_state,
        toState: wi.to_state,
        targetCompletionAt: wi.target_completion_at,
        mode: target.mode,
      });
    }
    req.vm.req.title = "Work Queue";
    req.vm.req.seuId = seuId;
    const params = parseListParams(req.query, { sortable: ["deliverable", "transition", "reachby", "mode"], defaultSort: "reachby", defaultDir: "asc" });
    req.vm.req.list = paginateList(workItems, params, {
      searchFields: [(w) => w.deliverableName, (w) => w.toState, (w) => w.mode],
      sortFields: { deliverable: (w) => w.deliverableName, transition: (w) => w.toState, reachby: (w) => w.targetCompletionAt, mode: (w) => w.mode },
    });
    req.vm.opt.listBasePath = `/aisworg/seu/seus/${seuId}/work-queue`;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/workqueue/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/workQueue] GET /seus/:id/work-queue error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus/:id/work-items/:workItemId/complete — human reports a result. */
router.post("/seus/:id/work-items/:workItemId/complete", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/work-queue`;
  const { outcome, reference } = req.body ?? {};

  if (typeof outcome !== "string" || !["done", "failed", "blocked"].includes(outcome)) {
    return flashError(req, res, backTo, "Outcome must be done, failed or blocked.");
  }
  try {
    const result = await completeWorkItem({
      workItemId: String(req.params.workItemId),
      outcome: outcome as WorkItemOutcome,
      reference: typeof reference === "string" && reference.trim() !== "" ? reference : null,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, `Could not record result: ${result.detail}`);
    }
    if (result.outcome === "done") {
      return flashSuccess(req, res, backTo, `Result recorded — Deliverable moved "${result.appliedTransition.fromState}" → "${result.appliedTransition.toState}".`);
    }
    return flashSuccess(req, res, backTo, `Reported "${result.outcome}" — the transition was not applied and an Attention Item was raised.`);
  } catch (err) {
    logger.error("[web/seu/workQueue] POST complete error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
