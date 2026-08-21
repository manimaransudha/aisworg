// Ch.17 Evidence Model — Post-MVP Phase 5. Lifecycle transitions reuse the
// same generic transitionEngine every other entity type already uses
// (Ch.29 §10), extended to a fifth entity type.
import { evidenceDB } from "../../../dblayer/evidenceDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { EvidenceRow, EvidenceRelationshipRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// CR-051 item 1 (Ch.17 §20.2/§20.8) — the one Deliverable-existence check
// both createEvidence and linkEvidenceToObject share. Owner: "an external
// evidence can be used across multiple SEUs" — so this checks the
// Deliverable is real, but no longer that it belongs to the SAME SEU as the
// Evidence's own origin; that ownership requirement was the one thing
// actively blocking the cross-SEU case.
async function assertRelatedObjectExists(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<void> {
  if (relatedObjectType !== "Deliverable") return;
  const { data: deliverable } = await deliverablesDB.findById(relatedObjectId);
  if (!deliverable) throw new Error(`deliverable not found: ${relatedObjectId}`);
}

// CR-051 item 5 (Ch.17 §16/§20.14) — the full named event set. Mirrors
// core/templates.ts's/core/packs.ts's/core/deliverableDefinitions.ts's own
// EVENT_BY_TARGET_STATE exactly: a lookup from target state to event type
// name, published instead of the generic EvidenceTransitioned. Every real
// Evidence target state (transitionDefinitions.json) is covered; the
// fallback below is defensive, matching the other three implementations.
const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "EvidenceValidated",
  Accepted: "EvidenceAccepted",
  Rejected: "EvidenceRejected",
  Referenced: "EvidenceReferenced",
  Archived: "EvidenceArchived",
};

// related_object_type/id are polymorphic (Open Design Questions.md #3) — see
// core/obligations.ts's own doc comment for the same reasoning.
//
// CR-051 item 3 (Ch.17 §12/§20.10) — provenance. originatingDeliverableId
// defaults to relatedObjectId when the relationship being created is itself
// a Deliverable (the common case — Evidence collected against the
// Deliverable whose engineering activity produced it), unless the caller
// names a different originating Deliverable explicitly. The other four
// fields (Participant/Capability/Decision/activity) are never inferred —
// there's no reliable default for who/what actually produced a given piece
// of Evidence, so they're only ever set if the caller supplies them.
// CR-051 item 4 (Ch.17 §15/§20.13) — supersedesEvidenceId, if given, must
// name a real Evidence row (predecessor). Nothing else about the
// predecessor is touched — no status change, no relationship change. This
// is the invariant the owner's own worked example demanded: superseding is
// a fact recorded between two Evidence rows only, never a bulk operation
// over the predecessor's existing relationships (which may span SEUs the
// corrector never intended to affect).
export async function createEvidence(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  title: string;
  description?: string | null;
  source?: string | null;
  confidenceLevel?: string;
  originatingDeliverableId?: string | null;
  originatingParticipantId?: string | null;
  originatingCapabilityId?: string | null;
  originatingDecisionId?: string | null;
  originatingActivity?: string | null;
  supersedesEvidenceId?: string | null;
}): Promise<EvidenceRow> {
  await assertCanonicalCategory("category:evidence", input.category);
  await assertRelatedObjectExists(input.relatedObjectType, input.relatedObjectId);
  if (input.supersedesEvidenceId) {
    const { data: predecessor } = await evidenceDB.findById(input.supersedesEvidenceId);
    if (!predecessor) throw new Error(`evidence not found: ${input.supersedesEvidenceId}`);
  }

  const originatingDeliverableId =
    input.originatingDeliverableId ?? (input.relatedObjectType === "Deliverable" ? input.relatedObjectId : null);

  const { data: evidence, error } = await evidenceDB.create({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    title: input.title,
    description: input.description,
    source: input.source,
    confidenceLevel: input.confidenceLevel,
    originatingDeliverableId,
    originatingParticipantId: input.originatingParticipantId,
    originatingCapabilityId: input.originatingCapabilityId,
    originatingDecisionId: input.originatingDecisionId,
    originatingActivity: input.originatingActivity,
    supersedesEvidenceId: input.supersedesEvidenceId,
  });
  if (error || !evidence) throw error ?? new Error("failed to create evidence");

  await eventBus.publish({
    eventType: "EvidenceCollected",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category },
  });

  if (input.supersedesEvidenceId) {
    await eventBus.publish({
      eventType: "EvidenceSuperseded",
      originatingObjectType: "Evidence",
      originatingObjectId: evidence.id,
      correlationId: eventBus.newCorrelationId(),
      payload: { supersedesEvidenceId: input.supersedesEvidenceId },
    });
  }

  return evidence;
}

