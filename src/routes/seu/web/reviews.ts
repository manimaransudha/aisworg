import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";
import { listReviewsBySeu, createReview, transitionReview } from "../core/reviews.js";
import { nextActionsFor } from "../../../domain/engine/entityTransition.js";
import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { findingsDB } from "../../../dblayer/findingsDB.js";
import { COMPLETE_REVIEW_ACTION_CODE } from "../../../dblayer/constants.js";
import { listFindingsByReview, createFinding, transitionFinding, convertFindingToObligation } from "../core/findings.js";
import type { ReviewOutcome } from "../../../dblayer/seuTypes.js";

router.get("/seus/:id/reviews", attachVM("seu/reviews/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seuId = String(req.params.id);
    const [reviewRows, { data: deliverables }] = await Promise.all([
      listReviewsBySeu(seuId),
      deliverablesDB.findBySeuId(seuId),
    ]);
    const reviews = await Promise.all(
      reviewRows.map(async (review) => ({ review, findings: await listFindingsByReview(review.id) }))
    );
    const actorId = requireActorId(req);
    const reviewActions: Record<string, Array<Awaited<ReturnType<typeof nextActionsFor>>[number] & { kind: "outcome" | "plain" }>> = {};
    const findingActions: Record<string, Awaited<ReturnType<typeof nextActionsFor>>> = {};
    for (const item of reviews) {
      const actions = await nextActionsFor("Review", item.review.status, actorId);
      reviewActions[item.review.id] = actions.map((a) => ({ ...a, kind: a.actionCode === COMPLETE_REVIEW_ACTION_CODE ? "outcome" : "plain" }));
      for (const f of item.findings) findingActions[f.id] = await nextActionsFor("Finding", f.status, actorId);
    }
    req.vm.req.reviewActions = reviewActions;
    req.vm.req.findingActions = findingActions;
    req.vm.req.title = "Reviews";
    req.vm.req.seuId = seuId;
    const params = parseListParams(req.query, { sortable: ["name", "category", "status"], defaultSort: "name", defaultDir: "asc" });
    req.vm.req.list = paginateList(reviews, params, {
      searchFields: [(x) => x.review.name, (x) => x.review.category, (x) => x.review.status],
      sortFields: { name: (x) => x.review.name, category: (x) => x.review.category, status: (x) => x.review.status },
    });
    req.vm.opt.listBasePath = `/aisworg/seu/seus/${seuId}/reviews`;
    req.vm.req.deliverables = (deliverables ?? []).map((d) => ({ id: d.id, name: d.name }));
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/reviews/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/reviews] GET /seus/:id/reviews error", err as Error);
    next(err);
  }
});

router.post("/seus/:id/reviews", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { deliverableId, category, name } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof name !== "string" || !name.trim()) {
    return redirects.seu.seusReviews.error(req, res, "Deliverable, category and name are required.");
  }
  try {
    const actorId = requireActorId(req);

    await createReview({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category, name, actorId });
    return redirects.seu.seusReviews.success(req, res, `Review "${name}" planned (${category}).`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST /seus/:id/reviews error", err as Error);
    return redirects.seu.seusReviews.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/reviews/:reviewId/transition/:verb", async (req: Request, res: Response) => {
  const { outcome } = req.body ?? {};
  try {
    const actorId = requireActorId(req);
    const reviewId = String(req.params.reviewId);
    const { data: review } = await reviewsDB.findById(reviewId);
    if (!review) return redirects.seu.seusReviewsTransition.error(req, res, "Review not found.");
    const action = (await nextActionsFor("Review", review.status, actorId)).find((a) => a.verb === String(req.params.verb));
    if (!action) return redirects.seu.seusReviewsTransition.error(req, res, `Review transition blocked: "${String(req.params.verb)}" is not available from ${review.status}.`);
    const result = await transitionReview({
      reviewId,
      targetState: action.toState,
      actorId,
      outcome: typeof outcome === "string" && outcome.trim() ? (outcome as ReviewOutcome) : undefined,
    });
    if (!result.ok) {
      const detail = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusReviewsTransition.error(req, res, `Review transition blocked: ${detail}`);
    }
    const suffix = result.review.outcome ? ` (outcome: ${result.review.outcome})` : "";
    return redirects.seu.seusReviewsTransition.success(req, res, `Review moved to "${result.appliedTransition.toState}"${suffix}.`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST review transition error", err as Error);
    return redirects.seu.seusReviewsTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/reviews/:reviewId/findings", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { severity, title, description } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) return redirects.seu.seusReviewsFindings.error(req, res, "Finding title is required.");
  try {
    const actorId = requireActorId(req);

    await createFinding({
      reviewId: String(req.params.reviewId),
      severity: typeof severity === "string" && severity.trim() ? severity : "Medium",
      title,
      description: typeof description === "string" ? description : null,
      actorId,
    });
    return redirects.seu.seusReviewsFindings.success(req, res, `Finding "${title}" raised.`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST finding error", err as Error);
    return redirects.seu.seusReviewsFindings.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/findings/:findingId/transition/:verb", async (req: Request, res: Response) => {
  try {
    const actorId = requireActorId(req);
    const findingId = String(req.params.findingId);
    const { data: finding } = await findingsDB.findById(findingId);
    if (!finding) return redirects.seu.seusFindingsTransition.error(req, res, "Finding not found.");
    const action = (await nextActionsFor("Finding", finding.status, actorId)).find((a) => a.verb === String(req.params.verb));
    if (!action) return redirects.seu.seusFindingsTransition.error(req, res, `Finding transition blocked: "${String(req.params.verb)}" is not available from ${finding.status}.`);
    const result = await transitionFinding({ findingId, targetState: action.toState, actorId });
    if (!result.ok) {
      const detail = "detail" in result ? result.detail : result.reason;
      return redirects.seu.seusFindingsTransition.error(req, res, `Finding transition blocked: ${detail}`);
    }
    return redirects.seu.seusFindingsTransition.success(req, res, `Finding moved to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST finding transition error", err as Error);
    return redirects.seu.seusFindingsTransition.error(req, res, (err as Error).message);
  }
});

router.post("/seus/:id/findings/:findingId/convert", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  try {
    const actorId = requireActorId(req);
    const result = await convertFindingToObligation({ findingId: String(req.params.findingId), category: typeof req.body?.category === "string" ? req.body.category : undefined, actorId });
    if (!result.ok) return redirects.seu.seusFindingsConvert.error(req, res, `Could not convert Finding: ${result.detail}`);
    return redirects.seu.seusFindingsConvert.success(req, res, `Finding converted to an Obligation.`);
  } catch (err) {
    logger.error("[web/seu/reviews] POST finding convert error", err as Error);
    return redirects.seu.seusFindingsConvert.error(req, res, (err as Error).message);
  }
});

export { router };
