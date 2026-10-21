import { knowledgeItemsDB } from "../../../dblayer/knowledgeItemsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine, gateRejection } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { createObligation } from "./obligations.js";
import { assertCanonicalCategory } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
import type { AcquisitionScope, EngineeringCapitalRow, KnowledgeItemRow, KnowledgeRelationshipReferences, KnowledgeSelfReferences, KnowledgeValidationNoteRow, ObligationRow } from "../../../dblayer/seuTypes.js";

function assertNoSelfReference(knowledgeItemId: string, references: KnowledgeSelfReferences): void {
  for (const ids of Object.values(references)) {
    if (ids?.includes(knowledgeItemId)) throw new Error(`knowledge_references may not include the Knowledge Item's own id (${knowledgeItemId})`);
  }
}

export async function createKnowledgeItem(input: {
  seuId: string;
  deliverableId: string;
  category: string;
  title: string;
  description?: string | null;
  acquisitionScope?: AcquisitionScope;
  deliverableReferences?: KnowledgeRelationshipReferences;
  evidenceReferences?: KnowledgeRelationshipReferences;
  decisionReferences?: KnowledgeRelationshipReferences;
  knowledgeReferences?: KnowledgeSelfReferences;
  confidenceLevel?: string | null;
  actorId: string;
}): Promise<KnowledgeItemRow> {
  await assertCanonicalCategory("category:knowledge", input.category);
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) throw new Error(`deliverable not found: ${input.deliverableId}`);
  if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.deliverableId} does not belong to SEU ${input.seuId}`);

  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, "knowledge_observe");
  const { authorId } = await resolveAuthor(input.seuId, input.actorId);

  const { data: knowledgeItem, error } = await knowledgeItemsDB.create({
    seuId: input.seuId,
    deliverableId: input.deliverableId,
    category: input.category,
    title: input.title,
    description: input.description,
    acquisitionScope: input.acquisitionScope ?? deliverable.acquisition_scope,
    deliverableReferences: input.deliverableReferences,
    evidenceReferences: input.evidenceReferences,
    decisionReferences: input.decisionReferences,
    knowledgeReferences: input.knowledgeReferences,
    confidenceLevel: input.confidenceLevel,
    authorId,
    authorityBadge: authorBadge,
  });
  if (error || !knowledgeItem) throw error ?? new Error("failed to create knowledge item");

  await eventBus.publish({
    eventType: "KnowledgeObserved",
    originatingObjectType: "Knowledge",
    originatingObjectId: knowledgeItem.id,
    seuId: knowledgeItem.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: authorBadge,
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
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionKnowledgeItem(input: { knowledgeItemId: string; targetState: string; actorId: string }): Promise<TransitionKnowledgeItemResult> {
  const { data: knowledgeItem } = await knowledgeItemsDB.findById(input.knowledgeItemId);
  if (!knowledgeItem) return { ok: false, reason: "not_found" };

  const fromState = knowledgeItem.status;

  const gate = await transitionEngine.evaluateGoverned({
    entityType: "Knowledge",
    fromState,
    toState: input.targetState,
    actorId: input.actorId,
    entityId: knowledgeItem.id,
    seuId: knowledgeItem.seu_id,
    context: { knowledgeItem },
    gateEntityId: knowledgeItem.id,
    gateSeuId: knowledgeItem.seu_id,
  });
  if (!gate.allowed) return gateRejection(gate, "Knowledge", fromState, input.targetState);
  const { authorId: qualityGateAuthorId } = gate;

  const { data: updated, error } = await knowledgeItemsDB.updateStatus(knowledgeItem.id, input.targetState, qualityGateAuthorId, gate.authorityBadge);
  if (error || !updated) throw error ?? new Error("failed to update knowledge item status");

  await eventBus.publish({
    eventType: gate.eventType ?? "KnowledgeUpdated",
    originatingObjectType: "Knowledge",
    originatingObjectId: knowledgeItem.id,
    seuId: knowledgeItem.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, knowledgeItem: updated, appliedTransition: { fromState, toState: input.targetState } };
}

const PROMOTION_SEVERITY: Record<AcquisitionScope, string> = { SEU: "Low", Capability: "Medium", Enterprise: "High", Platform: "High" };

export type PromoteKnowledgeItemScopeResult =
  | { ok: true; knowledgeItem: KnowledgeItemRow; appliedTransition: { fromState: string; toState: string }; obligation: ObligationRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_published"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function promoteKnowledgeItemScope(input: { knowledgeItemId: string; targetScope: AcquisitionScope; actorId: string }): Promise<PromoteKnowledgeItemScopeResult> {
  const { data: knowledgeItem } = await knowledgeItemsDB.findById(input.knowledgeItemId);
  if (!knowledgeItem) return { ok: false, reason: "not_found" };

  if (knowledgeItem.status !== "Published") {
    return { ok: false, reason: "not_published", detail: `Knowledge Item must be Published before its Acquisition Scope can be promoted (currently ${knowledgeItem.status})` };
  }

  const fromScope = knowledgeItem.acquisition_scope;
  const gate = await transitionEngine.evaluate({
    entityType: "KnowledgeScope",
    fromState: fromScope,
    toState: input.targetScope,
    actorId: input.actorId,
    entityId: knowledgeItem.id,
    seuId: knowledgeItem.seu_id,
    context: { knowledgeItem },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") {
      return { ok: false, reason: "no_transition_definition", detail: `Acquisition Scope cannot move from ${fromScope} to ${input.targetScope} — promotion is one tier at a time (SEU → Capability → Enterprise → Platform) and never demotes` };
    }
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  if (!gate.authorityBadge) throw new Error("promoteKnowledgeItemScope: no resolved authority badge for this scope promotion");
  const { authorId } = await resolveAuthor(knowledgeItem.seu_id, input.actorId);
  const { data: updated, error } = await knowledgeItemsDB.updateAcquisitionScope(knowledgeItem.id, input.targetScope, authorId, gate.authorityBadge);
  if (error || !updated) throw error ?? new Error("failed to promote knowledge item acquisition scope");

  await eventBus.publish({
    eventType: gate.eventType ?? "KnowledgeScopePromoted",
    originatingObjectType: "Knowledge",
    originatingObjectId: knowledgeItem.id,
    seuId: knowledgeItem.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromScope, toScope: input.targetScope },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
  });

  const obligation = await createObligation({
    relatedObjectType: "Deliverable",
    relatedObjectId: knowledgeItem.deliverable_id,
    category: "Organisational Learning",
    title: `Codify "${knowledgeItem.title}" now that it is ${input.targetScope}-scoped Engineering Capital`,
    description: `Knowledge Item ${knowledgeItem.id} was promoted from ${fromScope} to ${input.targetScope} Acquisition Scope. Ch.16 §13: understanding at this scope should be formally codified into a Capability, Service or Policy rather than left as a queryable Knowledge Item.`,
    severity: PROMOTION_SEVERITY[input.targetScope],
    origin: "Telemetry and Knowledge Model",
    originatingEntityType: "Knowledge",
    originatingEntityId: knowledgeItem.id,
    actorId: input.actorId,
    authorBadge: gate.authorityBadge,
  });

  return { ok: true, knowledgeItem: updated, appliedTransition: { fromState: fromScope, toState: input.targetScope }, obligation };
}

export async function getEngineeringCapital(): Promise<EngineeringCapitalRow[]> {
  const { data } = await knowledgeItemsDB.findEngineeringCapital();
  return data ?? [];
}

export async function addKnowledgeValidationNote(input: { knowledgeItemId: string; noteText: string; actorId: string }): Promise<KnowledgeValidationNoteRow> {
  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, "knowledge_validate");
  const { data: master } = await participantsMasterDB.findById(input.actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: note, error } = await knowledgeItemsDB.addValidationNote({ knowledgeItemId: input.knowledgeItemId, noteText: input.noteText, actorId: master.id, authorityBadge: authorBadge });
  if (error || !note) throw error ?? new Error("failed to add knowledge validation note");
  return note;
}

export async function listKnowledgeValidationNotes(knowledgeItemId: string): Promise<KnowledgeValidationNoteRow[]> {
  const { data } = await knowledgeItemsDB.listValidationNotes(knowledgeItemId);
  return data ?? [];
}

export async function updateKnowledgeReferences(knowledgeItemId: string, knowledgeReferences: KnowledgeSelfReferences): Promise<KnowledgeItemRow> {
  assertNoSelfReference(knowledgeItemId, knowledgeReferences);
  const { data: updated, error } = await knowledgeItemsDB.updateKnowledgeReferences(knowledgeItemId, knowledgeReferences);
  if (error || !updated) throw error ?? new Error("failed to update knowledge references");
  return updated;
}
