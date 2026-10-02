// Ch.34 Attention Management Model — Post-MVP Phase 8. Lifecycle transitions
// reuse the same generic transitionEngine every other entity type already
// uses (Ch.29 §10), extended to a ninth entity type.
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { AttentionItemRow } from "../../../dblayer/seuTypes.js";

// author_id is a FK to participants(id) — the SEU-scoped engagement row for
// the acting user's participants_master identity, not participants_master
// itself (attention_items is a seu_id-scoped table, same shape every other
// seu_id-scoped table's author_id FK already takes). No fallback: an actor
// with no participants row in this SEU cannot author an Attention Item here.
export async function resolveAuthor(seuId: string, actorId: string): Promise<{ authorId: string }> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (!participant) throw new Error(`No participants row for participants_master ${master.id} in SEU ${seuId}.`);
  return { authorId: participant.id };
}

// For a system-triggered raise (a blocked governed transition, a stalled
// Work Item sweep, a Telemetry sustained-pattern check, ...) there is no
// session user to record — Owner: use the SEU's own requested_by (the real
// user who commissioned it) as the acting user, badged "system" (not a
// resolved authority badge, since nothing was authorised — the transition
// was blocked). Runs through the same resolveAuthor as every other path, no
// separate fallback logic.
export async function resolveSystemActor(seuId: string): Promise<{ actorId: string; authorBadge: "system" }> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) throw new Error(`SEU not found: ${seuId}`);
  if (seu.requested_by == null) throw new Error(`SEU ${seuId} has no requested_by — cannot author a system-raised Attention Item`);
  return { actorId: String(seu.requested_by), authorBadge: "system" };
}

export async function createAttentionItem(input: {
  seuId: string;
  category: string;
  priority?: string;
  title: string;
  description?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  triggeringEventId?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<AttentionItemRow> {
  const { authorId } = await resolveAuthor(input.seuId, input.actorId);
  const { data: attentionItem, error } = await attentionItemsDB.create({ ...input, authorId, authorBadge: input.authorBadge });
  if (error || !attentionItem) throw error ?? new Error("failed to create attention item");

  await eventBus.publish({
    eventType: "AttentionCreated",
    originatingObjectType: "AttentionItem",
    originatingObjectId: attentionItem.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
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
  actorId: string;
  authorBadge: string;
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

export async function transitionAttentionItem(input: { attentionItemId: string; targetState: string; actorRole: string; actorId: string }): Promise<TransitionAttentionItemResult> {
  const { data: attentionItem } = await attentionItemsDB.findById(input.attentionItemId);
  if (!attentionItem) return { ok: false, reason: "not_found" };

  const fromState = attentionItem.status;

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

  if (!input.actorId) throw new Error("actorId is required to transition an Attention Item");
  if (!gate.authorityBadge) throw new Error(`no authority badge resolved for AttentionItem ${fromState} -> ${input.targetState} — Transition Definition declares no verb`);
  const { authorId } = await resolveAuthor(attentionItem.seu_id, input.actorId);
  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "AttentionItem",
    entityId: attentionItem.id,
    seuId: attentionItem.seu_id,
    fromState,
    toState: input.targetState,
    authorId,
    authorBadge: gate.authorityBadge,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
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
