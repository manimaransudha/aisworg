// Post-MVP Phase 2 (Wire Service into the Dependency Engine) — automated
// coverage for what the Phase 2 audit checked by hand: a real commissioning
// run actually creates a Capability-type edge naming a Service (not just the
// isolated engine-level unit test in tests/engine.test.ts, which only proved
// the mechanism, never that commissioning uses it), that edge resolves
// Pending -> Satisfied against a real fulfilled Capability, and Service Level
// is readable. Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { fulfilCapability } from "../src/routes/seu/core/capabilities.js";
import { listServices } from "../src/routes/seu/core/services.js";
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

test("commissioning wires a named Capability-type edge alongside the Deliverable-type edge, and seeds the Source Code deliverable", async () => {
  const seuId = await commissionTestSeu("phase2-wiring");
  const detail = await getSeuDetailView(seuId);
  assert.ok(detail);

  assert.equal(detail.deliverables.length, 3, "expected Requirements Specification, Architecture Document and Source Code");
  const archDoc = detail.deliverables.find((d) => d.name === "Architecture Document");
  assert.ok(archDoc);

  const deliverableEdge = archDoc.dependencyEdges.find((e) => e.dependencyType === "Deliverable");
  const capabilityEdge = archDoc.dependencyEdges.find((e) => e.dependencyType === "Capability");
  assert.ok(deliverableEdge, "expected a Deliverable-type edge to Requirements Specification");
  assert.equal(deliverableEdge?.targetLabel, "Requirements Specification");
  assert.ok(capabilityEdge, "expected a Capability-type edge naming a Service");
  assert.ok(capabilityEdge?.targetLabel.startsWith("Service: "), `expected the Service to be named, got: ${capabilityEdge?.targetLabel}`);
  assert.equal(capabilityEdge?.readinessState, "Pending", "nobody has fulfilled requirements-analysis yet");

  const sourceCode = detail.deliverables.find((d) => d.name === "Source Code");
  assert.ok(sourceCode, "expected Source Code, produced by development, per the extended Template catalogue");
  assert.ok(sourceCode?.dependencyEdges.some((e) => e.dependencyType === "Capability" && e.targetLabel.includes("Approved Architecture")));
});

test("a Capability-type edge resolves Satisfied once the real SEU fulfils the upstream Capability", async () => {
  const seuId = await commissionTestSeu("phase2-fulfil");

  const before = await getSeuDetailView(seuId);
  const archDocBefore = before?.deliverables.find((d) => d.name === "Architecture Document");
  const capEdgeBefore = archDocBefore?.dependencyEdges.find((e) => e.dependencyType === "Capability");
  assert.equal(capEdgeBefore?.readinessState, "Pending");

  const reqAnalysisCapability = before?.capabilities.find((c) => c.code === "requirements-analysis");
  assert.ok(reqAnalysisCapability);
  await fulfilCapability({
    seuId,
    capabilityId: reqAnalysisCapability.capabilityId,
    participantType: "AI",
    displayName: "Phase2 Test Analyst",
  });

  const after1 = await getSeuDetailView(seuId);
  const archDocAfter = after1?.deliverables.find((d) => d.name === "Architecture Document");
  const capEdgeAfter = archDocAfter?.dependencyEdges.find((e) => e.dependencyType === "Capability");
  assert.equal(capEdgeAfter?.readinessState, "Satisfied");
});

test("listServices exposes each Service's declared Service Level and providing Capability (Ch.11 §7-§8)", async () => {
  const services = await listServices();
  const reqService = services.find((s) => s.name === "Approved Requirements Specification");
  assert.ok(reqService);
  assert.equal(reqService.providingCapabilityCode, "requirements-analysis");
  assert.ok(reqService.serviceLevel && typeof reqService.serviceLevel === "object");
  assert.ok("qualityBar" in reqService.serviceLevel, `expected a qualityBar key in Service Level, got: ${JSON.stringify(reqService.serviceLevel)}`);
});
