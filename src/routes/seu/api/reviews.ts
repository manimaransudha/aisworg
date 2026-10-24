import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createReview, listReviewsBySeu } from "../core/reviews.js";
import { createFinding, listFindingsByReview, convertFindingToObligation } from "../core/findings.js";
import type { TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";

router.post("/reviews", async (req: Request, res: Response) => {
  try {
    const { seuId, relatedObjectType, relatedObjectId, category, name, criteria, reviewer } = req.body ?? {};
    if (typeof seuId !== "string" || typeof relatedObjectType !== "string" || typeof relatedObjectId !== "string" || typeof category !== "string" || !category.trim() || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "seuId, relatedObjectType, relatedObjectId, category and name are required" });
    }
    const actorId = requireActorId(req);

    const review = await createReview({
      seuId,
      relatedObjectType: relatedObjectType as TransitionEntityType,
      relatedObjectId,
      category,
      name,
      criteria: typeof criteria === "object" && criteria ? criteria : undefined,
      reviewer: typeof reviewer === "string" ? reviewer : null,
      actorId,
    });
    res.status(201).json({ review });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /reviews error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/reviews", async (req: Request, res: Response) => {
  try {
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId : "";
    if (!seuId) return res.status(400).json({ error: "seuId query parameter is required" });
    res.status(200).json({ reviews: await listReviewsBySeu(seuId) });
  } catch (err) {
    logger.error("[api/seu/reviews] GET /reviews error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// CR-133: no caller; the web route .../reviews/:reviewId/transition/:verb performs the hop.
// router.post("/reviews/:id/transition", async (req: Request, res: Response) => {
//   try {
//     const targetState = readTargetState(req, res);
//     if (targetState === null) return;
//     const { outcome } = req.body ?? {};
//     const result = await transitionReview({
//       reviewId: String(req.params.id),
//       targetState,
//       actorId: requireActorId(req),
//       outcome: typeof outcome === "string" ? (outcome as ReviewOutcome) : undefined,
//     });
//     if (!result.ok) {
//       const status = result.reason === "not_found" ? 404 : 409;
//       return res.status(status).json({ reason: result.reason, ...("detail" in result ? { detail: result.detail } : {}) });
//     }
//     res.status(200).json({ review: result.review, appliedTransition: result.appliedTransition });
//   } catch (err) {
//     logger.error("[api/seu/reviews] POST /reviews/:id/transition error", err as Error);
//     res.status(400).json({ error: (err as Error).message });
//   }
// });

router.post("/reviews/:id/findings", async (req: Request, res: Response) => {
  try {
    const { severity, title, description } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    const actorId = requireActorId(req);

    const finding = await createFinding({
      reviewId: String(req.params.id),
      severity: typeof severity === "string" && severity.trim() ? severity : "Medium",
      title,
      description: typeof description === "string" ? description : null,
      actorId,
    });
    res.status(201).json({ finding });
  } catch (err) {
    logger.error("[api/seu/reviews] POST /reviews/:id/findings error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/reviews/:id/findings", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ findings: await listFindingsByReview(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/reviews] GET /reviews/:id/findings error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// CR-133: no caller; the web route .../findings/:findingId/transition/:verb performs the hop.
// router.post("/findings/:id/transition", async (req: Request, res: Response) => {
//   try {
//     const targetState = readTargetState(req, res);
//     if (targetState === null) return;
//     const result = await transitionFinding({ findingId: String(req.params.id), targetState, actorId: requireActorId(req) });
//     if (!result.ok) {
//       const status = result.reason === "not_found" ? 404 : 409;
//       return res.status(status).json({ reason: result.reason, ...("detail" in result ? { detail: result.detail } : {}) });
//     }
//     res.status(200).json({ finding: result.finding, appliedTransition: result.appliedTransition });
//   } catch (err) {
//     logger.error("[api/seu/reviews] POST /findings/:id/transition error", err as Error);
//     res.status(400).json({ error: (err as Error).message });
//   }
// });

router.post("/findings/:id/convert-to-obligation", async (req: Request, res: Response) => {
  try {
    const { category, severity } = req.body ?? {};
    const actorId = requireActorId(req);
    const result = await convertFindingToObligation({
      findingId: String(req.params.id),
      category: typeof category === "string" ? category : undefined,
      severity: typeof severity === "string" ? severity : undefined,
      actorId,
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
