// Participant Lifecycle Governance — Plan (design/mvp-build-plan/Participant
// Lifecycle Governance — Plan.md), Build order steps 1-2. Proves, against
// real dev data (no mocking):
//   1. participantsDB.create lands a real Participant at Available (Ch.13
//      §10 — Capability Fulfilment establishes eligibility), not the old
//      hardcoded 'Assigned' — the real bug this plan's own review caught.
//   2. Participant is a real governed TransitionEntityType: the full Ch.13
//      §9 graph (Created->Available->Assigned->Executing->Idle->Released
//      ->Archived, plus the Idle->Assigned repeat cycle) is seeded and
//      enforced by transitionEngine, and an undefined transition (skipping
//      a state) is rejected the same way any other entity's is.
//   3. The Ch.13 §16 events this plan wires actually fire, on the right
//      edges, with ParticipantAssigned firing for both edges that mean
//      "now Assigned" (Available->Assigned and the repeat-cycle Idle
//      ->Assigned).
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { transitionParticipant, replaceParticipant } from "../src/routes/seu/core/participants.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../src/dblayer/capabilityFulfilmentsDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionAndFulfil(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  const detail = await getSeuDetailView(seuId);
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(reqAnalysisCapability);
  const { participant, seuCapabilityId } = await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Participant lifecycle test analyst" });
  return { seuId, participant, seuCapabilityId };
}

test("Participant is created at Available (Ch.13 §10), not the old hardcoded Assigned, and ParticipantCreated fires", async () => {
  const received: string[] = [];
  eventBus.subscribe((event) => {
    if (event.originating_object_type === "Participant") received.push(event.event_type);
  });

  const { participant } = await commissionAndFulfil("participant-lifecycle-created");
  assert.equal(participant.state, "Available");
  assert.ok(received.includes("ParticipantCreated"));
});

test("Participant transition graph: the full Ch.13 §9 lifecycle is seeded and enforced, including the Assigned/Executing/Idle repeat cycle", async () => {
  // Created -> Available is seeded even though no real row ever sits at
  // Created (participantsDB.create lands directly at Available, matching
  // every other governed entity's create-at-first-real-state precedent) —
  // confirms the seed data itself, not a live transition.
  const { data: createdToAvailable } = await transitionDefinitionsDB.find("Participant", "Created", "Available");
  assert.ok(createdToAvailable, "expected a seeded Created -> Available Transition Definition");

  const received: string[] = [];
  eventBus.subscribe((event) => {
    if (event.originating_object_type === "Participant") received.push(`${event.event_type}`);
  });

  const { participant } = await commissionAndFulfil("participant-lifecycle-graph");

  const toAssigned = await transitionParticipant({ participantId: participant.id, targetState: "Assigned", actorRole: "super" });
  assert.equal(toAssigned.ok, true, !toAssigned.ok ? JSON.stringify(toAssigned) : undefined);
  if (toAssigned.ok) assert.equal(toAssigned.participant.state, "Assigned");

  const toExecuting = await transitionParticipant({ participantId: participant.id, targetState: "Executing", actorRole: "super" });
  assert.equal(toExecuting.ok, true);

  const toIdle = await transitionParticipant({ participantId: participant.id, targetState: "Idle", actorRole: "super" });
  assert.equal(toIdle.ok, true);

  // Repeat cycle: Idle -> Assigned again (a second Work Item dispatched to
  // the same Participant), not a one-shot straight line.
  const backToAssigned = await transitionParticipant({ participantId: participant.id, targetState: "Assigned", actorRole: "super" });
  assert.equal(backToAssigned.ok, true);

  const backToExecuting = await transitionParticipant({ participantId: participant.id, targetState: "Executing", actorRole: "super" });
  assert.equal(backToExecuting.ok, true);
  const backToIdle = await transitionParticipant({ participantId: participant.id, targetState: "Idle", actorRole: "super" });
  assert.equal(backToIdle.ok, true);

  const released = await transitionParticipant({ participantId: participant.id, targetState: "Released", actorRole: "super" });
  assert.equal(released.ok, true);
  if (released.ok) assert.equal(released.participant.state, "Released");

  const archived = await transitionParticipant({ participantId: participant.id, targetState: "Archived", actorRole: "super" });
  assert.equal(archived.ok, true);
  if (archived.ok) assert.equal(archived.participant.state, "Archived");

  // An undefined transition (skipping straight from Available to Executing
  // on a fresh Participant) is rejected the same way any other entity's is.
  const { participant: fresh } = await commissionAndFulfil("participant-lifecycle-skip");
  const skip = await transitionParticipant({ participantId: fresh.id, targetState: "Executing", actorRole: "super" });
  assert.equal(skip.ok, false);
  if (!skip.ok) assert.equal(skip.reason, "no_transition_definition");

  assert.ok(received.includes("ParticipantActivated") === false, "no real Participant ever sits at Created, so ParticipantActivated (Created->Available) never fires in this test");
  assert.equal(received.filter((e) => e === "ParticipantAssigned").length >= 2, true, "expected ParticipantAssigned on both Available->Assigned and the repeat-cycle Idle->Assigned");
  assert.ok(received.includes("ParticipantIdle"));
  assert.ok(received.includes("ParticipantReleased"));
  assert.ok(received.includes("ParticipantArchived"));
});

