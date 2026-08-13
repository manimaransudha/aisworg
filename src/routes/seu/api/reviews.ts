import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createReview, listReviewsWithNextStates, transitionReview } from "../core/reviews.js";
import { createFinding, listFindingsByReview, transitionFinding, convertFindingToObligation } from "../core/findings.js";
import type { ReviewOutcome, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// Review Model — Plan (Phase 14, Ch.25 §18: Review APIs). A Review is a governed
// evaluation whose outcome Governance consumes; Findings are its traceable
// observations.

/** POST /reviews — plan a Review against a governed object (Ch.25 §8). */
router.post("/reviews", async (req: Request, res: Response) => {
  try {
    const { seuId, relatedObjectType, relatedObjectId, category, name, criteria, reviewer } = req.body ?? {};
    if (typeof seuId !== "string" || typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "seuId, relatedObjectType, relatedObjectId, category and name are required" });
    }
    const review = await createReview({
      seuId,
      relatedObjectType: relatedObjectType as TransitionEntityType,
      relatedObjectId,
      category,
      name,
      criteria: typeof criteria === "object" && criteria ? criteria : undefined,
      reviewer: typeof reviewer === "string" ? reviewer : null,
    });
    res.status(201).json({ review });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /reviews error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /reviews?seuId=... — every Review for a SEU, with possible next states. */
router.get("/reviews", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : "";
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ reviews: await listReviewsWithNextStates(seuId) });
  } catch (err) {
    logger.error("[api/seu/reviews] GET /reviews error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /reviews/:id/transition — walk the lifecycle; Completed requires an outcome (Ch.25 §9/§11). */
router.post("/reviews/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState, outcome } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) return res.status(400).json({ error: "targetState is required" });
    const result = await transitionReview({
      reviewId: String(req.params.id),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
      outcome: typeof outcome === "string" ? (outcome as ReviewOutcome) : undefined,
    });
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      return res.status(status).json({ reason: result.reason, ...("detail" in result ? { detail: result.detail } : {}) });
    }
    res.status(200).json({ review: result.review, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /reviews/:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /reviews/:id/findings — raise a Finding from a Review (Ch.25 §12). */
router.post("/reviews/:id/findings", async (req: Request, res: Response) => {
  try {
    const { severity, title, description } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    const finding = await createFinding({
      reviewId: String(req.params.id),
      severity: typeof severity === "string" && severity.trim() ? severity : "Medium",
      title,
      description: typeof description === "string" ? description : null,
    });
    res.status(201).json({ finding });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /reviews/:id/findings error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /reviews/:id/findings — the Findings a Review produced. */
router.get("/reviews/:id/findings", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ findings: await listFindingsByReview(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/reviews] GET /reviews/:id/findings error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /findings/:id/transition — Open -> Resolved / Waived. */
router.post("/findings/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) return res.status(400).json({ error: "targetState is required" });
    const result = await transitionFinding({ findingId: String(req.params.id), targetState, actorRole: req.session?.user?.role ?? "general", actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined });
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      return res.status(status).json({ reason: result.reason, ...("detail" in result ? { detail: result.detail } : {}) });
    }
    res.status(200).json({ finding: result.finding, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /findings/:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /findings/:id/convert-to-obligation — Ch.25 §12: a Finding may lead to an Obligation. */
router.post("/findings/:id/convert-to-obligation", async (req: Request, res: Response) => {
  try {
    const { category, severity } = req.body ?? {};
    const result = await convertFindingToObligation({
      findingId: String(req.params.id),
      category: typeof category === "string" ? category : undefined,
      severity: typeof severity === "string" ? severity : undefined,
    });
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      return res.status(status).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ finding: result.finding, obligationId: result.obligationId });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /findings/:id/convert-to-obligation error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
