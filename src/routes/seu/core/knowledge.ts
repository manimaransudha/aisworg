// Ch.16 Knowledge Model — Post-MVP Phase 5. Lifecycle transitions reuse the
// same generic transitionEngine every other entity type already uses
// (Ch.29 §10), extended to a sixth entity type.
import { knowledgeItemsDB } from "../../../dblayer/knowledgeItemsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { createObligation } from "./obligations.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { AcquisitionScope, EngineeringCapitalRow, KnowledgeItemRow, ObligationRow } from "../../../dblayer/seuTypes.js";

// FR-16.8: Acquisition Scope is inherited by default from the producing
// Deliverable (Ch.15 §9) — a caller may still override it explicitly (e.g. an
// SEU-scoped Deliverable can still produce Capability-scoped Knowledge, if a
// human judges the understanding generalises further than the Deliverable
// itself was declared to).
export async function createKnowledgeItem(input: {
  seuId: string;
  deliverableId: string;
  evidenceId?: string | null;
  category: string;
  title: string;
  description?: string | null;
  acquisitionScope?: AcquisitionScope;
}): Promise<KnowledgeItemRow> {
  await assertCanonicalCategory("category:knowledge", input.category);
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) throw new Error(`deliverable not found: ${input.deliverableId}`);
  if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.deliverableId} does not belong to SEU ${input.seuId}`);

  const { data: knowledgeItem, error } = await knowledgeItemsDB.create({
    seuId: input.seuId,
    deliverableId: input.deliverableId,
    evidenceId: input.evidenceId,
    category: input.category,
    title: input.title,
    description: input.description,
    acquisitionScope: input.acquisitionScope ?? deliverable.acquisition_scope,
  });
  if (error || !knowledgeItem) throw error ?? new Error("failed to create knowledge item");

  await eventBus.publish({
    eventType: "KnowledgeObserved",
    originatingObjectType: "Knowledge",
    originatingObjectId: knowledgeItem.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { deliverableId: input.deliverableId, category: input.category, acquisitionScope: knowledgeItem.acquisition_scope },
  });

  return knowledgeItem;
}

export async function listKnowledgeItemsBySeu(seuId: string): Promise<KnowledgeItemRow[]> {
  const { data } = await knowledgeItemsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface KnowledgeItemWithNextStates {
  knowledgeItem: KnowledgeItemRow;
  possibleNextStates: string[];
  possibleNextScopes: string[];
}

export async function listKnowledgeItemsWithNextStates(seuId: string): Promise<KnowledgeItemWithNextStates[]> {
  const items = await listKnowledgeItemsBySeu(seuId);
  return Promise.all(
    items.map(async (knowledgeItem) => {
      const [{ data: possibleNextStates }, { data: possibleNextScopes }] = await Promise.all([
        transitionDefinitionsDB.findPossibleNextStates("Knowledge", knowledgeItem.status),
        transitionDefinitionsDB.findPossibleNextStates("KnowledgeScope", knowledgeItem.acquisition_scope),
      ]);
      return { knowledgeItem, possibleNextStates: possibleNextStates ?? [], possibleNextScopes: possibleNextScopes ?? [] };
    })
  );
}

export type TransitionKnowledgeItemResult =
  | { ok: true; knowledgeItem: KnowledgeItemRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function transitionKnowledgeItem(input: { knowledgeItemId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionKnowledgeItemResult> {
  const { data: knowledgeItem } = await knowledgeItemsDB.findById(input.knowledgeItemId);
  if (!knowledgeItem) return { ok: false, reason: "not_found" };

  const fromState = knowledgeItem.status;

  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Knowledge",
    entityId: knowledgeItem.id,
    seuId: knowledgeItem.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const gate = await transitionEngine.evaluate({
    entityType: "Knowledge",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { knowledgeItem },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Knowledge ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await knowledgeItemsDB.updateStatus(knowledgeItem.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update knowledge item status");

  await eventBus.publish({
    eventType: "KnowledgeUpdated",
    originatingObjectType: "Knowledge",
    originatingObjectId: knowledgeItem.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, knowledgeItem: updated, appliedTransition: { fromState, toState: input.targetState } };
}

// Ch.16 §12/§13, Book 1 Ch.21 §21.6, Ch.23 §7. Acquisition Scope promotion is
// its own governed transition track (entityType 'KnowledgeScope', distinct
// from 'Knowledge' which governs .status) — see 008_engineering_capital.sql
// for why. The only seeded KnowledgeScope transitions are SEU -> Capability
// -> Enterprise -> Platform, so a demotion or a skipped tier is rejected by
// the ordinary "no_transition_definition" path, with no bespoke validation
// code required (Ch.16 §12: "Acquisition Scope may not be silently demoted").
const PROMOTION_SEVERITY: Record<AcquisitionScope, string> = { SEU: "Low", Capability: "Medium", Enterprise: "High", Platform: "High" };

export type PromoteKnowledgeItemScopeResult =
  | { ok: true; knowledgeItem: KnowledgeItemRow; appliedTransition: { fromState: string; toState: string }; obligation: ObligationRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_published"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function promoteKnowledgeItemScope(input: { knowledgeItemId: string; targetScope: AcquisitionScope; actorRole: string; actorId?: string }): Promise<PromoteKnowledgeItemScopeResult> {
  const { data: knowledgeItem } = await knowledgeItemsDB.findById(input.knowledgeItemId);
  if (!knowledgeItem) return { ok: false, reason: "not_found" };

  // Ch.16 §9: "Only Published Knowledge may be reused across SEUs by
  // default" — promoting scope before that point would widen reuse of
  // understanding nobody has validated yet.
  if (knowledgeItem.status !== "Published") {
    return { ok: false, reason: "not_published", detail: `Knowledge Item must be Published before its Acquisition Scope can be promoted (currently ${knowledgeItem.status})` };
  }

  const fromScope = knowledgeItem.acquisition_scope;
  const gate = await transitionEngine.evaluate({
    entityType: "KnowledgeScope",
    fromState: fromScope,
    toState: input.targetScope,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { knowledgeItem },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") {
      return { ok: false, reason: "no_transition_definition", detail: `Acquisition Scope cannot move from ${fromScope} to ${input.targetScope} — promotion is one tier at a time (SEU → Capability → Enterprise → Platform) and never demotes` };
    }
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await knowledgeItemsDB.updateAcquisitionScope(knowledgeItem.id, input.targetScope);
  if (error || !updated) throw error ?? new Error("failed to promote knowledge item acquisition scope");

  await eventBus.publish({
    eventType: "KnowledgeScopePromoted",
    originatingObjectType: "Knowledge",
    originatingObjectId: knowledgeItem.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromScope, toScope: input.targetScope },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  // Ch.23 §7 Organisational Learning: Knowledge promoted past its
  // originating SEU indicates the understanding should be formally codified
  // (a revised Capability, Service or Policy), not left as a queryable
  // Knowledge Item (Ch.16 §13) — that codification work is the Obligation
  // this raises. Attached to the Knowledge Item's own originating
  // Deliverable, the only FK Obligation supports (Phase 4 scope).
  const obligation = await createObligation({
    seuId: knowledgeItem.seu_id,
    relatedObjectType: "Deliverable",
    relatedObjectId: knowledgeItem.deliverable_id,
    category: "Organisational Learning",
    title: `Codify "${knowledgeItem.title}" now that it is ${input.targetScope}-scoped Engineering Capital`,
    description: `Knowledge Item ${knowledgeItem.id} was promoted from ${fromScope} to ${input.targetScope} Acquisition Scope. Ch.16 §13: understanding at this scope should be formally codified into a Capability, Service or Policy rather than left as a queryable Knowledge Item.`,
    severity: PROMOTION_SEVERITY[input.targetScope],
  });

  return { ok: true, knowledgeItem: updated, appliedTransition: { fromState: fromScope, toState: input.targetScope }, obligation };
}

// Ch.16 §13 / Book 1 Ch.21 §21.6: Engineering Capital, platform-wide.
export async function getEngineeringCapital(): Promise<EngineeringCapitalRow[]> {
  const { data } = await knowledgeItemsDB.findEngineeringCapital();
  return data ?? [];
}