export async function listEvidenceBySeu(seuId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findBySeuId(seuId);
  return data ?? [];
}

// CR-051 item 1 — what one Evidence row currently supports, for display.
export async function listEvidenceRelationships(evidenceId: string): Promise<EvidenceRelationshipRow[]> {
  const { data } = await evidenceDB.findRelationshipsByEvidenceId(evidenceId);
  return data ?? [];
}

// CR-051 item 4 — every Evidence Item linked to anything within this SEU,
// including cross-SEU-shared Evidence originating elsewhere. Powers the
// "Corrects" dropdown: a supersede-predecessor must be findable from
// whichever SEU the corrector is actually looking at, not just its origin.
export async function listEvidenceLinkedToSeu(seuId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findLinkedToSeu(seuId);
  return data ?? [];
}

// CR-051 item 4 — what corrects this Evidence row, if anything. Exposed for
// completeness; not required by the "no cross-SEU signal" display decision.
export async function findEvidenceSupersededBy(evidenceId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findSupersededBy(evidenceId);
  return data ?? [];
}

export type LinkEvidenceResult = { ok: true } | { ok: false; reason: "not_found" | "invalid"; detail?: string };

// CR-051 item 1 — every relationship after the first. Same
// assertRelatedObjectExists check createEvidence uses; publishes
// EvidenceLinked, mirroring EvidenceCollected's own shape (announcement
// only, per the Event Bus's settled "pure transport, never decides" role —
// Ch.17 §20.2).
export async function linkEvidenceToObject(evidenceId: string, relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<LinkEvidenceResult> {
  const { data: evidence } = await evidenceDB.findById(evidenceId);
  if (!evidence) return { ok: false, reason: "not_found" };

  try {
    await assertRelatedObjectExists(relatedObjectType, relatedObjectId);
  } catch (err) {
    return { ok: false, reason: "invalid", detail: (err as Error).message };
  }

  const { error } = await evidenceDB.addRelationship(evidenceId, relatedObjectType, relatedObjectId);
  if (error) return { ok: false, reason: "invalid", detail: error.message };

  await eventBus.publish({
    eventType: "EvidenceLinked",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType, relatedObjectId },
  });

  return { ok: true };
}

export interface EvidenceWithNextStates {
  evidence: EvidenceRow;
  possibleNextStates: string[];
}

export async function listEvidenceWithNextStates(seuId: string): Promise<EvidenceWithNextStates[]> {
  const items = await listEvidenceBySeu(seuId);
  return Promise.all(
    items.map(async (evidence) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Evidence", evidence.status);
      return { evidence, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionEvidenceResult =
  | { ok: true; evidence: EvidenceRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function transitionEvidence(input: { evidenceId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionEvidenceResult> {
  const { data: evidence } = await evidenceDB.findById(input.evidenceId);
  if (!evidence) return { ok: false, reason: "not_found" };

  const fromState = evidence.status;

  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Evidence",
    entityId: evidence.id,
    seuId: evidence.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const gate = await transitionEngine.evaluate({
    entityType: "Evidence",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { evidence },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Evidence ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await evidenceDB.updateStatus(evidence.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update evidence status");

  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "EvidenceTransitioned",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, evidence: updated, appliedTransition: { fromState, toState: input.targetState } };
}
