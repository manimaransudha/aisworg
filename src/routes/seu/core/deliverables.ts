import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { executionEngine } from "../../../domain/engine/executionEngine.js";
import type { DeliverableGovernanceResult } from "../../../domain/engine/executionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { AUTHORING_SCOPE_PACK_CODE } from "../../../domain/sdk/authoringScope.js";
import { assertCanonicalCategory, resolveLabels } from "./ontology.js";
import type { DeliverableRow } from "../../../dblayer/seuTypes.js";

// Phase 10 (badge model) — §10's badge-switcher UI isn't built yet (§17.2,
// deliberately deferred to when Participant deployment/provisioning is
// revisited). Interim, honest resolution for this pass: if the actor holds
// exactly one badge that could plausibly satisfy this Deliverable transition
// (root, or a Creator/Approver grant scoped to this SEU+Capability), use it
// without asking — real per-action selection among *multiple* qualifying
// badges is the piece still deferred, not this auto-resolution itself.
async function resolveAutoActingBadge(actorId: string, deliverable: DeliverableRow): Promise<string | null> {
  const { data: grants } = await badgeGrantsDB.findActiveForHolder(actorId);
  if (!grants) return null;

  const root = grants.find((g) => g.badge_type === "root");
  if (root) return root.id;

  const qualifying = grants.filter(
    (g) =>
      (g.badge_type === "creator" || g.badge_type === "approver") &&
      g.governed_entity_type === "Deliverable" &&
      g.capability_id === deliverable.producing_capability_id &&
      // SDK UI Layer Plan — an authoring Deliverable's grant is scoped to the
      // shared sdk-authoring-scope placeholder Pack, not this one bootstrap
      // SEU's id (014_sdk_authoring.sql's header comment: one grant should
      // cover every bootstrap SEU an author touches, not just this one).
      (g.scope_id === deliverable.seu_id || g.scope_id === AUTHORING_SCOPE_PACK_CODE)
  );
  return qualifying.length === 1 ? qualifying[0].id : null;
}

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
// this type just adds the two outcomes that aren't a governance decision —
// "not_found" (before governance is even reached) and "dispatch_deferred"
// (after governance passes, a Dispatch Engine/Capability-fulfilment concern).
export type TransitionDeliverableResult =
  // Model A (Participant Integration Plan, Resolution 1/11): a governed
  // transition is no longer applied synchronously. Governance passes, a Work
  // Item is dispatched, and the Deliverable stays in its *current* state until
  // the Participant's result callback lands (completeWorkItem). The success of
  // this call means "dispatched and outstanding," not "transitioned."
  | { ok: true; dispatched: true; workItemId: string; participantId?: string; pendingTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | Exclude<DeliverableGovernanceResult, { ok: true }>
  | { ok: false; reason: "dispatch_deferred"; detail: string };

// Post-MVP Phase 3 (Ch.31/32/33): once governance allows the transition, it
// no longer applies directly: the Execution Engine generates a Command, a
// Work Item is derived from it, and the Dispatch Engine must actually assign
// that Work Item to a Participant before the Deliverable's lifecycle_state
// changes. If nobody currently fulfils the Deliverable's producing
// Capability, the transition is deferred rather than silently applied — a
// real behavioural change from the direct-POST MVP.
export async function transitionDeliverable(input: {
  deliverableId: string;
  targetState: string;
  // CR-006: authorisation is the `deliverable_<verb>` badge held by actorId
  // (root bypasses) — see transitionEngine (called from within the Execution
  // Engine's own evaluateDeliverableTransition now). actorRole is ignored for
  // authority (kept only because routes still pass it). actingBadgeGrantId is
  // NOT an authorisation input — it is attribution recorded on the dispatched
  // Work Item / attestation (which grant certified the action);
  // resolveAutoActingBadge picks it when unambiguous.
  actorRole?: string;
  actingBadgeGrantId?: string;
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

  let actingBadgeGrantId = input.actingBadgeGrantId ?? null;
  if (!actingBadgeGrantId && input.actorId) {
    actingBadgeGrantId = await resolveAutoActingBadge(input.actorId, deliverable);
  }

  const correlationId = eventBus.newCorrelationId();
  const execution = await executionEngine.execute({
    seuId: deliverable.seu_id,
    entityType: "Deliverable",
    entityId: deliverable.id,
    fromState,
    toState: input.targetState,
    producingCapabilityId: deliverable.producing_capability_id,
    requestedBy: input.requestedBy ?? null,
    actingBadgeGrantId,
    targetCompletionAt: input.targetCompletionAt ?? null,
    correlationId,
  });

  if (!execution.dispatched) {
    return {
      ok: false,
      reason: "dispatch_deferred",
      detail: "no Participant currently fulfils this Deliverable's producing Capability — assign one before this transition can be dispatched",
    };
  }

  // Dispatched and outstanding. The Deliverable's lifecycle_state is
  // deliberately NOT changed here — the DeliverableTransitioned event and the
  // state change are emitted by completeWorkItem when the Participant reports a
  // `done` result. This is the async control-flow inversion Model A requires:
  // core dispatches, then waits for the result-in callback to drive the
  // transition (Participant Integration Plan, Resolution 11).
  return {
    ok: true,
    dispatched: true,
    workItemId: execution.workItemId,
    participantId: execution.participantId,
    pendingTransition: { fromState, toState: input.targetState },
  };
}
