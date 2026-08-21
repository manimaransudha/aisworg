// Participant Integration & Attestation — Plan, step 1 (Model A). The core
// resume point for an outstanding Work Item: a Participant (human or AI, via
// any edge — webhook, human form, agent, manual) reports a result, and the
// platform drives the governed transition the Work Item was dispatched *for*.
//
// The result shape { workItemId, outcome, reference } is tenant-invariant —
// every edge adapter normalises to it before this ever runs (§0.1). This
// module never sees a VCS provider, an orchestrator, or an auth scheme; the
// reference is stored as an opaque string. On `done`, the transition the
// dispatching Command already governed and authorised is applied here (Model
// A: the callback drives the transition, uniformly for production, approval,
// and baselining alike). On `failed`/`blocked`, the transition is not applied
// and an Attention Item is raised.
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { deliverableReferencesDB } from "../../../dblayer/deliverableReferencesDB.js";
import { attestationsDB } from "../../../dblayer/attestationsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem } from "./attentionItems.js";
import type { DeliverableRow, WorkItemRow } from "../../../dblayer/seuTypes.js";

export type WorkItemOutcome = "done" | "failed" | "blocked";

// Participant Integration & Attestation — Plan step 2 (Resolutions 2–4). The
// acceptance transitions: the only ones that advance a Deliverable's
// authoritative state to a *certified* state, and so the only ones that mint an
// attestation. Producer completion (Defined -> In Progress) attaches a
// reference but is not an acceptance — it certifies nothing.
export const ACCEPTANCE_TRANSITIONS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "In Progress", to: "Approved" },
  { from: "Approved", to: "Baselined" },
];

export function isAcceptanceTransition(fromState: string, toState: string): boolean {
  return ACCEPTANCE_TRANSITIONS.some((t) => t.from === fromState && t.to === toState);
}

export type CompleteWorkItemResult =
  | { ok: true; outcome: "done"; workItem: WorkItemRow; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: true; outcome: "failed" | "blocked"; workItem: WorkItemRow }
  | { ok: false; reason: "not_found" | "not_outstanding" | "unsupported_entity_type"; detail: string };

