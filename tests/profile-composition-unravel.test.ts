// Unravel a Profile's full composition on Commissioning Validation, and
// detect real cross-source conflicts — src/domain/engine/profileCompositionUnravel.ts.
// Owner: "Seed test data as required. if i say test case, obviously you have
// to add data." Checked directly before writing this: no real seed Pack
// overrides serviceLevel, declares an incompatible dependency, or adopts any
// canonical Policy at all — so every scenario below needs a dedicated,
// uniquely-coded fixture Pack/Template/Profile, built straight off the DB
// layer (packsDB/policiesDB/checklistsDB/templatesDB/profilesDB), the same
// way tests/testFixtures.ts and tests/cr088-filter-shaped-overrides.test.ts
// build their own — never the production seed pipeline (db:clean-slate
// stays untouched).
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { unravelComposition, detectCompositionConflicts } from "../src/domain/engine/profileCompositionUnravel.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import type { PackContributions } from "../src/dblayer/seuTypes.js";

// Bug fix, found by running this file: packsDB.create() always inserts as
// Draft (hardcoded in its own INSERT) — but unravelComposition resolves
// every Pack via packsDB.findActiveByCode (matching compositionEngine.ts's
// own resolveActivePack, and the real commissioning path), which finds
// nothing for a Draft row. The CR-088 fixture never hit this because it only
// looked up Policies/Checklists by pack code directly (policiesDB/
// checklistsDB.findByPackCode, no status filter) — never the Pack row
// itself. packsDB.updateStatus is the plain, ungoverned DB-layer flip to
// Active — no badge/actor/transition machinery needed for a test fixture.
async function createPack(input: { contributions?: PackContributions; dependencies?: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }> }): Promise<string> {
  const code = `test-unravel-pack-${randomUUID()}`;
  const { data: pack, error } = await packsDB.create({
    code,
    name: `Fixture Pack ${code}`,
    category: "Engineering",
    packVersion: "1.0.0",
    installationClassification: "Optional",
    contributions: input.contributions ?? {},
    dependencies: input.dependencies ?? [],
  });
  assert.ok(!error && pack, error?.message);
  const { error: activateError } = await packsDB.updateStatus(pack!.id, "Active");
  assert.ok(!activateError, activateError?.message);
  return pack!.code;
}

async function createTemplateAndProfile(mandatoryPackCodes: string[]): Promise<{ templateId: string; profileId: string }> {
  const templateCode = `test-unravel-template-${randomUUID()}`;
  const { data: template, error: templateError } = await templatesDB.upsert({ code: templateCode, name: "Fixture Template", deliverableCatalogue: [] });
  assert.ok(!templateError && template, templateError?.message);
  await templatesDB.setMandatoryPacks(template!.id, mandatoryPackCodes);

  const profileCode = `test-unravel-profile-${randomUUID()}`;
  const { data: profile, error: profileError } = await profilesDB.upsert({ code: profileCode, name: "Fixture Profile", baseTemplateId: template!.id, environment: "development" });
  assert.ok(!profileError && profile, profileError?.message);

  return { templateId: template!.id, profileId: profile!.id };
}

