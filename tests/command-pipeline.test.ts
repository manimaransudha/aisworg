// Post-MVP Phase 3 (Command / Work Item / Dispatch Engine pipeline) —
// automated coverage for what the Phase 3 audit checked by hand: a Deliverable
// transition no longer applies directly. Governance (dependency + Authority/
// Policy) still gates first, then a Command is generated, a Work Item derived
// from it, and the Dispatch Engine must actually assign that Work Item to the
// Participant fulfilling the Deliverable's producing Capability before the
// state change lands — deferred, not silently applied, if nobody does yet.
// Run against the real dev database, no mocking.
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
import { executionEngine } from "../src/domain/engine/executionEngine.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("transitionDeliverable defers the transition when nobody fulfils the producing Capability yet, then dispatches once a Participant does", async () => {
  const seuId = await commissionTestSeu("phase3-defer");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  assert.ok(requirementsSpec, "expected a seeded Requirements Specification deliverable");
  assert.equal(requirementsSpec.lifecycleState, "Defined");

  const deferred = await transitionDeliverable({
    deliverableId: requirementsSpec.id,
    targetState: "In Progress",
    actorRole: "super",
    actorId: "1", // badge model (Phase 10): "1" holds root (012_badge_model.sql), matching the pre-existing dev/test-identity convention
  });
  assert.equal(deferred.ok, false);
  if (!deferred.ok) assert.equal(deferred.reason, "dispatch_deferred", "governance passed (no dependencies, authorised role) — only Dispatch should block this");

  const stillDefined = await getSeuDetailView(seuId);
  assert.equal(stillDefined?.deliverables.find((d) => d.name === "Requirements Specification")?.lifecycleState, "Defined", "Deliverable must not move state while dispatch is deferred");

  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(reqAnalysisCapability);
  await fulfilCapability({
    seuId,
    capabilityId: reqAnalysisCapability.capabilityId,
    participantType: "AI",
    displayName: "Phase3 Test Analyst",
  });

  const dispatched = await transitionDeliverable({
    deliverableId: requirementsSpec.id,
    targetState: "In Progress",
    actorRole: "super",
    actorId: "1",
  });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");

  // Model A (Participant Integration Plan): dispatch does NOT move the
  // Deliverable — it stays Defined, outstanding, until the Participant reports
  // a result.
  const stillDefinedAfterDispatch = await getSeuDetailView(seuId);
  assert.equal(stillDefinedAfterDispatch?.deliverables.find((d) => d.name === "Requirements Specification")?.lifecycleState, "Defined", "dispatched, not yet applied — the transition waits for the result callback");

  const completed = await completeWorkItem({ workItemId: dispatched.workItemId, outcome: "done", reference: "vcs://phase3-defer/req-spec@abc123" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);

  const moved = await getSeuDetailView(seuId);
  assert.equal(moved?.deliverables.find((d) => d.name === "Requirements Specification")?.lifecycleState, "In Progress", "the result callback drives the governed transition");
});

