// Ch.34 Attention Management Model — Post-MVP Phase 8. Lifecycle transitions
// reuse the same generic transitionEngine every other entity type already
// uses (Ch.29 §10), extended to a ninth entity type.
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { AttentionItemRow } from "../../../dblayer/seuTypes.js";

export async function createAttentionItem(input: {
  seuId: string;
  category: string;
  priority?: string;
  title: string;
  description?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  triggeringEventId?: string | null;
}): Promise<AttentionItemRow> {
  const { data: attentionItem, error } = await attentionItemsDB.create(input);
  if (error || !attentionItem) throw error ?? new Error("failed to create attention item");

  await eventBus.publish({
    eventType: "AttentionCreated",
    originatingObjectType: "AttentionItem",
    originatingObjectId: attentionItem.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { category: input.category, relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId },
  });

  return attentionItem;
}

// Ch.34 AM-002 "Attention shall be minimised": raises a new Attention Item
// for (seuId, category, relatedObjectType, relatedObjectId) only if no OPEN
// one already exists for that exact situation — repeated retries of the same
// blocked transition, for example, must not flood the inbox with duplicates.
// This is the function other core modules call; createAttentionItem above
// stays a plain, undeduplicated create for callers (e.g. a human filing one
// by hand) that don't need that guard.
export async function raiseAttentionItem(input: {
  seuId: string;
  category: string;
  priority?: string;
  title: string;
  description?: string | null;
  relatedObjectType: string;
  relatedObjectId: string;
  triggeringEventId?: string | null;
}): Promise<{ raised: boolean; attentionItem: AttentionItemRow }> {
  const { data: existing } = await attentionItemsDB.findOpenByRelatedObject(input.seuId, input.category, input.relatedObjectType, input.relatedObjectId);
  if (existing) return { raised: false, attentionItem: existing };

  const attentionItem = await createAttentionItem(input);
  return { raised: true, attentionItem };
}

export async function listAttentionItems(): Promise<AttentionItemRow[]> {
  const { data } = await attentionItemsDB.findAll();
  return data ?? [];
}

export async function listAttentionItemsBySeu(seuId: string): Promise<AttentionItemRow[]> {
  const { data } = await attentionItemsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface AttentionItemWithNextStates {
  attentionItem: AttentionItemRow;
  possibleNextStates: string[];
}

export async function listAttentionItemsWithNextStates(items: AttentionItemRow[]): Promise<AttentionItemWithNextStates[]> {
  return Promise.all(
    items.map(async (attentionItem) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("AttentionItem", attentionItem.status);
      return { attentionItem, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionAttentionItemResult =
  | { ok: true; attentionItem: AttentionItemRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionAttentionItem(input: { attentionItemId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionAttentionItemResult> {
  const { data: attentionItem } = await attentionItemsDB.findById(input.attentionItemId);
  if (!attentionItem) return { ok: false, reason: "not_found" };

  const fromState = attentionItem.status;

  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "AttentionItem",
    entityId: attentionItem.id,
    seuId: attentionItem.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const gate = await transitionEngine.evaluate({
    entityType: "AttentionItem",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { attentionItem },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for AttentionItem ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await attentionItemsDB.updateStatus(attentionItem.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update attention item status");

  await eventBus.publish({
    eventType: "AttentionItemTransitioned",
    originatingObjectType: "AttentionItem",
    originatingObjectId: attentionItem.id,
    seuId: attentionItem.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, attentionItem: updated, appliedTransition: { fromState, toState: input.targetState } };
}
