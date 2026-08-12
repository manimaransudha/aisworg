// Review Model — Plan (Phase 14, Ch.25 §12), Decision C. A Finding is an
// observation from a Review — its own governed object (Open -> Resolved/Waived).
// A High/Critical Finding auto-surfaces a deduped Attention Item; a Finding can
// be manually converted to an Obligation. Findings are NOT auto-converted to
// Obligations (that would implicitly couple two governed lifecycles) — the human
// decides what a Finding becomes.
import { findingsDB } from "../../../dblayer/findingsDB.js";
import { reviewsDB } from "../../../dblayer/reviewsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem } from "./attentionItems.js";
import { createObligation } from "./obligations.js";
import type { FindingRow } from "../../../dblayer/seuTypes.js";

const BLOCKING_SEVERITIES = new Set(["High", "Critical"]);

export async function createFinding(input: {
  reviewId: string;
  severity: string;
  title: string;
  description?: string | null;
}): Promise<FindingRow> {
  const { data: review } = await reviewsDB.findById(input.reviewId);
  if (!review) throw new Error(`review not found: ${input.reviewId}`);

  const { data: finding, error } = await findingsDB.create({
    reviewId: review.id,
    seuId: review.seu_id,
    relatedObjectType: review.related_object_type,
    relatedObjectId: review.related_object_id,
    severity: input.severity,
    title: input.title,
    description: input.description,
  });
  if (error || !finding) throw error ?? new Error("failed to create finding");

  await eventBus.publish({
    eventType: "FindingCreated",
    originatingObjectType: "Finding",
    originatingObjectId: finding.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { reviewId: review.id, severity: input.severity, relatedObjectType: review.related_object_type, relatedObjectId: review.related_object_id },
  });

  // Decision C: a blocking-severity Finding auto-surfaces an Attention Item
  // (deduped per (SEU, category, object) like every other Attention path). It
  // does NOT auto-create an Obligation.
  if (BLOCKING_SEVERITIES.has(input.severity)) {
    await raiseAttentionItem({
      seuId: review.seu_id,
      category: "Action Required",
      priority: "High",
      title: `${input.severity} Review Finding: ${input.title}`,
      description: input.description ?? `A ${input.severity} finding was raised by review "${review.name}".`,
      relatedObjectType: review.related_object_type,
      relatedObjectId: review.related_object_id,
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
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "quality_gate_blocked"; detail: string };

// Open -> Resolved / Waived, via the same generic transitionEngine.
export async function transitionFinding(input: { findingId: string; targetState: string; actorRole: string }): Promise<TransitionFindingResult> {
  const { data: finding } = await findingsDB.findById(input.findingId);
  if (!finding) return { ok: false, reason: "not_found" };

  const fromState = finding.status;
  const gate = await transitionEngine.evaluate({ entityType: "Finding", fromState, toState: input.targetState, actorRole: input.actorRole, context: { finding } });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Finding ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires role ${gate.requiredRole}, actor has ${gate.actorRole}` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await findingsDB.updateStatus(finding.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update finding status");

  await eventBus.publish({
    eventType: input.targetState === "Resolved" ? "FindingResolved" : "FindingTransitioned",
    originatingObjectType: "Finding",
    originatingObjectId: finding.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  return { ok: true, finding: updated, appliedTransition: { fromState, toState: input.targetState } };
}

export type ConvertFindingResult =
  | { ok: true; finding: FindingRow; obligationId: string }
  | { ok: false; reason: "not_found" | "already_converted"; detail: string };

// Manual conversion of a Finding to an Obligation (Ch.25 §12). Idempotent-safe:
// a Finding already linked to an Obligation is not converted twice.
export async function convertFindingToObligation(input: { findingId: string; category?: string; severity?: string }): Promise<ConvertFindingResult> {
  const { data: finding } = await findingsDB.findById(input.findingId);
  if (!finding) return { ok: false, reason: "not_found", detail: `finding not found: ${input.findingId}` };
  if (finding.obligation_id) return { ok: false, reason: "already_converted", detail: `finding ${finding.id} is already linked to Obligation ${finding.obligation_id}` };

  const obligation = await createObligation({
    seuId: finding.seu_id,
    relatedObjectType: finding.related_object_type,
    relatedObjectId: finding.related_object_id,
    category: input.category ?? "Review Finding",
    title: finding.title,
    description: finding.description,
    severity: input.severity ?? finding.severity,
  });

  const { data: linked } = await findingsDB.setObligationId(finding.id, obligation.id);
  return { ok: true, finding: linked ?? finding, obligationId: obligation.id };
}