test("Build order step 3: dispatchEngine moves the fulfilling Participant's own state as a real Deliverable transition dispatches, ending at Idle not Available", async () => {
  const { seuId, participant } = await commissionAndFulfil("participant-lifecycle-dispatch");
  assert.equal(participant.state, "Available");

  const received: string[] = [];
  eventBus.subscribe((event) => {
    if (event.originating_object_type === "Participant" && event.originating_object_id === participant.id) received.push(event.event_type);
  });

  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  assert.ok(requirementsSpec);

  const result = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : undefined);
  if (!result.ok) throw new Error("unreachable");

  // Model A: dispatch alone moves the Participant to Assigned and stops there —
  // it is holding an outstanding Work Item, not yet done.
  const { data: assigned } = await participantsDB.findById(participant.id);
  assert.equal(assigned?.state, "Assigned", "dispatched: the Participant is Assigned, holding the outstanding Work Item");
  assert.ok(received.includes("ParticipantAssigned"), "expected Assigned on dispatch");

  // The result callback disposes the Work Item and returns the Participant to
  // Idle, not Available (Ch.13 §9) — still held by the open Capability
  // Fulfilment, just between Work Items now that it has actually done one.
  const completed = await completeWorkItem({ workItemId: result.workItemId, outcome: "done", reference: "vcs://participant-lifecycle/req-spec@1" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);

  const { data: after } = await participantsDB.findById(participant.id);
  assert.equal(after?.state, "Idle");
  assert.ok(received.includes("ParticipantIdle"), "expected Idle once the Work Item completed/disposed");
});

test("Build order step 4: replaceParticipant hands a Capability Fulfilment from Available straight to a new Participant", async () => {
  const { participant: oldParticipant, seuCapabilityId } = await commissionAndFulfil("participant-lifecycle-replace-available");
  assert.equal(oldParticipant.state, "Available");

  const received: string[] = [];
  eventBus.subscribe((event) => {
    if (event.originating_object_type === "Participant") received.push(event.event_type);
  });

  const result = await replaceParticipant({
    oldParticipantId: oldParticipant.id,
    newParticipantType: "Human",
    newDisplayName: "Participant lifecycle replacement analyst",
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : undefined);
  if (!result.ok) return;

  assert.equal(result.oldParticipant.state, "Archived");
  assert.equal(result.newParticipant.state, "Available");
  assert.notEqual(result.newParticipant.id, oldParticipant.id);

  const { data: activeFulfilment } = await capabilityFulfilmentsDB.findActiveBySeuCapabilityId(seuCapabilityId);
  assert.equal(activeFulfilment?.participant_id, result.newParticipant.id, "the Capability Fulfilment must now point at the new Participant");

  const { data: oldFulfilment } = await capabilityFulfilmentsDB.findActiveByParticipantId(oldParticipant.id);
  assert.equal(oldFulfilment, null, "the old Participant must have no active Capability Fulfilment left");

  assert.ok(received.includes("ParticipantReplaced"));
});

test("Build order step 4: replaceParticipant works from Executing, not just Idle — Ch.13 §13 'any Participant'", async () => {
  const { participant: oldParticipant, seuCapabilityId } = await commissionAndFulfil("participant-lifecycle-replace-executing");

  const toAssigned = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Assigned", actorRole: "super" });
  assert.equal(toAssigned.ok, true);
  const toExecuting = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Executing", actorRole: "super" });
  assert.equal(toExecuting.ok, true);
  const { data: midWork } = await participantsDB.findById(oldParticipant.id);
  assert.equal(midWork?.state, "Executing");

  const result = await replaceParticipant({
    oldParticipantId: oldParticipant.id,
    newParticipantType: "AI",
    newDisplayName: "Participant lifecycle replacement (mid-work)",
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result) : undefined);
  if (!result.ok) return;

  assert.equal(result.oldParticipant.state, "Archived", "Executing -> Released -> Archived, both real governed transitions");
  const { data: activeFulfilment } = await capabilityFulfilmentsDB.findActiveBySeuCapabilityId(seuCapabilityId);
  assert.equal(activeFulfilment?.participant_id, result.newParticipant.id);
});
