// Post-MVP Phase 2 (Wire Service into the Dependency Engine) — automated
// coverage for what the Phase 2 audit checked by hand: a real commissioning
// run actually creates the dependency graph the Template authored (not just
// the isolated engine-level unit test in tests/engine.test.ts, which only
// proved the mechanism, never that commissioning uses it), that a Deliverable-
// type edge resolves Pending -> Satisfied against a real SEU's own Deliverable
// progressing, and Service Level is readable.
// Rewritten (owner, 2026-09-06: "rewrite tests to assert the new
// Deliverable-only model instead") — this file used to prove Capability-type
// edges (naming a Service) alongside Deliverable-type ones. Capability-type
// edges were retired outright before this session (materialiseDependencyGraph.ts,
// owner, 2026-09-04: "there is no Capability-type edge... deliverable
// dependency is what is real") — a dependencyGraph entry with fromType
// "Capability" is now silently skipped at materialisation time. Every
// dependency edge a real commissioning run creates is Deliverable-type now;
// Service Level itself is still real and still readable (last test below),
// just no longer wired through a dependency edge of its own.
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { listServices } from "../src/routes/seu/core/services.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionTestSeu(statementPrefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("commissioning wires the Deliverable-type dependency graph, and seeds the Source Code deliverable", async () => {
  const seuId = await commissionTestSeu("phase2-wiring");
  const detail = await getSeuDetailView(seuId);
  assert.ok(detail);

  assert.equal(detail.deliverables.length, 3, "expected Requirements Analysis Model, Architecture Decision Record and Source Code");
  const archDoc = detail.deliverables.find((d) => d.name === "Architecture Decision Record");
  assert.ok(archDoc);

  const deliverableEdge = archDoc.dependencyEdges.find((e) => e.dependencyType === "Deliverable");
  assert.ok(deliverableEdge, "expected a Deliverable-type edge to Requirements Analysis Model");
  assert.equal(deliverableEdge?.targetLabel, "Requirements Analysis Model");
  assert.equal(deliverableEdge?.readinessState, "Pending", "Requirements Analysis Model hasn't reached Approved yet");
  assert.equal(archDoc.dependencyEdges.length, 1, "Capability-type edges are retired — only the one Deliverable-type edge gates this target now");

  const sourceCode = detail.deliverables.find((d) => d.name === "Source Code");
  assert.ok(sourceCode, "expected Source Code, produced by development, per the extended Template catalogue");
  const sourceCodeEdge = sourceCode?.dependencyEdges.find((e) => e.dependencyType === "Deliverable");
  assert.ok(sourceCodeEdge, "expected a Deliverable-type edge to Architecture Decision Record");
  assert.equal(sourceCodeEdge?.targetLabel, "Architecture Decision Record");
});

test("a Deliverable-type edge resolves Satisfied once the real SEU's upstream Deliverable reaches the required state", async () => {
  const seuId = await commissionTestSeu("phase2-fulfil");

  const before = await getSeuDetailView(seuId);
  const archDocBefore = before?.deliverables.find((d) => d.name === "Architecture Decision Record");
  const edgeBefore = archDocBefore?.dependencyEdges.find((e) => e.dependencyType === "Deliverable");
  assert.equal(edgeBefore?.readinessState, "Pending");

  const upstream = before?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(upstream);
  await deliverablesDB.updateLifecycleState(upstream!.id, "Approved");

  const after1 = await getSeuDetailView(seuId);
  const archDocAfter = after1?.deliverables.find((d) => d.name === "Architecture Decision Record");
  const edgeAfter = archDocAfter?.dependencyEdges.find((e) => e.dependencyType === "Deliverable");
  assert.equal(edgeAfter?.readinessState, "Satisfied");
});

test("listServices exposes each Service's declared Service Level and providing Capability (Ch.11 §7-§8)", async () => {
  const services = await listServices();
  // Bug fix (owner: "check service-dependency.test.ts as well") — this
  // Service was renamed to "Domain Model Service" at some point (a seed-data
  // rename, unrelated to the Capability-edge retirement above); "Approved
  // Catalog Metadata Design" no longer exists under any name.
  const domainModelService = services.find((s) => s.name === "Domain Model Service");
  assert.ok(domainModelService);
  assert.equal(domainModelService.providingCapabilityCode, "understanding-business-domain");
  // CR-064 — service_level is a {label, target}[] list, not a flat object.
  assert.ok(Array.isArray(domainModelService.serviceLevel) && domainModelService.serviceLevel.length > 0);
  assert.ok(
    domainModelService.serviceLevel.some((item) => item.label === "Consistency"),
    `expected a "Consistency" entry in Service Level, got: ${JSON.stringify(domainModelService.serviceLevel)}`
  );
});
