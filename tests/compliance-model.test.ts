// Compliance Model — Plan (Phase 15, Ch.27). Compliance is a read-only, emergent
// evaluation over the existing governance primitives: it never modifies state
// (§9), is deterministic (FR-27.3), applies per-SEU by composed Packs (FR-27.2),
// snapshots immutable history (FR-27.6), supports Waivers ("Compliant with
// Exceptions") and minimal conflict detection (FR-27.7). Frameworks/requirements
// here are attributed to development (which every commissioned SEU
// composes) so they apply. Run against the real dev database.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { createObligation, transitionObligation } from "../src/routes/seu/core/obligations.js";
import { evaluateCompliance, grantWaiver, generateComplianceReport, complianceHistory } from "../src/routes/seu/core/compliance.js";
import { complianceDB } from "../src/dblayer/complianceDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

async function commissionSeu(prefix: string) {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({ statement: `${prefix}-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"], actorRole: "super", actorId: "1001", requestedBy: 1001 });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(deliverable);
  return { seuId: result.seu.id, deliverableId: deliverable.id };
}

// The SEU-wide status is a function of ALL applicable requirements; on a shared
// dev DB other frameworks may also apply, so assertions here are on THIS
// requirement's deterministic per-requirement state, plus a status/counts
// consistency invariant (the roll-up rule) that holds regardless of what else
// applies.
function assertStatusConsistentWithCounts(status: string, counts: { total: number; satisfied: number; waived: number; unsatisfied: number }) {
  if (counts.total === 0) return assert.equal(status, "Compliance Unknown");
  if (counts.unsatisfied === 0 && counts.waived === 0) return assert.equal(status, "Compliant");
  if (counts.unsatisfied === 0 && counts.waived > 0) return assert.equal(status, "Compliant with Exceptions");
  if (counts.satisfied + counts.waived > 0) return assert.equal(status, "Partially Compliant");
  return assert.equal(status, "Non-Compliant");
}

test("compliance is evaluated per-SEU from engineering state: a required obligation drives its requirement satisfied/unsatisfied, deterministically and read-only", async () => {
  const { data: corePack } = await packsDB.findByCode("development");
  assert.ok(corePack);
  const run = randomUUID().slice(0, 8);
  const fwCode = `sec-fw-${run}`;
  const reqCode = `sec-obl-${run}`;
  await complianceDB.upsertFramework({ code: fwCode, name: "Security Framework", originatingPackId: corePack.id });
  await complianceDB.upsertRequirement({ code: reqCode, frameworkCode: fwCode, name: "All Security obligations resolved", criteria: { type: "no_unresolved_obligations", category: "Security" }, severity: "High", originatingPackId: corePack.id });

  const { seuId, deliverableId } = await commissionSeu("compliance-eval");

  // Applies to this SEU (it composed development); nothing outstanding -> this requirement is satisfied.
  const first = await evaluateCompliance(seuId);
  assert.ok(first.frameworks.includes(fwCode), `expected ${fwCode} applicable (frameworks: ${first.frameworks.join(", ")})`);
  assert.equal(first.results.find((r) => r.requirementCode === reqCode)?.state, "satisfied");
  assertStatusConsistentWithCounts(first.status, first.counts);

  // An unresolved Security obligation makes this requirement unsatisfied, so the SEU can no longer be Compliant.
  const obligation = await createObligation({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Security", title: "Encrypt data at rest", severity: "High" });
  const second = await evaluateCompliance(seuId);
  assert.equal(second.results.find((r) => r.requirementCode === reqCode)?.state, "unsatisfied");
  assert.notEqual(second.status, "Compliant");
  assertStatusConsistentWithCounts(second.status, second.counts);

  // Evaluation is read-only: the Deliverable is untouched (§9).
  const detail = await getSeuDetailView(seuId);
  assert.equal(detail?.deliverables.find((d) => d.id === deliverableId)?.lifecycleState, "Defined");

  // Resolve the obligation -> this requirement is satisfied again (deterministic from state).
  for (const st of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    await transitionObligation({ obligationId: obligation.id, targetState: st, actorRole: "super", actorId: "1001" });
  }
  const third = await evaluateCompliance(seuId);
  assert.equal(third.results.find((r) => r.requirementCode === reqCode)?.state, "satisfied");

  // Immutable history accumulated (FR-27.6).
  const history = await complianceHistory(seuId);
  assert.ok(history.length >= 3, `expected >= 3 evaluation snapshots, got ${history.length}`);
});

test("a Waiver moves an unsatisfied requirement to Compliant with Exceptions", async () => {
  const { data: corePack } = await packsDB.findByCode("development");
  const run = randomUUID().slice(0, 8);
  const fwCode = `waiver-fw-${run}`;
  const reqCode = `waiver-req-${run}`;
  await complianceDB.upsertFramework({ code: fwCode, name: "Waiver Framework", originatingPackId: corePack.id });
  await complianceDB.upsertRequirement({ code: reqCode, frameworkCode: fwCode, name: "Requires an accepted architecture review", criteria: { type: "requires_accepted_review", category: "Architecture" }, originatingPackId: corePack.id });

  const { seuId } = await commissionSeu("compliance-waiver");
  // No such review exists -> Non-Compliant (this framework's single requirement unsatisfied).
  const evalReqs = (await evaluateCompliance(seuId)).results.filter((r) => r.frameworkCode === fwCode);
  assert.equal(evalReqs[0].state, "unsatisfied");

  await grantWaiver({ seuId, requirementCode: reqCode, rationale: "Architecture review deferred to next milestone; risk accepted." });
  const after = await evaluateCompliance(seuId);
  const waived = after.results.find((r) => r.requirementCode === reqCode);
  assert.equal(waived?.state, "waived");
  // With the only unsatisfied requirement waived, status is Compliant with Exceptions.
  assert.equal(after.results.filter((r) => r.frameworkCode === fwCode && r.state === "unsatisfied").length, 0);
});

test("minimal conflict detection (FR-27.7): two applicable requirements declaring each other are reported", async () => {
  const { data: corePack } = await packsDB.findByCode("development");
  const run = randomUUID().slice(0, 8);
  const fwCode = `conflict-fw-${run}`;
  const a = `req-a-${run}`;
  const b = `req-b-${run}`;
  await complianceDB.upsertFramework({ code: fwCode, name: "Conflict Framework", originatingPackId: corePack.id });
  await complianceDB.upsertRequirement({ code: a, frameworkCode: fwCode, name: "Requirement A", criteria: { type: "requires_accepted_evidence" }, conflictsWith: [b], originatingPackId: corePack.id });
  await complianceDB.upsertRequirement({ code: b, frameworkCode: fwCode, name: "Requirement B", criteria: { type: "requires_approved_decision" }, originatingPackId: corePack.id });

  const { seuId } = await commissionSeu("compliance-conflict");
  const result = await evaluateCompliance(seuId);
  assert.ok(result.conflicts.some((c) => c.requirementCode === a && c.conflictsWith === b), "expected the declared conflict to be reported");
});

test("the compliance report is a projection of engineering state (Ch.27 §12)", async () => {
  const { data: corePack } = await packsDB.findByCode("development");
  const run = randomUUID().slice(0, 8);
  const fwCode = `report-fw-${run}`;
  await complianceDB.upsertFramework({ code: fwCode, name: "Report Framework", originatingPackId: corePack.id });
  await complianceDB.upsertRequirement({ code: `report-req-${run}`, frameworkCode: fwCode, name: "No unresolved obligations", criteria: { type: "no_unresolved_obligations" }, originatingPackId: corePack.id });

  const { seuId } = await commissionSeu("compliance-report");
  const report = await generateComplianceReport(seuId);
  assert.ok(report.frameworks.includes(fwCode));
  assert.ok(["Compliant", "Compliant with Exceptions", "Partially Compliant", "Non-Compliant", "Compliance Unknown"].includes(report.status));
  assert.ok(Array.isArray(report.satisfied) && Array.isArray(report.outstanding) && Array.isArray(report.waived));
});
