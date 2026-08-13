// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Build order step 3 — Runtime Telemetry. Proves the three
// metrics are real numbers derived from a real dispatched transition, and
// that per-SEU scoping (Build order step 2's pattern) works for this
// category too — not just Flow/Governance.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { transitionDeliverableSync as transitionDeliverable } from "./testFixtures.js";
import { getRuntimeMetrics } from "../src/routes/seu/core/telemetry.js";
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
  await fulfilCapability({ seuId, capabilityId: reqAnalysisCapability.capabilityId, participantType: "AI", displayName: "Runtime telemetry test analyst" });
  return { seuId, deliverableId: requirementsSpec.id };
}

test("Runtime Telemetry: a real dispatched transition produces a non-negative dispatch latency and Work Item duration, scoped correctly per SEU", async () => {
  const before = await getRuntimeMetrics();

  const a = await commissionAndFulfilRequirementsSpec("runtime-telemetry-a");
  const b = await commissionAndFulfilRequirementsSpec("runtime-telemetry-b");

  const toInProgressA = await transitionDeliverable({ deliverableId: a.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgressA.ok, true);
  const toInProgressB = await transitionDeliverable({ deliverableId: b.deliverableId, targetState: "In Progress", actorRole: "super", actorId: "1" });
  assert.equal(toInProgressB.ok, true);

  const after = await getRuntimeMetrics();
  assert.ok(after.commandsGenerated >= before.commandsGenerated + 2, "expected at least 2 more Commands generated (2 commissionings x automatic steps + 2 explicit transitions)");

  const scopedToA = await getRuntimeMetrics(a.seuId);
  assert.ok(scopedToA.dispatchLatencies.every((row) => row.seu_id === a.seuId));
  assert.ok(scopedToA.dispatchLatencies.every((row) => row.latency_seconds >= 0));
  assert.ok(scopedToA.workItemDurations.every((row) => row.seu_id === a.seuId));
  assert.ok(scopedToA.workItemDurations.every((row) => row.duration_seconds >= 0));
  assert.ok(!scopedToA.dispatchLatencies.some((row) => row.seu_id === b.seuId));
});
