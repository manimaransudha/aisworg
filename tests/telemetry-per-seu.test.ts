// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Build order step 2 — per-SEU breakdown on the two existing
// categories. A filter on already-seu_id-carrying rows, not new data
// collection: proves a scoped call returns strictly the calling SEU's own
// rows, and the platform-wide call (no seuId) is unaffected.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { getFlowMetrics, getGovernanceMetrics } from "../src/routes/seu/core/telemetry.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionAndFulfilRequirementsSpec(statementPrefix: string) {
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
  const requirementsSpec = detail?.deliverables.find((d) => d.name === "Requirements Specification");
  const reqAnalysisCapability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(requirementsSpec && reqAnalysisCapability);
  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Per-SEU telemetry test analyst" });
  return { seuId, deliverableId: requirementsSpec.id };
}

test("Flow Telemetry scoped to one SEU returns strictly that SEU's own Deliverables, distinct from platform-wide pooling", async () => {
  const a = await commissionAndFulfilRequirementsSpec("telemetry-per-seu-a");
  const b = await commissionAndFulfilRequirementsSpec("telemetry-per-seu-b");

  const toInProgressA = await transitionDeliverable({ deliverableId: a.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgressA.ok, true);
  const toInProgressB = await transitionDeliverable({ deliverableId: b.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgressB.ok, true);

  const scopedToA = await getFlowMetrics(a.seuId);
  assert.ok(scopedToA.deliverableCycleTimes.some((d) => d.id === a.deliverableId));
  assert.ok(!scopedToA.deliverableCycleTimes.some((d) => d.id === b.deliverableId), "SEU A's scoped view must not include SEU B's Deliverable");
  assert.ok(scopedToA.deliverableCycleTimes.every((d) => d.seu_id === a.seuId));

  const scopedToB = await getFlowMetrics(b.seuId);
  assert.ok(scopedToB.deliverableCycleTimes.some((d) => d.id === b.deliverableId));
  assert.ok(!scopedToB.deliverableCycleTimes.some((d) => d.id === a.deliverableId), "SEU B's scoped view must not include SEU A's Deliverable");

  const platformWide = await getFlowMetrics();
  assert.ok(platformWide.deliverableCycleTimes.some((d) => d.id === a.deliverableId));
  assert.ok(platformWide.deliverableCycleTimes.some((d) => d.id === b.deliverableId));
});

test("Governance Telemetry scoped to one SEU excludes another SEU's Quality Gate evaluations", async () => {
  const a = await commissionAndFulfilRequirementsSpec("telemetry-per-seu-governance-a");
  const b = await commissionAndFulfilRequirementsSpec("telemetry-per-seu-governance-b");

  await transitionDeliverable({ deliverableId: a.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  const approvedA = await transitionDeliverable({ deliverableId: a.deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(approvedA.ok, true);

  await transitionDeliverable({ deliverableId: b.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  const approvedB = await transitionDeliverable({ deliverableId: b.deliverableId, targetState: "Approved", actorRole: "super", actorId: "1" });
  assert.equal(approvedB.ok, true);

  const scopedToA = await getGovernanceMetrics(a.seuId);
  assert.ok(scopedToA.qualityGateLatencies.every((row) => row.seu_id === a.seuId));
  assert.ok(!scopedToA.qualityGateLatencies.some((row) => row.seu_id === b.seuId));
});
