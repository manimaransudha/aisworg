import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { listReviewsWithNextStates, createReview, transitionReview } from "../core/reviews.js";
import { listFindingsByReview, createFinding, transitionFinding, convertFindingToObligation } from "../core/findings.js";
import type { ReviewOutcome } from "../../../dblayer/seuTypes.js";

// Review Model — Plan (Phase 14, Ch.25). The web surface: plan a Review against a
// Deliverable, walk its lifecycle (Completed requires an outcome), raise Findings,
// and resolve/waive/convert them — the same governed flow the API exposes.

/** GET /aisworg/seu/seus/:id/reviews — the Reviews + Findings for a SEU. */
router.get("/seus/:id/reviews", attachVM("seu/reviews/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seuId = String(req.params.id);
    const [reviewsWithStates, { data: deliverables }] = await Promise.all([
      listReviewsWithNextStates(seuId),
      deliverablesDB.findBySeuId(seuId),
    ]);
    const reviews = await Promise.all(
      reviewsWithStates.map(async (r) => ({ ...r, findings: await listFindingsByReview(r.review.id) }))
    );
    req.vm.req.title = "Reviews";
    req.vm.req.seuId = seuId;
    req.vm.req.reviews = reviews;
    req.vm.req.deliverables = (deliverables ?? []).map((d) => ({ id: d.id, name: d.name }));
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/reviews/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/reviews] GET /seus/:id/reviews error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus/:id/reviews — plan a Review against a Deliverable. */
router.post("/seus/:id/reviews", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/reviews`;
  const { deliverableId, category, name } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof name !== "string" || !name.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and name are required.");
  }
  try {
    await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, name });
    return flashSuccess(req, res, backTo, `Review "${name}" planned (${category}).`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST /seus/:id/reviews error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/reviews/:reviewId/transition — walk the lifecycle. */
router.post("/seus/:id/reviews/:reviewId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/reviews`;
  const { targetState, outcome } = req.body ?? {};
  if (typeof targetState !== "string" || !targetState.trim()) return flashError(req, res, backTo, "Target state is required.");
  try {
    const result = await transitionReview({
      reviewId: String(req.params.reviewId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      outcome: typeof outcome === "string" && outcome.trim() ? (outcome as ReviewOutcome) : undefined,
    });
    if (!result.ok) {
      const detail = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Review transition blocked: ${detail}`);
    }
    const suffix = result.review.outcome ? ` (outcome: ${result.review.outcome})` : "";
    return flashSuccess(req, res, backTo, `Review moved to "${result.appliedTransition.toState}"${suffix}.`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST review transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/reviews/:reviewId/findings — raise a Finding. */
router.post("/seus/:id/reviews/:reviewId/findings", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/reviews`;
  const { severity, title, description } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) return flashError(req, res, backTo, "Finding title is required.");
  try {
    await createFinding({
      reviewId: String(req.params.reviewId),
      severity: typeof severity === "string" && severity.trim() ? severity : "Medium",
      title,
      description: typeof description === "string" ? description : null,
    });
    return flashSuccess(req, res, backTo, `Finding "${title}" raised.`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST finding error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/findings/:findingId/transition — Open -> Resolved/Waived. */
router.post("/seus/:id/findings/:findingId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/reviews`;
  const { targetState } = req.body ?? {};
  if (typeof targetState !== "string" || !targetState.trim()) return flashError(req, res, backTo, "Target state is required.");
  try {
    const result = await transitionFinding({ findingId: String(req.params.findingId), targetState, actorRole: req.session?.user?.role ?? "general" });
    if (!result.ok) {
      const detail = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Finding transition blocked: ${detail}`);
    }
    return flashSuccess(req, res, backTo, `Finding moved to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST finding transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/findings/:findingId/convert — Finding -> Obligation. */
router.post("/seus/:id/findings/:findingId/convert", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/reviews`;
  try {
    const result = await convertFindingToObligation({ findingId: String(req.params.findingId), category: typeof req.body?.category === "string" ? req.body.category : undefined });
    if (!result.ok) return flashError(req, res, backTo, `Could not convert Finding: ${result.detail}`);
    return flashSuccess(req, res, backTo, `Finding converted to an Obligation.`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST finding convert error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
