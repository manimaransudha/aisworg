// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Build order step 6 — Quality Telemetry, narrowed to rework
// rate and Deliverable acceptance rate. Proves both are real numbers
// derived from real Quality Gate evaluations / Deliverable states.
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
import { createEvidence, transitionEvidence } from "../src/routes/seu/core/evidence.js";
import { getQualityMetrics } from "../src/routes/seu/core/telemetry.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionAndFulfilRequirementsSpec(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const seuId = result.seu.id;

  const detail = await getSeuDetailView(seuId);
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);
  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Quality telemetry test analyst" });
  return { seuId, deliverableId: requirementsSpec.id };
}

test("Quality Telemetry: rework rate distinguishes a first-try pass from a genuinely blocked-then-passed Deliverable", async () => {
  const before = await getQualityMetrics();

  const clean = await commissionAndFulfilRequirementsSpec("quality-telemetry-clean");
  await transitionDeliverable({ deliverableId: clean.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  const cleanPass = await transitionDeliverable({ deliverableId: clean.deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(cleanPass.ok, true);

  const reworked = await commissionAndFulfilRequirementsSpec("quality-telemetry-reworked");
  await transitionDeliverable({ deliverableId: reworked.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  const obligation = await createObligation({ seuId: reworked.seuId, relatedObjectType: "Deliverable", relatedObjectId: reworked.deliverableId, category: "Engineering", title: "Quality telemetry rework test obligation" });
  const blocked = await transitionDeliverable({ deliverableId: reworked.deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(blocked.ok, false);
  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true);
  }
  const reworkedPass = await transitionDeliverable({ deliverableId: reworked.deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(reworkedPass.ok, true);

  const after = await getQualityMetrics();
  const cleanEntry = after.reworkEntities.find((r) => r.entity_id === clean.deliverableId);
  const reworkedEntry = after.reworkEntities.find((r) => r.entity_id === reworked.deliverableId);
  assert.ok(cleanEntry, "expected the first-try-pass Deliverable to appear");
  assert.equal(cleanEntry!.blocked_count, 0);
  assert.ok(reworkedEntry, "expected the blocked-then-passed Deliverable to appear");
  assert.ok(reworkedEntry!.blocked_count >= 1);
  assert.ok(after.totalEntitiesMeasured >= before.totalEntitiesMeasured + 2);
  assert.ok(after.reworkRate !== null && after.reworkRate >= 0 && after.reworkRate <= 1);
});

test("Quality Telemetry: Deliverable acceptance rate reflects the real lifecycle_state distribution, scoped correctly per SEU", async () => {
  const { seuId, deliverableId } = await commissionAndFulfilRequirementsSpec("quality-telemetry-acceptance");
  await transitionDeliverable({ deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  const approved = await transitionDeliverable({ deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(approved.ok, true);

  // Approved -> Baselined is gated by "Requires Accepted Evidence or
  // Approved Decision" — attach real, Accepted Evidence first.
  const evidence = await createEvidence({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Review", title: "Quality telemetry acceptance test evidence" });
  await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: "general", actorId: "1001" });
  await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: "general", actorId: "1001" });

  const baselined = await transitionDeliverable({ deliverableId, targetState: "Baselined", actorRole: "super", actorId: "1" });
  assert.equal(baselined.ok, true, !baselined.ok ? JSON.stringify(baselined) : undefined);

  // The Template's Deliverable Catalogue seeds more than just Requirements
  // Specification (Architecture Document, Source Code, ...) — only the one
  // this test explicitly transitions reaches Baselined, so acceptanceRate
  // is asserted as a real fraction of this SEU's total, not assumed to be 1.
  const scoped = await getQualityMetrics(seuId);
  assert.equal(scoped.byLifecycleState["Baselined"], 1, "exactly the one Deliverable this test transitioned reached Baselined");
  assert.ok(scoped.totalDeliverables >= 1);
  assert.equal(scoped.acceptanceRate, 1 / scoped.totalDeliverables);
});
