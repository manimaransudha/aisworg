import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { executionEngine } from "../../../domain/engine/executionEngine.js";
import type { DeliverableGovernanceResult } from "../../../domain/engine/executionEngine.js";
import { transitionEngine, type GateRejectionResult } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, resolveLabels } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
// Commented out (owner): the catalogue is read from the EBM's settled result.
// import { loadSeuCatalogue } from "../../../domain/engine/deliverableSource.js";
import { loadSettled } from "../../../domain/engine/ebmSettled.js";
import type { DeliverableRow } from "../../../dblayer/seuTypes.js";

export async function createDeliverable(input: { seuId: string; name: string; category: string; actorId: string }): Promise<{ deliverable: DeliverableRow }> {
  await assertCanonicalCategory("deliverable-name", input.category);

  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) throw new Error("SEU not found");
  const settledDeliverables = (await loadSettled(seu.id))?.services?.result ?? [];
  if (!settledDeliverables.some((entry) => entry.name === input.name)) {
    throw new Error(`"${input.name}" is not a Deliverable this SEU's EBM settles — only Deliverables in the EBM's catalogue can be added`);
  }

  const { data: existing } = await deliverablesDB.findBySeuId(input.seuId);
  if (existing?.some((d) => d.name === input.name)) {
    throw new Error(`a Deliverable named "${input.name}" already exists on this SEU`);
  }

  const { authorId } = await resolveAuthor(input.seuId, input.actorId);
  const birth = await transitionEngine.beginBirth({ entityType: "Deliverable", actorId: input.actorId });
  const { data: deliverable, error } = await deliverablesDB.create({ seuId: input.seuId, name: input.name, category: input.category, state: birth.initialState, authorId, authorBadge: birth.authorityBadge });
  if (error || !deliverable) throw error ?? new Error("failed to create deliverable");

  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverable.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: birth.authorityBadge,
    versionEvent: birth.versionEvent,
    payload: { name: deliverable.name, category: deliverable.category },
  });
  return { deliverable };
}

export type TransitionDeliverableResult =
  | { ok: true; fromState: string; toState: string }
  | { ok: false; reason: "not_found" }
  | Exclude<DeliverableGovernanceResult, { ok: true }>
  | GateRejectionResult;

// A request to move a Deliverable. The request is the Command: the Execution Engine governs it and, when governance
// passes, makes the transition itself. The requester is a participant (button click) or the system actor (governed hop).
export async function transitionDeliverable(input: {
  deliverableId: string;
  targetState: string;
  actorId: string;
  requestedBy: string;
}): Promise<TransitionDeliverableResult> {
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) return { ok: false, reason: "not_found" };

  const governance = await executionEngine.evaluateDeliverableTransition({
    deliverable, targetState: input.targetState, actorId: input.actorId,
  });
  if (!governance.ok) return governance;
  const { fromState } = governance;

  const applied = await executionEngine.applyDeliverableTransition({
    deliverable,
    fromState,
    toState: input.targetState,
    requestedBy: input.requestedBy,
    actingBadgeType: governance.actingBadgeType,
    governanceOutcome: governance.governanceOutcome,
    correlationId: eventBus.newCorrelationId(),
  });
  if (!applied.ok) return applied;

  return { ok: true, fromState, toState: input.targetState };
}