// Ch.32 §8 lifecycle, async form: a Work Item sits Dispatched (outstanding)
// until this runs. 'Executing' is never observed out-of-process (the platform
// is blind to the Participant's own environment), so the happy path goes
// Dispatched -> Completed -> Disposed on `done`, and Dispatched -> Failed on
// failure — Ch.32 WI-005 still holds: Work Item completion itself doesn't
// change engineering state; applying the Deliverable transition is a separate,
// explicit step below.
export async function completeWorkItem(input: {
  workItemId: string;
  outcome: WorkItemOutcome;
  reference?: string | null;
}): Promise<CompleteWorkItemResult> {
  const { data: workItem } = await workItemsDB.findById(input.workItemId);
  if (!workItem) return { ok: false, reason: "not_found", detail: `Work Item not found: ${input.workItemId}` };
  if (workItem.status !== "Dispatched") {
    return { ok: false, reason: "not_outstanding", detail: `Work Item ${workItem.id} is not outstanding (status: ${workItem.status})` };
  }

  const { data: command } = await commandsDB.findById(workItem.command_id);
  if (!command) return { ok: false, reason: "not_found", detail: `Command not found for Work Item ${workItem.id}` };
  if (command.entity_type !== "Deliverable") {
    return { ok: false, reason: "unsupported_entity_type", detail: `Work Item completion only drives Deliverable transitions today, not ${command.entity_type}` };
  }

  const correlationId = command.correlation_id;

  // Store the raw reference regardless of outcome — it is candidate output,
  // not a certified result (Plan Resolution 3); a failed attempt may still
  // point at what was attempted.
  const { data: withRef } = await workItemsDB.setOutputReference(workItem.id, input.reference ?? null);
  const currentWorkItem = withRef ?? workItem;

  if (input.outcome !== "done") {
    await workItemsDB.updateStatus(workItem.id, "Failed");
    await commandsDB.updateStatus(command.id, "Failed");
    if (workItem.participant_id) await participantsDB.updateStatus(workItem.participant_id, "Idle");

    await eventBus.publish({
      eventType: "WorkItemFailed",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      correlationId,
      payload: { outcome: input.outcome, deliverableId: command.entity_id },
    });

    // Ch.34 / Ch.36 Failed -> Attention path: an out-of-process Participant
    // reporting failure or blockage is exactly the "cannot automatically
    // continue" case that needs human attention.
    const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
    await raiseAttentionItem({
      seuId: command.seu_id,
      category: "Exception",
      priority: "High",
      title: `Work Item ${input.outcome} on Deliverable "${deliverable?.name ?? command.entity_id}"`,
      description: `A Participant reported "${input.outcome}" for the ${command.from_state} -> ${command.to_state} transition. The transition was not applied.`,
      relatedObjectType: "Deliverable",
      relatedObjectId: command.entity_id,
    });

    return { ok: true, outcome: input.outcome, workItem: currentWorkItem };
  }

  // done: apply the governed transition the Command was dispatched for. The
  // authority/policy/quality-gate checks already ran at dispatch time
  // (transitionDeliverable), against the actor who initiated this specific
  // transition — separation of duties is preserved because a producer can
  // only ever have dispatched the transition their authority permits (Model
  // A / Plan Resolution 1).
  const { data: updated, error } = await deliverablesDB.updateLifecycleState(command.entity_id, command.to_state);
  if (error || !updated) throw error ?? new Error("failed to apply deliverable transition on work item completion");

  // CR-042 — the real state-change point: tell the canonical dependency
  // graph a Deliverable just landed in a new state, so it can publish
  // DeliverableReady for whatever downstream node this just unblocked.
  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
    seuId: command.seu_id,
    entityType: "Deliverable",
    name: updated.name,
    newState: command.to_state,
    correlationId,
  });

  // Durable raw reference (Resolution 3): the candidate output the Participant
  // returned, bound to the state its Work Item drove toward. Recorded for every
  // completion — production and acceptance alike — because Work Items are
  // transient (Ch.32) and the empty-centre presence check + Ch.20 traceability
  // must read a durable home, not work_items.output_reference.
  await deliverableReferencesDB.record({
    seuId: command.seu_id,
    deliverableId: command.entity_id,
    workItemId: workItem.id,
    participantId: workItem.participant_id,
    fromState: command.from_state,
    toState: command.to_state,
    reference: input.reference ?? null,
  });

  // Attestation (Resolution 3): minted ONLY at an acceptance transition — the
  // SEU-scoped governance outcome ("this Deliverable reached this certified
  // state, by this authority, referencing this commit"). Production completions
  // attach a reference but certify nothing, so they mint no attestation.
  if (isAcceptanceTransition(command.from_state, command.to_state)) {
    await attestationsDB.create({
      seuId: command.seu_id,
      deliverableId: command.entity_id,
      workItemId: workItem.id,
      participantId: workItem.participant_id,
      fromState: command.from_state,
      toState: command.to_state,
      reference: input.reference ?? null,
      actingBadgeGrantId: command.acting_badge_grant_id,
      requestedBy: command.requested_by,
    });
  }

  // Accountability record (bug fix correcting CR-014): the real actor who
  // initiated this Deliverable transition (command.requested_by), and the
  // `noun_verb` badge it was authorised under (derived from the same transition
  // definition the dispatch was gated on). Never a system substitute.
  const { data: deliverableTd } = await transitionDefinitionsDB.find("Deliverable", command.from_state, command.to_state);
  await eventBus.publish({
    eventType: "DeliverableTransitioned",
    originatingObjectType: "Deliverable",
    originatingObjectId: command.entity_id,
    correlationId,
    causationId: workItem.id,
    payload: { fromState: command.from_state, toState: command.to_state, commandId: command.id, workItemId: workItem.id, participantId: workItem.participant_id, reference: input.reference ?? null },
    actorId: command.requested_by != null ? String(command.requested_by) : null,
    authorityBadge: deliverableTd?.verb ? `deliverable_${deliverableTd.verb}` : null,
  });

  await workItemsDB.updateStatus(workItem.id, "Completed");
  await eventBus.publish({ eventType: "WorkItemCompleted", originatingObjectType: "WorkItem", originatingObjectId: workItem.id, correlationId, payload: {} });
  await workItemsDB.updateStatus(workItem.id, "Disposed");
  await eventBus.publish({ eventType: "WorkItemDisposed", originatingObjectType: "WorkItem", originatingObjectId: workItem.id, correlationId, payload: {} });
  await commandsDB.updateStatus(command.id, "Completed");

  // Idle, not Available (Ch.13 §9): still held by an open Capability
  // Fulfilment, just between Work Items.
  if (workItem.participant_id) {
    await participantsDB.updateStatus(workItem.participant_id, "Idle");
    await eventBus.publish({
      eventType: "ParticipantIdle",
      originatingObjectType: "Participant",
      originatingObjectId: workItem.participant_id,
      correlationId,
      payload: { workItemId: workItem.id },
    });
  }

  return { ok: true, outcome: "done", workItem: { ...currentWorkItem, status: "Disposed" }, deliverable: updated, appliedTransition: { fromState: command.from_state, toState: command.to_state } };
}