test("Service Level conflict: two Packs adopt the same Service with a different override target, reported at the precise nested path", async () => {
  const packA = await createPack({ contributions: { services: [{ code: "code-review-service", serviceLevel: [{ code: "coverage", target: 80 }] }] } });
  const packB = await createPack({ contributions: { services: [{ code: "code-review-service", serviceLevel: [{ code: "coverage", target: 90 }] }] } });
  const { templateId, profileId } = await createTemplateAndProfile([packA, packB]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  const found = conflicts.find((c) => c.propertyName === "code-review-service.serviceLevel[code=coverage].target");
  assert.ok(found, `expected the target disagreement at the precise nested path, got: ${JSON.stringify(conflicts.map((c) => c.propertyName))}`);
  assert.equal(found!.options.length, 2);
  assert.equal(found!.hasAction, true);
  const values = found!.options.map((o) => o.value).sort();
  assert.deepEqual(values, [80, 90]);
});

test("Authority Rule: one Pack legitimately assigning several different roles to the same governedTransition is NOT a conflict", async () => {
  // Regression for a real bug found on review: core-engineering's own real
  // "knowledgescope.transition" -> general/power/super (confirmed live) is
  // deliberate, single-Pack multiplicity — detectGovernanceConflicts itself
  // already treats this as fine by aggregating roles per Pack first.
  const pack = await createPack({
    contributions: {
      authorityRules: [
        { code: "r1", governedTransition: "knowledgescope.transition", authorisedRole: "general" },
        { code: "r2", governedTransition: "knowledgescope.transition", authorisedRole: "power" },
        { code: "r3", governedTransition: "knowledgescope.transition", authorisedRole: "super" },
      ],
    },
  });
  const { templateId, profileId } = await createTemplateAndProfile([pack]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  assert.equal(conflicts.filter((c) => c.propertyName.indexOf("authorityRule::knowledgescope.transition") === 0).length, 0, "one Pack's own multi-role design must never be reported as a conflict");

  const entry = unraveled.pool.find((e) => e.propertyName === "authorityRule::knowledgescope.transition");
  assert.ok(entry);
  assert.deepEqual(entry!.value, { governedTransition: "knowledgescope.transition", authorisedRoles: ["general", "power", "super"] });
});

test("Authority Rule conflict: two DIFFERENT Packs assigning different role-sets to the same governedTransition IS a conflict", async () => {
  const packA = await createPack({ contributions: { authorityRules: [{ code: "r1", governedTransition: "fixture.transition", authorisedRole: "general" }] } });
  const packB = await createPack({ contributions: { authorityRules: [{ code: "r1", governedTransition: "fixture.transition", authorisedRole: "power" }] } });
  const { templateId, profileId } = await createTemplateAndProfile([packA, packB]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  const found = conflicts.find((c) => c.propertyName.indexOf("authorityRule::fixture.transition") === 0);
  assert.ok(found, `expected a genuine cross-Pack role disagreement to be reported, got: ${JSON.stringify(conflicts.map((c) => c.propertyName))}`);
});

test("Review Gate conflict: two Packs declare a gate on the same (code, governedTransition) with different checklistIds", async () => {
  const packA = await createPack({ contributions: { reviewGates: [{ code: "adr-review", name: "ADR Review A", governedTransition: "Deliverable|In Progress|Approved", checklistIds: ["checklist-a"] }] } });
  const packB = await createPack({ contributions: { reviewGates: [{ code: "adr-review", name: "ADR Review B", governedTransition: "Deliverable|In Progress|Approved", checklistIds: ["checklist-b"] }] } });
  const { templateId, profileId } = await createTemplateAndProfile([packA, packB]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  const found = conflicts.find((c) => c.propertyName.indexOf("reviewGate::adr-review::Deliverable|In Progress|Approved") === 0);
  assert.ok(found, `expected a reviewGate conflict, got: ${JSON.stringify(conflicts.map((c) => c.propertyName))}`);
  assert.equal(found!.hasAction, true);
});

test("Policies are informational, never a conflict — different constraintTypes on the same governed transition is normal, additive configuration", async () => {
  // Regression for a real design mistake found on review: Policies were
  // originally grouped by governedTransition and a differing constraintType
  // was flagged as a conflict. Owner: "two policies do not have to agree on
  // constraintType at all. Quality gate handles both constraint types." Each
  // adopted Policy is a fully independent rule; a transition can carry
  // several at once (some Standard, some Policy) with nothing to disagree
  // on. Real, already-seeded canonical policies, both landing on the same
  // governed transition today (CR-089: every one of the 34 canonical
  // policies with empty applicability derives to the same edge) — adopted
  // directly via policiesDB.upsert, same as
  // tests/cr088-filter-shaped-overrides.test.ts's own fixture pattern.
  const packA = await createPack({});
  const packB = await createPack({});
  const governedTransition = "Deliverable|Approved|Baselined";
  const { error: err1 } = await policiesDB.upsert({ code: "adr-required", name: "ADR Required (fixture adoption A)", governedTransition, originatingPackId: (await packsDB.findByCode(packA)).data!.id });
  assert.ok(!err1, err1?.message);
  const { error: err2 } = await policiesDB.upsert({ code: "coding-standards", name: "Coding Standards (fixture adoption B)", governedTransition, originatingPackId: (await packsDB.findByCode(packB)).data!.id });
  assert.ok(!err2, err2?.message);
  const { templateId, profileId } = await createTemplateAndProfile([packA, packB]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  assert.equal(conflicts.filter((c) => c.propertyName.indexOf("policy::") === 0).length, 0, "different Policy codes must never be reported as conflicting with each other");

  const adr = unraveled.pool.find((e) => e.propertyName === "policy::adr-required");
  const coding = unraveled.pool.find((e) => e.propertyName === "policy::coding-standards");
  assert.ok(adr && coding, "both adopted Policies should appear in the pool, independently, keyed by their own code");
});

test("Pack Dependency: a required dependency on a Pack code NOT in the composed set is reported; satisfied when it is", async () => {
  const targetCode = `test-unravel-target-${randomUUID()}`;
  const { data: targetPack } = await packsDB.create({ code: targetCode, name: "Fixture target Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} });
  assert.ok(targetPack);
  await packsDB.updateStatus(targetPack!.id, "Active");

  const dependentA = await createPack({ dependencies: [{ packCode: targetCode, version: "1.0.0", type: "required" }] });
  const { templateId: templateMissing, profileId: profileMissing } = await createTemplateAndProfile([dependentA]);
  const unraveledMissing = await unravelComposition({ templateIds: [templateMissing], profileIds: [profileMissing] }, PLATFORM_TENANT_ID);
  const conflictsMissing = detectCompositionConflicts(unraveledMissing);
  const missingViolation = conflictsMissing.find((c) => c.propertyName === targetCode);
  assert.ok(missingViolation, "expected the unsatisfied required dependency to be reported");
  assert.equal(missingViolation!.hasAction, false, "a Pack Dependency violation has no field a composition strategy could reconcile");

  const dependentB = await createPack({ dependencies: [{ packCode: targetCode, version: "1.0.0", type: "required" }] });
  const { templateId: templateSatisfied, profileId: profileSatisfied } = await createTemplateAndProfile([dependentB, targetCode]);
  const unraveledSatisfied = await unravelComposition({ templateIds: [templateSatisfied], profileIds: [profileSatisfied] }, PLATFORM_TENANT_ID);
  const conflictsSatisfied = detectCompositionConflicts(unraveledSatisfied);
  assert.ok(!conflictsSatisfied.some((c) => c.propertyName === targetCode), "a satisfied required dependency must not be reported");
});

test("Pack Dependency: an incompatible dependency on a Pack that IS in the composed set is reported", async () => {
  const targetCode = `test-unravel-incompatible-target-${randomUUID()}`;
  const { data: incompatibleTarget } = await packsDB.create({ code: targetCode, name: "Fixture incompatible target", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} });
  await packsDB.updateStatus(incompatibleTarget!.id, "Active");
  const dependent = await createPack({ dependencies: [{ packCode: targetCode, version: "1.0.0", type: "incompatible" }] });
  const { templateId, profileId } = await createTemplateAndProfile([dependent, targetCode]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  const found = conflicts.find((c) => c.propertyName === targetCode);
  assert.ok(found, "expected the incompatible-and-present dependency to be reported");
  assert.equal(found!.hasAction, false);
});

test("A clean selection (no fixture disagreement) reports no conflicts, and the pool contains real, expected entries", async () => {
  const pack = await createPack({ contributions: { capabilities: [{ code: "fixture-clean-capability" }], services: [{ code: "fixture-clean-service", serviceLevel: [{ code: "metric", target: 42 }] }] } });
  const { templateId, profileId } = await createTemplateAndProfile([pack]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  assert.equal(conflicts.filter((c) => c.propertyName === "fixture-clean-capability" || c.propertyName === "fixture-clean-service").length, 0);

  const capEntry = unraveled.pool.find((e) => e.propertyName === "fixture-clean-capability");
  assert.ok(capEntry, "expected the Capability to appear in the pool");
  assert.equal(capEntry!.source.kind, "pack");
  assert.equal(capEntry!.source.code, pack);

  const svcEntry = unraveled.pool.find((e) => e.propertyName === "fixture-clean-service");
  assert.ok(svcEntry, "expected the Service to appear in the pool");
  assert.deepEqual(svcEntry!.value, { code: "fixture-clean-service", serviceLevel: [{ code: "metric", target: 42 }] });
});

test("Resolved conflicts (owner's own picks from a prior round) are excluded, not re-flagged", async () => {
  const packA = await createPack({ contributions: { services: [{ code: "resolve-me-service", serviceLevel: [{ code: "m", target: 1 }] }] } });
  const packB = await createPack({ contributions: { services: [{ code: "resolve-me-service", serviceLevel: [{ code: "m", target: 2 }] }] } });
  const { templateId, profileId } = await createTemplateAndProfile([packA, packB]);

  const unraveled = await unravelComposition({ templateIds: [templateId], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const before = detectCompositionConflicts(unraveled);
  const path = "resolve-me-service.serviceLevel[code=m].target";
  assert.ok(before.some((c) => c.propertyName === path));

  const after1 = detectCompositionConflicts(unraveled, { [path]: 1 });
  assert.ok(!after1.some((c) => c.propertyName === path), "a resolved conflict must not be re-flagged");
});
