import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { executionEngine } from "../../../domain/engine/executionEngine.js";
import type { DeliverableGovernanceResult } from "../../../domain/engine/executionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, resolveLabels } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import type { DeliverableRow } from "../../../dblayer/seuTypes.js";

export async function createDeliverable(input: { seuId: string; name: string; category: string; actorId: string }): Promise<{ deliverable: DeliverableRow }> {
  await assertCanonicalCategory("category:deliverable", input.category);

  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) throw new Error("SEU not found");
  const { data: template } = await templatesDB.findById(seu.template_id);
  if (!template) throw new Error("template not found");
  const catalogueLabels = await resolveLabels(template.tenant_id, "deliverable-name");
  if (!template.deliverable_catalogue.some((entry) => (catalogueLabels[entry.code] ?? entry.code) === input.name)) {
    throw new Error(`"${input.name}" is not a Deliverable this SEU's Template declares — only names already in the Template's own catalogue can be added`);
  }

  const { data: existing } = await deliverablesDB.findBySeuId(input.seuId);
  if (existing?.some((d) => d.name === input.name)) {
    throw new Error(`a Deliverable named "${input.name}" already exists on this SEU`);
  }

  const { authorId } = await resolveAuthor(input.seuId, input.actorId);
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(input.actorId);
  const authorBadge = isRoot ? "root" : [...badgeTypes][0] ?? "general";
  const { data: deliverable, error } = await deliverablesDB.create({ seuId: input.seuId, name: input.name, category: input.category, authorId, authorBadge });
  if (error || !deliverable) throw error ?? new Error("failed to create deliverable");

  return { deliverable };
}

export type TransitionDeliverableResult =
  | { ok: true; fromState: string; toState: string }
  | { ok: false; reason: "not_found" }
  | Exclude<DeliverableGovernanceResult, { ok: true }>;
export async function transitionDeliverable(input: {
  deliverableId: string;
  targetState: string;
  actorRole?: string;
  actingBadgeType?: string;
  actorId?: string;
  requestedBy?: string | null;
  targetCompletionAt?: Date | null;
}): Promise<TransitionDeliverableResult> {
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) return { ok: false, reason: "not_found" };

  const governance = await executionEngine.evaluateDeliverableTransition({
    deliverable, targetState: input.targetState, actorId: input.actorId,
  });
  if (!governance.ok) return governance;
  const { fromState } = governance;

  const actingBadgeType = input.actingBadgeType ?? governance.actingBadgeType;

  const correlationId = eventBus.newCorrelationId();
  await executionEngine.execute({
    seuId: deliverable.seu_id,
    entityType: "Deliverable",
    entityId: deliverable.id,
    fromState,
    toState: input.targetState,
    producingCapabilityId: deliverable.producing_capability_id,
    requestedBy: input.requestedBy ?? null,
    actorId: input.actorId,
    actingBadgeType,
    targetCompletionAt: input.targetCompletionAt ?? null,
    correlationId,
    governanceOutcome: governance.governanceOutcome,
  });

  return { ok: true, fromState, toState: input.targetState };
}
