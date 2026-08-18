// Review Model — Plan (Phase 14, Ch.25). A Review is a governed evaluation of an
// engineering object. It reuses the same generic transitionEngine every other
// entity type uses (Ch.29 §10), as the 13th entity type. A Review NEVER modifies
// the reviewed object (RM-001); it produces an outcome at Completion that is
// immutable (FR-25.5) and that Governance consumes via the Quality Gate (step 2).
import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { ReviewOutcome, ReviewRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

const PASSING_OUTCOMES = new Set<ReviewOutcome>(["Passed", "Passed with Recommendations"]);

export async function createReview(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  name: string;
  criteria?: Record<string, unknown>;
  reviewer?: string | null;
}): Promise<ReviewRow> {
  if (input.relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(input.relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.relatedObjectId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.relatedObjectId} does not belong to SEU ${input.seuId}`);
  }

  const { data: review, error } = await reviewsDB.create({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    name: input.name,
    criteria: input.criteria,
    reviewer: input.reviewer,
  });
  if (error || !review) throw error ?? new Error("failed to create review");

  await eventBus.publish({
    eventType: "ReviewPlanned",
    originatingObjectType: "Review",
    originatingObjectId: review.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category },
  });

  return review;
}

export async function listReviewsBySeu(seuId: string): Promise<ReviewRow[]> {
  const { data } = await reviewsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface ReviewWithNextStates {
  review: ReviewRow;
  possibleNextStates: string[];
}

export async function listReviewsWithNextStates(seuId: string): Promise<ReviewWithNextStates[]> {
  const items = await listReviewsBySeu(seuId);
  return Promise.all(
    items.map(async (review) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Review", review.status);
      return { review, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionReviewResult =
  | { ok: true; review: ReviewRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "outcome_required"; detail: string }
  | { ok: false; reason: "outcome_immutable"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

// The lifecycle walk. The outcome is produced at the In Progress -> Completed
// transition (Ch.25 §9/§11) and frozen there — no later transition changes it.
export async function transitionReview(input: {
  reviewId: string;
  targetState: string;
  actorRole: string;
  actorId?: string;
  outcome?: ReviewOutcome;
}): Promise<TransitionReviewResult> {
  const { data: review } = await reviewsDB.findById(input.reviewId);
  if (!review) return { ok: false, reason: "not_found" };

  const fromState = review.status;

  // Governance still evaluates a gate on the Review's own lifecycle for
  // uniformity (there are none seeded on Review today, so this passes).
  const qualityGateResult = await qualityGateEngine.evaluate({ entityType: "Review", entityId: review.id, seuId: review.seu_id, fromState, toState: input.targetState });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const gate = await transitionEngine.evaluate({ entityType: "Review", fromState, toState: input.targetState, actorRole: input.actorRole,
    actorId: input.actorId, context: { review } });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Review ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  let updated: ReviewRow;
  if (input.targetState === "Completed") {
    if (!input.outcome) return { ok: false, reason: "outcome_required", detail: "completing a Review requires an outcome (Passed / Passed with Recommendations / Rework Required / Failed / Not Applicable / Deferred)" };
    // Immutability guard (FR-25.5): an outcome, once produced, is never changed.
    if (review.outcome != null) return { ok: false, reason: "outcome_immutable", detail: `this Review already has outcome "${review.outcome}" — a Review outcome is immutable` };
    const { data, error } = await reviewsDB.completeWithOutcome(review.id, input.outcome);
    if (error || !data) throw error ?? new Error("failed to complete review");
    updated = data;

    await eventBus.publish({ eventType: "ReviewCompleted", originatingObjectType: "Review", originatingObjectId: review.id, correlationId: eventBus.newCorrelationId(), payload: { outcome: input.outcome }, actorId: input.actorId ?? null, authorityBadge: gate.authorityBadge });
    const outcomeEvent = PASSING_OUTCOMES.has(input.outcome) ? "ReviewPassed" : input.outcome === "Deferred" ? "ReviewDeferred" : "ReviewFailed";
    await eventBus.publish({ eventType: outcomeEvent, originatingObjectType: "Review", originatingObjectId: review.id, correlationId: eventBus.newCorrelationId(), payload: { outcome: input.outcome }, actorId: input.actorId ?? null, authorityBadge: gate.authorityBadge });
  } else {
    const { data, error } = await reviewsDB.updateStatus(review.id, input.targetState);
    if (error || !data) throw error ?? new Error("failed to update review status");
    updated = data;

    const eventType = input.targetState === "In Progress" ? "ReviewStarted" : "ReviewTransitioned";
    await eventBus.publish({ eventType, originatingObjectType: "Review", originatingObjectId: review.id, correlationId: eventBus.newCorrelationId(), payload: { fromState, toState: input.targetState }, actorId: input.actorId ?? null, authorityBadge: gate.authorityBadge });
  }

  return { ok: true, review: updated, appliedTransition: { fromState, toState: input.targetState } };
}
