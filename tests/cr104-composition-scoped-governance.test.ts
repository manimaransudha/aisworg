// CR-104 — before this, qualityGateEngine.evaluate() matched Quality Gates
// by a bare (entity_type, from_state, to_state) triple against the GLOBAL
// quality_gates table: a Pack contributing a gate on that transition applied
// to every SEU platform-wide, regardless of whether that SEU's own EBM
// actually composed the Pack. Policy had no live lookup at all. Both are now
// materialised onto the EBM once, at creation (compositionCompleted.ts),
// from the composed Packs' own originating_pack_id
// (seuCompositionScope.ts's resolveOwningScope). This file is the direct
// regression test: two SEUs, one commissioned from a Template that mandates
// the Pack declaring these rules, one that doesn't — only the first should
// ever see them. Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { policyEngine } from "../src/domain/engine/policyEngine.js";
import { resolveOwningScope } from "../src/domain/engine/seuCompositionScope.js";
import { uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded } from "./testFixtures.js";

// A category "Organisation" Pack's own `code` must be a canonical
// organisation-name Ontology concept (validatePackSeed, packs.ts) — same
// registration real seed Packs get via cleanSlate.ts, done directly here
// since these codes are per-test-run random and never seeded. Platform-
// scoped (PLATFORM_TENANT_ID), same tenant every other fixture Pack's own
// organisation-name concept lives under.
async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('organisation-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

// A Quality Gate's own applicabilityDeliverableNames must each be a real,
// canonical deliverable-name Ontology concept (packs.ts's own
// assertCanonicalCategory check, same discipline Template's deliverableCatalogue
// entries already get) — registered directly here for the same reason
// registerOrganisationName is: these codes are per-test-run random and never
// seeded elsewhere.
async function registerDeliverableName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('deliverable-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

// Two Templates: one mandates the scoped Pack (and therefore its Quality
// Gate + Policy), one mandates nothing at all. Same shape as
// governance-ebm-sharpening.test.ts's own FR-3.6/3.7 conflict fixture —
// commissionSeu directly, no submit/activate needed for it to succeed.
async function commissionAgainstTemplate(templateId: string, statementPrefix: string) {
  // CR-104 — the real bug behind "no CommissionValidated event found",
  // permanently, not just slowly: this function calls commissionSeu (which
  // publishes CommissionRequested) BEFORE driveCommissioningToActive, whose
  // own internal ensureEventSubscriptionsLoaded() call is too late for that
  // first publish if nothing else in this process has loaded subscriptions
  // yet — eventBus.loadSubscriptions() populates the in-memory subscriber
  // map exactly once; a publish before it runs finds zero handlers and the
  // event is never processed, no matter how long a caller then waits on it.
  // Every other file's own commissionSeu-calling helper does this same call
  // first; this one just never had it.
  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `${statementPrefix}-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `${statementPrefix}-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const { data: profile } = await profilesDB.upsert({ code: `${statementPrefix}-profile-${randomUUID()}`, name: statementPrefix, baseTemplateId: templateId, environment: "development" });
  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [templateId], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");
  // CR-104 — this file drives several full commissioning cycles (2-4 SEUs
  // per test, across 3 tests), the heaviest load any single file in this
  // suite puts on the shared commissioning pipeline. A longer timeout here
  // (not a wider shared default) gives this specific heavy caller headroom
  // under real concurrent suite load without masking genuine slowness in
  // every other, lighter caller of this same fixture.
  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001", timeoutMs: 30000 });
  assert.equal(result.ok, true, !result.ok ? `Compose EBM failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu;
}

test("CR-104: a Quality Gate/Policy contributed by a Pack applies only to SEUs whose EBM actually composed that Pack", async () => {
  const run = randomUUID().slice(0, 8);

  // A Pack declaring one Quality Gate and one Policy, both on a governed
  // transition no other seeded fixture uses ("Deliverable|Defined|In
  // Progress" + category "Review Evidence" is free there — the shared
  // "development" fixture only uses that category on "In Progress|Approved").
  const scopedPack = {
    code: `cr104-scoped-pack-${run}`,
    name: "CR-104 Scoped Pack",
    category: "Organisation",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {
      qualityGates: [
        { name: `CR-104 gate ${run}`, category: "Review Evidence", governedTransition: "Deliverable|Defined|In Progress", criteriaType: "no_unresolved_obligations" },
      ],
    },
  };
  await registerOrganisationName(scopedPack.code);
  const published = await publishPack({ seed: scopedPack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `scoped pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(scopedPack.code);
  assert.ok(packRow, "sanity check: the pack is really Active");

  // policiesDB.upsert directly, same "bypass full Pack-seed-JSON, attribute
  // to a real Pack id" pattern testFixtures.ts's own
  // ensureCoreEngineeringQualityGates already uses for Quality Gates — no
  // real Policy Definition/contributionPolicies plumbing exists in any
  // seeded fixture today (cr088-filter-shaped-overrides.test.ts's own
  // comment: "every *.pack.json's own contributions.policies is empty"), so
  // this is the lower-risk way to get a real, Pack-attributed Policy row for
  // a test. Must run BEFORE commissioning below — CR-104 materialises
  // applicable_policy_ids once, at EBM creation, from whatever's already in
  // the policies table at that exact moment (same ordering requirement
  // driveCommissioningToActive's own ensureCoreEngineeringQualityGates()
  // call now enforces for the shared fixture gates).
  const { data: policyRow, error: policyErr } = await policiesDB.upsert({
    code: `cr104-scoped-policy-${run}`,
    name: `CR-104 policy ${run}`,
    constraintType: "Policy",
    governedTransition: "Deliverable|Defined|In Progress",
    condition: { type: "always_true" },
    originatingPackId: packRow!.id,
  });
  assert.ok(!policyErr && policyRow, "scoped policy must upsert");

  const { data: gateRow } = await qualityGatesDB.findByPackIds([packRow!.id]);
  assert.equal(gateRow?.length, 1, "the scoped pack's own gate exists, attributed to it");

  // Template A mandates the scoped Pack; Template B mandates nothing.
  const { data: templateWithPack } = await templatesDB.upsert({ code: `cr104-tpl-with-pack-${run}`, name: "CR-104 With Pack", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(templateWithPack!.id, [scopedPack.code]);
  await templatesDB.setRequiredCapabilities(templateWithPack!.id, []);
  const { data: templateWithoutPack } = await templatesDB.upsert({ code: `cr104-tpl-without-pack-${run}`, name: "CR-104 Without Pack", deliverableCatalogue: [] });
  await templatesDB.setRequiredCapabilities(templateWithoutPack!.id, []);

  const seuWith = await commissionAgainstTemplate(templateWithPack!.id, `cr104-with-${run}`);
  const seuWithout = await commissionAgainstTemplate(templateWithoutPack!.id, `cr104-without-${run}`);

  // The materialised fact itself — this is what CR-104 actually added.
  const { data: ebmWith } = await ebmsDB.findById((await seusDB.findById(seuWith.id)).data!.active_ebm_id!);
  const { data: ebmWithout } = await ebmsDB.findById((await seusDB.findById(seuWithout.id)).data!.active_ebm_id!);
  assert.ok(ebmWith!.applicable_quality_gate_ids.includes(gateRow![0].id), "the composing SEU's EBM materialises the scoped gate");
  assert.ok(ebmWith!.applicable_policy_ids.includes(policyRow!.id), "the composing SEU's EBM materialises the scoped policy");
  assert.ok(!ebmWithout!.applicable_quality_gate_ids.includes(gateRow![0].id), "the non-composing SEU's EBM does NOT carry a Pack it never selected");
  assert.ok(!ebmWithout!.applicable_policy_ids.includes(policyRow!.id), "same for the policy");

  // resolveOwningScope(ebmId) — the shared scope resolver both engines now
  // use — must report the scoped Pack's id only for the composing EBM.
  const scopeWith = await resolveOwningScope(ebmWith!.id);
  const scopeWithout = await resolveOwningScope(ebmWithout!.id);
  assert.ok(scopeWith?.packIds.includes(packRow!.id));
  assert.ok(!scopeWithout?.packIds.includes(packRow!.id));

  // The actual regression: before CR-104, qualityGateEngine.evaluate's bare
  // (entity_type, from_state, to_state) match would have found this gate for
  // BOTH SEUs, since it never consulted composition at all. A fabricated
  // entityId has no real Obligations, so a composing SEU that finds the gate
  // must evaluate to Passed, never Blocked (there's nothing to block on) —
  // the meaningful distinction here is Passed (found + evaluated) vs
  // NotApplicable (correctly excluded), not Blocked vs Passed.
  const gateResultWith = await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: randomUUID(), seuId: seuWith.id, fromState: "Defined", toState: "In Progress" });
  const gateResultWithout = await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: randomUUID(), seuId: seuWithout.id, fromState: "Defined", toState: "In Progress" });
  assert.equal(gateResultWith.outcome, "Passed", "the composing SEU's Deliverable transition is genuinely gated (found, evaluated, satisfied)");
  assert.equal(gateResultWithout.outcome, "NotApplicable", "the non-composing SEU's Deliverable transition is untouched by a Pack it never selected");

  // Same regression, for Policy — policyEngine.evaluate is a brand new path
  // with no prior test coverage at all, so this also exercises it directly,
  // not just its scoping.
  const policyResultWith = await policyEngine.evaluate({ entityType: "Deliverable", seuId: seuWith.id, fromState: "Defined", toState: "In Progress" });
  const policyResultWithout = await policyEngine.evaluate({ entityType: "Deliverable", seuId: seuWithout.id, fromState: "Defined", toState: "In Progress" });
  assert.equal(policyResultWith.outcome, "Passed", "the composing SEU's own Policy is found and evaluated (always_true condition)");
  assert.equal(policyResultWithout.outcome, "NotApplicable", "the non-composing SEU sees no Policy from a Pack it never selected");
});

