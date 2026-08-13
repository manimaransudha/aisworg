// Ch.23 Obligation Model — Post-MVP Phase 4. Lifecycle transitions reuse the
// same generic transitionEngine SEU/Deliverable/Objective already use
// (Ch.29 §10), extended to a fourth entity type — Build Plan §2.2's "small
// core" split holds again: nothing here duplicates governance logic.
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { ObligationRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// related_object_type/id are polymorphic (Open Design Questions.md #3) — an
// Obligation can now attach to any governed entity, not just a Deliverable.
// Ownership validation against the given SEU only runs for the one entity
// type this codebase actually has a lookup for today (Deliverable); other
// entity types are trusted as given, same explicit scope cut
// createExternalInteraction already made for its own optional deliverableId.
export async function createObligation(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  title: string;
  description?: string | null;
  severity?: string;
}): Promise<ObligationRow> {
  await assertCanonicalCategory("category:obligation", input.category);
  if (input.relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(input.relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.relatedObjectId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.relatedObjectId} does not belong to SEU ${input.seuId}`);
  }

  const { data: obligation, error } = await obligationsDB.create({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    title: input.title,
    description: input.description,
    severity: input.severity,
  });
  if (error || !obligation) throw error ?? new Error("failed to create obligation");

  await eventBus.publish({
    eventType: "ObligationCreated",
    originatingObjectType: "Obligation",
    originatingObjectId: obligation.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category, severity: obligation.severity },
  });

  return obligation;
}

export async function listObligationsBySeu(seuId: string): Promise<ObligationRow[]> {
  const { data } = await obligationsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface ObligationWithNextStates {
  obligation: ObligationRow;
  possibleNextStates: string[];
}

export async function listObligationsWithNextStates(seuId: string): Promise<ObligationWithNextStates[]> {
  const obligations = await listObligationsBySeu(seuId);
  return Promise.all(
    obligations.map(async (obligation) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Obligation", obligation.status);
      return { obligation, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionObligationResult =
  | { ok: true; obligation: ObligationRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function transitionObligation(input: { obligationId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionObligationResult> {
  const { data: obligation } = await obligationsDB.findById(input.obligationId);
  if (!obligation) return { ok: false, reason: "not_found" };

  const fromState = obligation.status;

  // Post-completion fix (Open Design Questions.md #3): Quality Gates used to
  // apply to Deliverable transitions only, even though quality_gates.entity_type
  // was never actually restricted to it — same check transitionDeliverable
  // has always run, now generalised to every SEU-scoped entity type.
  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Obligation",
    entityId: obligation.id,
    seuId: obligation.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const gate = await transitionEngine.evaluate({
    entityType: "Obligation",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { obligation },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Obligation ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await obligationsDB.updateStatus(obligation.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update obligation status");

  await eventBus.publish({
    eventType: "ObligationTransitioned",
    originatingObjectType: "Obligation",
    originatingObjectId: obligation.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  return { ok: true, obligation: updated, appliedTransition: { fromState, toState: input.targetState } };
}
