import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { COMPLETE_REVIEW_ACTION_CODE } from "../../../dblayer/constants.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import type { ReviewOutcome, ReviewRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

const PASSING_OUTCOMES = new Set<ReviewOutcome>(["Passed", "Passed with Recommendations"]);

async function resolveAuthorId(seuId: string, actorId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (!participant) throw new Error(`actor ${actorId} has no participant engagement in SEU ${seuId}`);
  return participant.id;
}

export async function createReview(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  name: string;
  criteria?: Record<string, unknown>;
  reviewer?: string | null;
  reviewGateId?: string | null;
  actorId: string;
}): Promise<ReviewRow> {
  if (input.relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(input.relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.relatedObjectId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.relatedObjectId} does not belong to SEU ${input.seuId}`);
  }

  const authorId = await resolveAuthorId(input.seuId, input.actorId);
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, "review_create");

  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Review");
  if (birthError) throw birthError;
  if (!birth) throw new Error("no birth Transition Definition for Review");
  if (!birth.event_type) throw new Error("the Review birth Transition Definition names no event");

  const { data: review, error } = await reviewsDB.create({
    status: birth.to_state,
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    name: input.name,
    criteria: input.criteria,
    reviewer: input.reviewer,
    reviewGateId: input.reviewGateId,
    authorId,
    authorBadge,
  });
  if (error || !review) throw error ?? new Error("failed to create review");

  await eventBus.publish({
    eventType: birth.event_type,
    originatingObjectType: "Review",
    originatingObjectId: review.id,
    seuId: review.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: authorBadge,
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category },
  });

  return review;
}

export async function listReviewsBySeu(seuId: string): Promise<ReviewRow[]> {
  const { data } = await reviewsDB.findBySeuId(seuId);
  return data ?? [];
}

export type TransitionReviewResult =
  | { ok: true; review: ReviewRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "outcome_required"; detail: string }
  | { ok: false; reason: "outcome_immutable"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionReview(input: {
  reviewId: string;
  targetState: string;
  actorId: string;
  outcome?: ReviewOutcome;
}): Promise<TransitionReviewResult> {
  const { data: review } = await reviewsDB.findById(input.reviewId);
  if (!review) return { ok: false, reason: "not_found" };
  if (!input.actorId) throw new Error("actorId is required to transition a Review");

  // The row that completes a Review names the complete-review action. Its outcome rules are checked here so the caller
  // gets the specific result; the action enforces them again inside the transaction.
  const { data: definition } = await transitionDefinitionsDB.find("Review", review.status, input.targetState);
  const completes = definition?.action_code === COMPLETE_REVIEW_ACTION_CODE;
  if (completes) {
    if (!input.outcome) return { ok: false, reason: "outcome_required", detail: "completing a Review requires an outcome (Passed / Passed with Recommendations / Rework Required / Failed / Not Applicable / Deferred)" };
    if (review.outcome != null) return { ok: false, reason: "outcome_immutable", detail: `this Review already has outcome "${review.outcome}" — a Review outcome is immutable` };
  }

  const result = await transitionEntity({ entityType: "Review", entityId: review.id, targetState: input.targetState, actorId: input.actorId, context: completes ? { outcome: input.outcome } : undefined });
  if (!result.ok) return result;

  const published = await publishTransition(result);
  if (completes && input.outcome) {
    const outcomeEvent = PASSING_OUTCOMES.has(input.outcome) ? "ReviewPassed" : input.outcome === "Deferred" ? "ReviewDeferred" : "ReviewFailed";
    await eventBus.publish({ eventType: outcomeEvent, originatingObjectType: "Review", originatingObjectId: review.id, seuId: review.seu_id, correlationId: published.correlation_id, payload: { outcome: input.outcome }, actorId: input.actorId, authorityBadge: result.event.authorityBadge });
  }
  await eventBus.publish({
    eventType: "ReviewTransitioned",
    originatingObjectType: "Review",
    originatingObjectId: review.id,
    seuId: review.seu_id,
    correlationId: published.correlation_id,
    payload: result.event.payload,
    actorId: input.actorId,
    authorityBadge: result.event.authorityBadge,
  });

  return { ok: true, review: result.row as ReviewRow, appliedTransition: result.appliedTransition };
}
