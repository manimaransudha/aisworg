import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { executionEngine } from "../../../domain/engine/executionEngine.js";
import type { DeliverableGovernanceResult } from "../../../domain/engine/executionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, resolveLabels } from "./ontology.js";
import type { DeliverableRow } from "../../../dblayer/seuTypes.js";

// CR-039 — a Deliverable created beyond commissioning ("beyond whatever the
// Template catalogue pre-seeded," Ch.15) must still be a real member of its
// Template's own canonical dependency graph, not an ungoverned one-off. The
// old model let a caller wire bespoke, per-instance dependency_edges for any
// name at all (dependsOnDeliverableIds/dependsOnServiceIds, now removed);
// under the canonical (entity_type, name, state) model, dependency behaviour
// is inherited automatically by matching name against the Template's own
// dependency_definitions rows, never specified per call. That only works if
// name is guaranteed to be one the Template actually declared — so this is
// "instantiate a catalogue entry commissioning didn't already create," not
// "create anything." (Owner, 2026-08-20: "a new deliverable has to inherit
// from the template so the dependencies are inherited.")
export async function createDeliverable(input: { seuId: string; name: string; category: string }): Promise<{ deliverable: DeliverableRow }> {
  await assertCanonicalCategory("category:deliverable", input.category);

  const { data: seu } = await seusDB.findById(input.seuId);
  if (!seu) throw new Error("SEU not found");
  const { data: template } = await templatesDB.findById(seu.template_id);
  if (!template) throw new Error("template not found");
  // CR-087 — deliverable_catalogue entries carry a deliverable-name Ontology
  // code now, not the display name input.name is (still matches
  // deliverables.name, the runtime identity dependency_definitions gates
  // against) — resolve each entry's code to its tenant-aware label before
  // checking membership.
  const catalogueLabels = await resolveLabels(template.tenant_id, "deliverable-name");
  if (!template.deliverable_catalogue.some((entry) => (catalogueLabels[entry.code] ?? entry.code) === input.name)) {
    throw new Error(`"${input.name}" is not a Deliverable this SEU's Template declares — only names already in the Template's own catalogue can be added`);
  }

  const { data: existing } = await deliverablesDB.findBySeuId(input.seuId);
  if (existing?.some((d) => d.name === input.name)) {
    throw new Error(`a Deliverable named "${input.name}" already exists on this SEU`);
  }

  const { data: deliverable, error } = await deliverablesDB.create({ seuId: input.seuId, name: input.name, category: input.category });
  if (error || !deliverable) throw error ?? new Error("failed to create deliverable");

  return { deliverable };
}

// CR-107 item 7 — the Execution Engine (domain/engine/executionEngine.ts)
// now owns every governance decision (dependency readiness, the SEU-blocked
// and per-Deliverable-Obligation checks, Quality Gate, Policy, Authority);
// this type just adds "not_found" (before governance is even reached).
//
// execute() is now an event-boundary function (void return, CommandGenerated
// onward runs in its own consumers) — transitionDeliverable can no longer
// report dispatched/workItemId/participantId, because those facts don't
// exist yet when this call returns. Success here means only "governance
// cleared, Command requested" — dispatch outcome (WorkItemDispatched /
// DispatchDeferred) is visible only through events from here on.
export type TransitionDeliverableResult =
  | { ok: true; fromState: string; toState: string }
  | { ok: false; reason: "not_found" }
  | Exclude<DeliverableGovernanceResult, { ok: true }>;
export async function transitionDeliverable(input: {
  deliverableId: string;
  targetState: string;
  // CR-006: authorisation is the `deliverable_<verb>` badge held by actorId
  // (root bypasses) — see transitionEngine (called from within the Execution
  // Engine's own evaluateDeliverableTransition now). actorRole is ignored for
  // authority (kept only because routes still pass it). actingBadgeType is
  // NOT an authorisation input — it is attribution recorded on the dispatched
  // Work Item / attestation (which badge certified the action). Owner
  // (2026-09-22): "why do we even need this? the intent is to log the badge
  // along with the actor_id" — evaluateDeliverableTransition's own real
  // authority check already knows the answer (governance.actingBadgeType
  // below); no separate resolution needed unless a caller explicitly
  // overrides it.
  actorRole?: string;
  actingBadgeType?: string;
  actorId?: string;
  requestedBy?: number | null;
  // Participant Integration — Plan step 4: the assigner may override the SLA-
  // derived default deadline with an explicit target completion time.
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
    actingBadgeType,
    targetCompletionAt: input.targetCompletionAt ?? null,
    correlationId,
    governanceOutcome: governance.governanceOutcome,
  });

  // Governance cleared and a Command was requested — that's all this call
  // can report now. Whether it actually gets dispatched, deferred, or fails
  // is decided later, asynchronously, by commandGeneratedHandler /
  // workItemGeneratedHandler / dispatchEngine, and is visible only through
  // their own events (CommandGenerated, WorkItemDispatched, DispatchDeferred).
  return { ok: true, fromState, toState: input.targetState };
}
