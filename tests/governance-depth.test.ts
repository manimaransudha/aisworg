// Post-MVP Phase 4 (Governance depth: Ch.22-26) — automated coverage for
// what the Phase 4 audit checked by hand: a Quality Gate blocks a real
// Deliverable transition until its criteria are met (Ch.26), an Obligation
// blocks that transition independently of the Dependency Engine (Ch.23 §11),
// the Obligation lifecycle itself runs through the same generic
// transitionEngine every other entity type uses (Ch.23 §9), and the
// Constraint Type distinction (Ch.24 — Policy blocks, Standard doesn't) that
// has existed since the original MVP schema but was never actually exercised
// by a test until now. Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable, ensureCoreEngineeringQualityGates } from "./testFixtures.js";
import { createObligation, transitionObligation } from "../src/routes/seu/core/obligations.js";
import { dependencyDefinitionEngine } from "../src/domain/engine/dependencyDefinitionEngine.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

// Walks an Obligation all the way to 'Verified' — the point Ch.23 §12 says
// governance stops caring, even though Closed/Archived remain further
// administrative steps.
async function verifyObligation(obligationId: string) {
  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const result = await transitionObligation({ obligationId, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(result.ok, true, !result.ok ? `obligation transition to ${targetState} failed: ${JSON.stringify(result)}` : undefined);
  }
}

test("Quality Gate blocks a Deliverable transition while an Obligation is unresolved, and allows it once Verified — independently of the Dependency Engine", async () => {
  await ensureCoreEngineeringQualityGates();
  const seuId = await commissionTestSeu("phase4-quality-gate");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);

  // Requirements Specification has no dependsOnDeliverableCodes/
  // dependsOnCapabilityServiceCodes in the seeded Template — confirm the
  // Dependency Engine has nothing to say here at all, so any block that
  // follows can only be the Quality Gate/Obligation, not the dependency graph.
  const readiness = await dependencyDefinitionEngine.isTargetReady(seuId, "Deliverable", "Requirements Specification", "In Progress");
  assert.equal(readiness.ready, true);
  assert.equal(readiness.rows.length, 0);

  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Phase4 Test Analyst" });

  const toInProgress = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgress.ok, true, !toInProgress.ok ? JSON.stringify(toInProgress) : undefined);

  const obligation = await createObligation({
    seuId,
    relatedObjectType: "Deliverable",
    relatedObjectId: requirementsSpec.id,
    category: "Security",
    title: "Phase4 test: outstanding security review",
    severity: "High",
  });
  assert.equal(obligation.status, "Identified");

  // Dependency Engine still has nothing to say — re-confirm right before the
  // blocked attempt, not just at the start.
  const readinessBeforeBlock = await dependencyDefinitionEngine.isTargetReady(seuId, "Deliverable", "Requirements Specification", "Approved");
  assert.equal(readinessBeforeBlock.ready, true);

  const blocked = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.reason, "quality_gate_blocked");
    if (blocked.reason === "quality_gate_blocked") {
      assert.match(blocked.detail, /Quality Gate "No Unresolved Obligations" blocked: 1 unresolved Obligation\(s\)/);
      assert.match(blocked.detail, new RegExp(obligation.title));
    }
  }

  await verifyObligation(obligation.id);

  const unblocked = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(unblocked.ok, true, !unblocked.ok ? JSON.stringify(unblocked) : undefined);
  if (unblocked.ok) assert.equal(unblocked.deliverable.lifecycle_state, "Approved");
});

test("Obligation lifecycle runs through the generic transitionEngine (Ch.23 §9) and rejects an undefined transition", async () => {
  const seuId = await commissionTestSeu("phase4-obligation-lifecycle");
  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  assert.ok(requirementsSpec);

  const obligation = await createObligation({ seuId, relatedObjectType: "Deliverable", relatedObjectId: requirementsSpec.id, category: "Compliance", title: "Phase4 test: lifecycle walk", severity: "Medium" });

  // Skipping straight from Identified to Assigned has no Transition Definition.
  const invalid = await transitionObligation({ obligationId: obligation.id, targetState: "Assigned", actorRole: "super", actorId: "1001" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "no_transition_definition");

  await verifyObligation(obligation.id);
  const toClosed = await transitionObligation({ obligationId: obligation.id, targetState: "Closed", actorRole: "super", actorId: "1001" });
  assert.equal(toClosed.ok, true);
  const toArchived = await transitionObligation({ obligationId: obligation.id, targetState: "Archived", actorRole: "super", actorId: "1001" });
  assert.equal(toArchived.ok, true);
  if (toArchived.ok) assert.equal(toArchived.obligation.status, "Archived");
});

test("Constraint Type (Ch.24): a Standard-type Policy violation doesn't block a transition, a Policy-type violation does", async () => {
  const unique = randomUUID();
  const standardTransition = `test.standard.${unique}`;
  const policyTransition = `test.policy.${unique}`;

  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack);

  // Both policies have a condition that can never be satisfied (context never
  // carries field "x") — the only variable under test is Constraint Type.
  const { data: standardPolicy } = await policiesDB.upsert({
    code: `test-standard-policy-${unique}`,
    name: "Test Standard policy (never satisfied)",
    category: "Engineering",
    constraintType: "Standard",
    governedTransition: standardTransition,
    condition: { type: "field_in", field: "x", values: ["never-matches"] },
    severity: "High",
    originatingPackId: pack.id,
  });
  const { data: blockingPolicy } = await policiesDB.upsert({
    code: `test-policy-blocking-${unique}`,
    name: "Test Policy (never satisfied)",
    category: "Engineering",
    constraintType: "Policy",
    governedTransition: policyTransition,
    condition: { type: "field_in", field: "x", values: ["never-matches"] },
    severity: "Low",
    originatingPackId: pack.id,
  });
  assert.ok(standardPolicy && blockingPolicy);

  await transitionDefinitionsDB.upsert({ entityType: "Deliverable", fromState: `StdFrom-${unique}`, toState: `StdTo-${unique}`, requiredPolicyIds: [standardPolicy.id] });
  await transitionDefinitionsDB.upsert({ entityType: "Deliverable", fromState: `PolFrom-${unique}`, toState: `PolTo-${unique}`, requiredPolicyIds: [blockingPolicy.id] });

  const standardOutcome = await transitionEngine.evaluate({ entityType: "Deliverable", fromState: `StdFrom-${unique}`, toState: `StdTo-${unique}`, actorRole: "general", context: {} });
  assert.equal(standardOutcome.allowed, true, "a Standard deviation must proceed, not block");

  const policyOutcome = await transitionEngine.evaluate({ entityType: "Deliverable", fromState: `PolFrom-${unique}`, toState: `PolTo-${unique}`, actorRole: "general", context: {} });
  assert.equal(policyOutcome.allowed, false, "a Policy (mandatory) violation must block");
  if (!policyOutcome.allowed) assert.equal(policyOutcome.reason, "policy_blocked");
});
