import { findingsDB } from "../../../dblayer/findingsDB.js";
import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEntity, publishTransition, nextActionsFor } from "../../../domain/engine/entityTransition.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { raiseAttentionItem } from "./attentionItems.js";
import { createObligation } from "./obligations.js";
import type { FindingRow } from "../../../dblayer/seuTypes.js";
import { getSystemActor, CONVERT_FINDING_ACTION_CODE } from "../../../dblayer/constants.js";

const BLOCKING_SEVERITIES = new Set(["High", "Critical"]);

async function resolveAuthorId(seuId: string, actorId: string): Promise<string> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (!participant) throw new Error(`actor ${actorId} has no participant engagement in SEU ${seuId}`);
  return participant.id;
}

export async function createFinding(input: {
  reviewId: string;
  severity: string;
  title: string;
  description?: string | null;
  actorId: string;
}): Promise<FindingRow> {
  const { data: review } = await reviewsDB.findById(input.reviewId);
  if (!review) throw new Error(`review not found: ${input.reviewId}`);

  const authorId = await resolveAuthorId(review.seu_id, input.actorId);
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, "finding_create");

  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Finding");
  if (birthError) throw birthError;
  if (!birth) throw new Error("no birth Transition Definition for Finding");
  if (!birth.event_type) throw new Error("the Finding birth Transition Definition names no event");

  const { data: finding, error } = await findingsDB.create({
    status: birth.to_state,
    reviewId: review.id,
    seuId: review.seu_id,
    relatedObjectType: review.related_object_type,
    relatedObjectId: review.related_object_id,
    severity: input.severity,
    title: input.title,
    description: input.description,
    authorId,
    authorBadge,
  });
  if (error || !finding) throw error ?? new Error("failed to create finding");

  await eventBus.publish({
    eventType: birth.event_type,
    originatingObjectType: "Finding",
    originatingObjectId: finding.id,
    seuId: review.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: authorBadge,
    payload: { reviewId: review.id, severity: input.severity, relatedObjectType: review.related_object_type, relatedObjectId: review.related_object_id },
  });

  if (BLOCKING_SEVERITIES.has(input.severity)) {
    await raiseAttentionItem({
      seuId: review.seu_id,
      category: "Action Required",
      priority: "High",
      title: `${input.severity} Review Finding: ${input.title}`,
      description: input.description ?? `A ${input.severity} finding was raised by review "${review.name}".`,
      relatedObjectType: review.related_object_type,
      relatedObjectId: review.related_object_id,
      ...(await getSystemActor(review.seu_id)),
    });
  }

  return finding;
}

export async function listFindingsByReview(reviewId: string): Promise<FindingRow[]> {
  const { data } = await findingsDB.findByReviewId(reviewId);
  return data ?? [];
}

export type TransitionFindingResult =
  | { ok: true; finding: FindingRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted" | "quality_gate_blocked"; detail: string };

// One governed Finding hop: the row's event, then FindingTransitioned as the last statement.
async function applyFindingHop(input: { findingId: string; targetState: string; actorId: string; context?: Record<string, unknown> }): Promise<TransitionFindingResult> {
  if (!input.actorId) throw new Error("actorId is required to transition a Finding");
  const result = await transitionEntity({ entityType: "Finding", entityId: input.findingId, targetState: input.targetState, actorId: input.actorId, context: input.context });
  if (!result.ok) return result;

  const published = await publishTransition(result);
  await eventBus.publish({
    eventType: "FindingTransitioned",
    originatingObjectType: "Finding",
    originatingObjectId: input.findingId,
    seuId: result.event.seuId,
    correlationId: published.correlation_id,
    payload: result.event.payload,
    actorId: input.actorId,
    authorityBadge: result.event.authorityBadge,
  });

  return { ok: true, finding: result.row as FindingRow, appliedTransition: result.appliedTransition };
}

export async function transitionFinding(input: { findingId: string; targetState: string; actorId: string }): Promise<TransitionFindingResult> {
  return applyFindingHop(input);
}

export type ConvertFindingResult =
  | { ok: true; finding: FindingRow; obligationId: string }
  | { ok: false; reason: "not_found" | "already_converted" | "not_convertible"; detail: string };

export async function convertFindingToObligation(input: { findingId: string; category?: string; severity?: string; actorId: string }): Promise<ConvertFindingResult> {
  const { data: finding } = await findingsDB.findById(input.findingId);
  if (!finding) return { ok: false, reason: "not_found", detail: `finding not found: ${input.findingId}` };
  if (finding.obligation_id) return { ok: false, reason: "already_converted", detail: `finding ${finding.id} is already linked to Obligation ${finding.obligation_id}` };

  // The convert row names the target state; a Finding with no convert action from its state is refused before an Obligation exists.
  const convert = (await nextActionsFor("Finding", finding.status, input.actorId)).find((a) => a.actionCode === CONVERT_FINDING_ACTION_CODE);
  if (!convert) return { ok: false, reason: "not_convertible", detail: `finding ${finding.id} cannot be converted from ${finding.status}` };

  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, "finding_convert");
  const obligation = await createObligation({
    relatedObjectType: finding.related_object_type,
    relatedObjectId: finding.related_object_id,
    category: input.category ?? "Review Finding",
    title: finding.title,
    description: finding.description,
    severity: input.severity ?? finding.severity,
    actorId: input.actorId,
    authorBadge,
  });

  const hop = await applyFindingHop({ findingId: finding.id, targetState: convert.toState, actorId: input.actorId, context: { obligationId: obligation.id } });
  if (!hop.ok) return { ok: false, reason: "not_convertible", detail: "detail" in hop ? hop.detail : hop.reason };
  return { ok: true, finding: hop.finding, obligationId: obligation.id };
}
