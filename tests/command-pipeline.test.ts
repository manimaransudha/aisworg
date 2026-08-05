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
import { executionEngine } from "../src/domain/engine/executionEngine.js";
import { eventBus } from "../src/domain/engine/eventBus.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
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
  if (dispatched.ok) assert.equal(dispatched.deliverable.lifecycle_state, "In Progress");
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
  assert.equal(result.command.status, "Completed");
});