test("a dispatched transition leaves a traceable Command and a Completed/Disposed Work Item assigned to the fulfilling Participant", async () => {
  const seuId = await commissionTestSeu("phase3-trace");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  await fulfilCapability({
    seuId,
    capabilityId: reqAnalysisCapability.capabilityId,
    participantType: "Human",
    displayName: "Phase3 Trace Analyst",
  });

  const result = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");

  // Outstanding first: Model A leaves the Command and Work Item Dispatched
  // (waiting for the result callback), not Completed.
  const outstanding = await getSeuDetailView(seuId);
  assert.equal(outstanding?.commands.length, 1, "expected exactly one Command for the one dispatched transition");
  assert.equal(outstanding?.commands[0]?.status, "Dispatched", "Model A: the Command is Dispatched-and-outstanding until the result lands");
  assert.equal(outstanding?.commands[0]?.workItems[0]?.status, "Dispatched", "the Work Item waits Dispatched for the Participant's result");

  // The result callback drives it to Completed/Disposed.
  const completed = await completeWorkItem({ workItemId: result.workItemId, outcome: "done", reference: "vcs://phase3-trace/req-spec@def456" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);

  const after1 = await getSeuDetailView(seuId);
  assert.equal(after1?.commands.length, 1, "expected exactly one Command for the one dispatched transition");
  const command = after1?.commands[0];
  assert.equal(command?.fromState, "Defined");
  assert.equal(command?.toState, "In Progress");
  assert.equal(command?.status, "Completed");
  assert.equal(command?.entityLabel, "Requirements Specification");

  assert.equal(command?.workItems.length, 1, "Ch.32 FR-32.1: exactly one Work Item per Command in this MVP instance");
  const workItem = command?.workItems[0];
  assert.equal(workItem?.status, "Disposed", "Ch.32 §13: a completed Work Item is disposed");
  assert.equal(workItem?.participantLabel, "Phase3 Trace Analyst (Human)");
  assert.equal(workItem?.dispatchStrategy, "sole-eligible-participant");
});

test("executionEngine defers dispatch when no Participant fulfils the producing Capability, and reports the reason", async () => {
  const seuId = await commissionTestSeu("phase3-engine");
  const detail = await getSeuDetailView(seuId);
  const architectureCapability = detail?.capabilities.find((c) => c.code === "architecture");
  assert.ok(architectureCapability);

  const result = await executionEngine.execute({
    seuId,
    entityType: "Deliverable",
    entityId: randomUUID(),
    fromState: "Defined",
    toState: "In Progress",
    producingCapabilityId: architectureCapability.capabilityId,
    requestedBy: null,
    correlationId: eventBus.newCorrelationId(),
  });

  assert.equal(result.dispatched, false);
  assert.equal(result.deferredReason, "no_eligible_participant");
  assert.equal(result.command.status, "Deferred");
});

test("executionEngine dispatches immediately when the entity has no producing Capability declared at all", async () => {
  const seuId = await commissionTestSeu("phase3-no-capability");

  const result = await executionEngine.execute({
    seuId,
    entityType: "Deliverable",
    entityId: randomUUID(),
    fromState: "Defined",
    toState: "In Progress",
    producingCapabilityId: null,
    requestedBy: null,
    correlationId: eventBus.newCorrelationId(),
  });

  assert.equal(result.dispatched, true, "nothing declared to gate dispatch on, so it must not defer forever");
  assert.equal(result.participantId, undefined);
  assert.equal(result.command.status, "Dispatched", "Model A: dispatched-and-outstanding, Completed only lands on the result callback");
});

// Participant Integration & Attestation — Plan step 1 (Model A): the `blocked`/
// `failed` result path. A Participant that could not complete the Work Item
// reports the outcome, and the platform must NOT apply the governed transition,
// must fail the Work Item and Command, and must raise a single Attention Item —
// exactly the "cannot automatically continue" case (Ch.34).
test("a Participant reporting 'blocked' fails the Work Item without applying the transition, and raises an Attention Item", async () => {
  const seuId = await commissionTestSeu("phase3-blocked");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Phase3 Blocked Analyst" });

  const dispatched = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true, !dispatched.ok ? JSON.stringify(dispatched) : undefined);
  if (!dispatched.ok) throw new Error("unreachable");

  const completed = await completeWorkItem({ workItemId: dispatched.workItemId, outcome: "blocked", reference: "vcs://phase3-blocked/partial@wip" });
  assert.equal(completed.ok, true, !completed.ok ? JSON.stringify(completed) : undefined);
  if (!completed.ok) throw new Error("unreachable");
  assert.equal(completed.outcome, "blocked");

  // The Deliverable must NOT have moved.
  const after = await getSeuDetailView(seuId);
  assert.equal(after?.deliverables.find((d) => d.name === "Requirements Specification")?.lifecycleState, "Defined", "a blocked result must never apply the transition");

  // Work Item Failed, Command Failed, but the raw reference is still stored.
  const { data: workItem } = await workItemsDB.findById(dispatched.workItemId);
  assert.equal(workItem?.status, "Failed");
  assert.equal(workItem?.output_reference, "vcs://phase3-blocked/partial@wip", "candidate output is stored even on a blocked outcome");
  const { data: command } = await commandsDB.findById(workItem!.command_id);
  assert.equal(command?.status, "Failed");

  // Exactly one Exception Attention Item, deduplicated per (SEU, Deliverable).
  const { data: openException } = await attentionItemsDB.findOpenByRelatedObject(seuId, "Exception", "Deliverable", requirementsSpec.id);
  assert.ok(openException, "expected an open Exception Attention Item for the blocked Deliverable");
});

test("completeWorkItem is idempotent-safe: a second result on an already-completed Work Item is rejected, not re-applied", async () => {
  const seuId = await commissionTestSeu("phase3-double");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Phase3 Double Analyst" });

  const dispatched = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(dispatched.ok, true);
  if (!dispatched.ok) throw new Error("unreachable");

  const first = await completeWorkItem({ workItemId: dispatched.workItemId, outcome: "done", reference: "vcs://phase3-double/req-spec@1" });
  assert.equal(first.ok, true);

  const second = await completeWorkItem({ workItemId: dispatched.workItemId, outcome: "done", reference: "vcs://phase3-double/req-spec@2" });
  assert.equal(second.ok, false, "a Work Item that is no longer outstanding must not be completed again");
  if (!second.ok) assert.equal(second.reason, "not_outstanding");

  const unknown = await completeWorkItem({ workItemId: randomUUID(), outcome: "done" });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.reason, "not_found");
});
