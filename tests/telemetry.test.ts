// Post-MVP Phase 7 (Engineering Telemetry: Ch.35) — automated coverage for
// what the Phase 7 audit checked by hand: Flow (Deliverable cycle time) and
// Governance (Quality Gate latency) metrics are real numbers derived from
// real Phase 3-6 activity, and a sustained pattern of Quality Gate blocking
// raises a real Organisational Learning Obligation (FR-35.8 / Ch.35 §11),
// exactly once, not once per blocked attempt. Run against the real dev
// database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { createObligation, transitionObligation } from "../src/routes/seu/core/obligations.js";
import { getFlowMetrics, getGovernanceMetrics } from "../src/routes/seu/core/telemetry.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates } from "./testFixtures.js";

// Ch.30 Event Bus redesign — publish() still persists every event
// synchronously (only dispatch/consumption is fire-and-forget), so querying
// the events table by payload after the fact reliably replaces the old
// eventBus.subscribe()-based live capture. QualityGate events' own
// originating_object_id is the gate's id, not the entity being evaluated,
// so this filters on the entityId the engine already records in payload.
async function qualityGateEventTypesForEntity(entityId: string): Promise<string[]> {
  const { rows } = await pool.query<{ event_type: string }>(
    "SELECT event_type FROM events WHERE originating_object_type = 'QualityGate' AND payload->>'entityId' = $1",
    [entityId]
  );
  return rows.map((r) => r.event_type);
}

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

async function commissionAndFulfilRequirementsSpec(statementPrefix: string) {
  const seuId = await commissionTestSeu(statementPrefix);
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);
  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Phase7 Test Analyst" });
  return { seuId, deliverableId: requirementsSpec.id };
}

test("Flow Telemetry: Deliverable cycle time is a real, non-negative number derived from real transitions", async () => {
  const { deliverableId } = await commissionAndFulfilRequirementsSpec("phase7-flow");
  const toInProgress = await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgress.ok, true);

  const flow = await getFlowMetrics();
  const entry = flow.deliverableCycleTimes.find((d) => d.id === deliverableId);
  assert.ok(entry, "expected the just-transitioned Deliverable to appear in Flow Telemetry");
  assert.ok(entry!.cycle_time_seconds >= 0, "cycle time must be a non-negative real number");
  assert.ok(flow.averageCycleTimeSeconds !== null && flow.averageCycleTimeSeconds >= 0);
});

test("Governance Telemetry: Quality Gate latency is zero on a first-try pass and positive after being blocked first", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("phase7-governance-latency");
  await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  // No Obligation attached — passes the "no_unresolved_obligations" gate on the first try.
  const firstTry = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(firstTry.ok, true, !firstTry.ok ? JSON.stringify(firstTry) : undefined);

  const governance = await getGovernanceMetrics();
  const entry = governance.qualityGateLatencies.find((g) => g.entity_id === deliverableId);
  assert.ok(entry, "expected the passed gate evaluation to appear in Governance Telemetry");
  assert.equal(entry?.first_blocked_at, null, "never blocked, so no first_blocked_at");
  assert.equal(entry?.latency_seconds, 0, "first-try pass means zero friction");

  // A second SEU, this time genuinely blocked once before passing.
  const { seuId: seuId2, deliverableId: deliverableId2 } = await commissionAndFulfilRequirementsSpec("phase7-governance-latency-blocked");
  await transitionDeliverable({ deliverableId: deliverableId2, targetState: "In Progress", actorRole: "super", actorId: "1" });
  const obligation = await createObligation({ seuId: seuId2, relatedObjectType: "Deliverable", relatedObjectId: deliverableId2, category: "Engineering", title: "Phase7 latency test obligation" });
  const blocked = await transitionDeliverable({ deliverableId: deliverableId2, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false);

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true);
  }
  const secondTry = await transitionDeliverable({ deliverableId: deliverableId2, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(secondTry.ok, true, !secondTry.ok ? JSON.stringify(secondTry) : undefined);

  const governanceAfter = await getGovernanceMetrics();
  const blockedEntry = governanceAfter.qualityGateLatencies.find((g) => g.entity_id === deliverableId2);
  assert.ok(blockedEntry?.first_blocked_at, "this one really was blocked before it passed");
  assert.ok(blockedEntry!.latency_seconds > 0, "friction must be reflected as positive latency");

  void seuId;
  void seuId2;
});

test("a sustained pattern of Quality Gate blocking raises exactly one Organisational Learning Obligation, not one per attempt (FR-35.8)", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("phase7-sustained-pattern");
  await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  const obligation = await createObligation({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Engineering", title: "Phase7 sustained-pattern blocker (left unresolved)" });

  // Attempt the same blocked transition repeatedly — the Obligation above is
  // deliberately never resolved, so every attempt blocks again.
  for (let i = 0; i < 4; i++) {
    const attempt = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
    assert.equal(attempt.ok, false);
  }

  const { data: obligationsAfter } = await obligationsDB.findBySeuId(seuId);
  const learningObligations = (obligationsAfter ?? []).filter((o) => o.category === "Organisational Learning");
  assert.equal(learningObligations.length, 1, "exactly one Organisational Learning Obligation, regardless of how many attempts crossed the threshold");
  assert.match(learningObligations[0]!.title, /Recurring friction/);
  assert.match(learningObligations[0]!.description ?? "", /qualityGateId:/);

  void obligation;
});

test("qualityGateEngine publishes QualityGateBlocked and QualityGatePassed on the event bus (Ch.26 §15)", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("phase7-quality-gate-events");
  await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });

  const obligation = await createObligation({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Engineering", title: "Phase7 event test obligation" });
  const blocked = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false);
  assert.ok((await qualityGateEventTypesForEntity(deliverableId)).includes("QualityGateBlocked"));

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: "1001" });
  }
  const passed = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(passed.ok, true);
  assert.ok((await qualityGateEventTypesForEntity(deliverableId)).includes("QualityGatePassed"));
});
