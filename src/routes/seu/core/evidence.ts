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
import type { EvidenceRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// related_object_type/id are polymorphic (Open Design Questions.md #3) — see
// core/obligations.ts's own doc comment for the same reasoning.
export async function createEvidence(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  title: string;
  description?: string | null;
  source?: string | null;
  confidenceLevel?: string;
}): Promise<EvidenceRow> {
  await assertCanonicalCategory("category:evidence", input.category);
  if (input.relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(input.relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.relatedObjectId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.relatedObjectId} does not belong to SEU ${input.seuId}`);
  }

  const { data: evidence, error } = await evidenceDB.create({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    title: input.title,
    description: input.description,
    source: input.source,
    confidenceLevel: input.confidenceLevel,
  });
  if (error || !evidence) throw error ?? new Error("failed to create evidence");

  await eventBus.publish({
    eventType: "EvidenceCollected",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category },
  });

  return evidence;
}

export async function listEvidenceBySeu(seuId: string): Promise<EvidenceRow[]> {
  const { data } = await evidenceDB.findBySeuId(seuId);
  return data ?? [];
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
    eventType: "EvidenceTransitioned",
    originatingObjectType: "Evidence",
    originatingObjectId: evidence.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  return { ok: true, evidence: updated, appliedTransition: { fromState, toState: input.targetState } };
}