test("CR-104: policyEngine.evaluate blocks on an unsatisfied 'Policy' constraint but not on 'Standard' alone", async () => {
  const run = randomUUID().slice(0, 8);
  // field_in against a context field nothing supplies — always unsatisfied,
  // for both Packs below.
  const unsatisfiedCondition = { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] };

  // Pack 1: only a Standard (non-blocking) policy.
  const standardPack = { code: `cr104-standard-pack-${run}`, name: "CR-104 Standard Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(standardPack.code);
  assert.ok((await publishPack({ seed: standardPack as any, actorRole: "super", actorId: "1001", activate: true })).ok);
  const { data: standardPackRow } = await packsDB.findActiveByCode(standardPack.code);
  const { data: standardPolicy } = await policiesDB.upsert({
    code: `cr104-standard-policy-${run}`, name: `CR-104 standard policy ${run}`, constraintType: "Standard",
    governedTransition: "Deliverable|Defined|In Progress", condition: unsatisfiedCondition, originatingPackId: standardPackRow!.id,
  });
  assert.ok(standardPolicy);
  const { data: standardTemplate } = await templatesDB.upsert({ code: `cr104-standard-tpl-${run}`, name: "CR-104 Standard Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(standardTemplate!.id, [standardPack.code]);
  await templatesDB.setRequiredCapabilities(standardTemplate!.id, []);
  const standardSeu = await commissionAgainstTemplate(standardTemplate!.id, `cr104-standard-${run}`);

  // Pack 2: a real, blocking Policy constraint.
  const blockingPack = { code: `cr104-blocking-pack-${run}`, name: "CR-104 Blocking Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(blockingPack.code);
  assert.ok((await publishPack({ seed: blockingPack as any, actorRole: "super", actorId: "1001", activate: true })).ok);
  const { data: blockingPackRow } = await packsDB.findActiveByCode(blockingPack.code);
  const { data: blockingPolicy } = await policiesDB.upsert({
    code: `cr104-blocking-policy-${run}`, name: `CR-104 blocking policy ${run}`, constraintType: "Policy",
    governedTransition: "Deliverable|Defined|In Progress", condition: unsatisfiedCondition, originatingPackId: blockingPackRow!.id,
  });
  assert.ok(blockingPolicy);
  const { data: blockingTemplate } = await templatesDB.upsert({ code: `cr104-blocking-tpl-${run}`, name: "CR-104 Blocking Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(blockingTemplate!.id, [blockingPack.code]);
  await templatesDB.setRequiredCapabilities(blockingTemplate!.id, []);
  const blockingSeu = await commissionAgainstTemplate(blockingTemplate!.id, `cr104-blocking-${run}`);

  const standardResult = await policyEngine.evaluate({ entityType: "Deliverable", seuId: standardSeu.id, fromState: "Defined", toState: "In Progress" });
  assert.equal(standardResult.outcome, "Passed", "an unsatisfied Standard-only policy deviates non-blockingly, never Blocked");

  const blockingResult = await policyEngine.evaluate({ entityType: "Deliverable", seuId: blockingSeu.id, fromState: "Defined", toState: "In Progress" });
  assert.equal(blockingResult.outcome, "Blocked");
  if (blockingResult.outcome === "Blocked") assert.equal(blockingResult.policyCode, blockingPolicy!.code);
});

test("CR-104: a Quality Gate's applicabilityDeliverableNames targets only the named Deliverable(s), not every Deliverable on the same transition", async () => {
  const run = randomUUID().slice(0, 8);
  const targetedName = `cr104-target-deliverable-${run}`;
  const otherName = `cr104-other-deliverable-${run}`;

  const namedPack = {
    code: `cr104-named-pack-${run}`, name: "CR-104 Named Pack", category: "Organisation",
    packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: {
      qualityGates: [
        { name: `CR-104 named gate ${run}`, category: "Review Evidence", governedTransition: "Deliverable|Defined|In Progress", criteriaType: "no_unresolved_obligations", applicabilityDeliverableNames: [targetedName] },
      ],
    },
  };
  await registerOrganisationName(namedPack.code);
  await registerDeliverableName(targetedName);
  const namedPublished = await publishPack({ seed: namedPack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(namedPublished.ok, `named pack must publish: ${!namedPublished.ok ? JSON.stringify(namedPublished) : ""}`);

  // Not run through publishTemplate's own validateTemplateSeed (which would
  // assertCanonicalCategory these against the real deliverable-name Ontology
  // vocabulary) — a raw templatesDB.upsert, same as every other Template
  // this file creates; commissioning's own deliverable materialisation
  // (commissioning.ts) falls back to the bare code as the label when no
  // Ontology concept resolves one, so an unregistered code still works
  // mechanically here.
  const { data: template } = await templatesDB.upsert({ code: `cr104-named-tpl-${run}`, name: "CR-104 Named Template", deliverableCatalogue: [{ code: targetedName }, { code: otherName }] });
  await templatesDB.setMandatoryPacks(template!.id, [namedPack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);
  const seu = await commissionAgainstTemplate(template!.id, `cr104-named-${run}`);

  const detail = await getSeuDetailView(seu.id);
  const targeted = detail?.deliverables.find((d) => d.name === targetedName);
  const other = detail?.deliverables.find((d) => d.name === otherName);
  assert.ok(targeted && other, "both catalogue entries materialised into real Deliverable rows");

  const targetedResult = await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: targeted!.id, seuId: seu.id, fromState: "Defined", toState: "In Progress" });
  const otherResult = await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: other!.id, seuId: seu.id, fromState: "Defined", toState: "In Progress" });
  assert.equal(targetedResult.outcome, "Passed", "the named Deliverable is genuinely gated");
  assert.equal(otherResult.outcome, "NotApplicable", "a different Deliverable on the SAME transition, SAME SEU, is untouched — the gate targets only the named one");
});
