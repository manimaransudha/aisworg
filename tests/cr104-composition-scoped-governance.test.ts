// CR-104 — before this, (await decideGates()) matched Quality Gates
// by a bare (entity_type, from_state, to_state) triple against the GLOBAL
// quality_gates table: a Pack contributing a gate on that transition applied
// to every SEU platform-wide, regardless of whether that SEU's own EBM
// actually composed the Pack. Policy had no live lookup at all. Both are now
// materialised onto the EBM once, at creation (compositionCompleted.ts),
// from the composed Packs' own originating_pack_id
// (the EBM's own composed_packs). This file is the direct
// regression test: two SEUs, one commissioned from a Template that mandates
// the Pack declaring these rules, one that doesn't — only the first should
// ever see them. Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { getSystemActor } from "../src/dblayer/constants.js";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { policyEngine } from "../src/domain/engine/policyEngine.js";
import { uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID, createActiveObjective, decideGates } from "./testFixtures.js";
import { initiateAndValidateSeu } from "./testFixtures.js";
import { PLATFORM_TENANT_ID, ensureQualityGateDefinition, ensurePolicyDefinition } from "./testFixtures.js";

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
  const { objective: root } = await createObjective({ statement: `${statementPrefix}-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID, });
  const { objective } = await createActiveObjective({ statement: `${statementPrefix}-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: TESTER_ALL_ID });
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `${statementPrefix}-profile-${randomUUID()}`, name: statementPrefix, baseTemplateId: templateId, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  const requested = await initiateAndValidateSeu({ objectiveId: objective.id, profileId: profile!.id, actorId: TESTER_ALL_ID, tenantId: PLATFORM_TENANT_ID });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : "assertion failed");
  if (!requested.ok) throw new Error("unreachable");
  // CR-104 — this file drives several full commissioning cycles (2-4 SEUs
  // per test, across 3 tests), the heaviest load any single file in this
  // suite puts on the shared commissioning pipeline. A longer timeout here
  // (not a wider shared default) gives this specific heavy caller headroom
  // under real concurrent suite load without masking genuine slowness in
  // every other, lighter caller of this same fixture.
  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorId: TESTER_ALL_ID, timeoutMs: 30000 });
  assert.equal(result.ok, true, !result.ok ? `Compose EBM failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  return result.seu;
}

test("CR-104: a Quality Gate/Policy contributed by a Pack applies only to SEUs whose EBM actually composed that Pack", async () => {
  const run = randomUUID().slice(0, 8);

  // A Pack declaring one Quality Gate and one Policy, both on a governed
  // transition no other seeded fixture uses ("Deliverable|Defined|In
  // Progress" + category "Exit" is free there — the shared
  // "development" fixture only uses that category on "In Progress|Approved").
  // The Policy is a Policy Definition the Pack lists. It governs every Deliverable of the catalogue on the hop.
  const scopedPolicy = await ensurePolicyDefinition({ code: `cr104-scoped-policy-${run}`, name: `CR-104 policy ${run}`, rows: [{ name: "test-strategy", transitions: ["Deliverable|Defined|In Progress"], governingCondition: { type: "always_true" } }] });
  const scopedPack = {
    tenantId: PLATFORM_TENANT_ID,
    code: "cr104-scoped-pack",
    name: "CR-104 Scoped Pack",
    category: "Organisation",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {
      policies: [scopedPolicy.code],
      capabilities: [{ code: "test-strategy-and-design" }],
      qualityGates: [
        await ensureQualityGateDefinition({ code: `cr104-gate-${run}`, name: `CR-104 gate ${run}`, category: "Exit", governedTransition: "Deliverable|Defined|In Progress", criteriaType: "no_unresolved_obligations" }),
      ],
    },
  };
  const published = await publishPack({ seed: scopedPack as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(published.ok, `scoped pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(scopedPack.code);
  assert.ok(packRow, "sanity check: the pack is really Active");

  const { data: gateRow } = await qualityGatesDB.findByPackIds([packRow!.id]);
  assert.equal(gateRow?.length, 1, "the scoped pack's own gate exists, attributed to it");

  // Template A mandates the scoped Pack; Template B mandates nothing.
  const { data: templateWithPack } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-tpl-with-pack-${run}`, name: "CR-104 With Pack", deliverableCatalogue: [{ code: "test-strategy" }] });
  await templatesDB.setMandatoryPacks(templateWithPack!.id, [scopedPack.code], ROOT_ACTOR_ID, "root");
  await templatesDB.setRequiredCapabilities(templateWithPack!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const { data: templateWithoutPack } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-tpl-without-pack-${run}`, name: "CR-104 Without Pack", deliverableCatalogue: [] });
  await templatesDB.setRequiredCapabilities(templateWithoutPack!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);

  const seuWith = await commissionAgainstTemplate(templateWithPack!.id, `cr104-with-${run}`);
  const seuWithout = await commissionAgainstTemplate(templateWithoutPack!.id, `cr104-without-${run}`);

  // The materialised fact itself — this is what CR-104 actually added.
  const { data: ebmWith } = await ebmsDB.findById((await seusDB.findById(seuWith.id)).data!.active_ebm_id!);
  const { data: ebmWithout } = await ebmsDB.findById((await seusDB.findById(seuWithout.id)).data!.active_ebm_id!);
  assert.ok(ebmWith!.applicable_quality_gate_ids.includes(gateRow![0].quality_gate_definition_id!), "the composing SEU's EBM materialises the scoped gate");
  assert.ok(ebmWith!.applicable_policy_ids.includes(scopedPolicy.id), "the composing SEU's EBM materialises the scoped policy");
  assert.ok(!ebmWithout!.applicable_quality_gate_ids.includes(gateRow![0].quality_gate_definition_id!), "the non-composing SEU's EBM does NOT carry a Pack it never selected");
  assert.ok(!ebmWithout!.applicable_policy_ids.includes(scopedPolicy.id), "same for the policy");

  // The EBM's composed Packs name the scoped Pack only for the composing EBM.
  assert.ok(ebmWith!.composed_packs.some((p) => p.packId === packRow!.id));
  assert.ok(!ebmWithout!.composed_packs.some((p) => p.packId === packRow!.id));

  // The actual regression: before CR-104, qualityGateEngine.evaluate's bare
  // (entity_type, from_state, to_state) match would have found this gate for
  // BOTH SEUs, since it never consulted composition at all. A fabricated
  // entityId has no real Obligations, so a composing SEU that finds the gate
  // must evaluate to Passed, never Blocked (there's nothing to block on) —
  // the meaningful distinction here is Passed (found + evaluated) vs
  // NotApplicable (correctly excluded), not Blocked vs Passed.
  // The scoped Pack's gate names no Deliverable, so it applies to the Deliverables of the catalogue: the test evaluates the SEU's real Deliverable of the catalogue.
  const catalogueDeliverable = ((await deliverablesDB.findBySeuId(seuWith.id)).data ?? []).find((d) => d.code === "test-strategy");
  assert.ok(catalogueDeliverable, "commissioning made the catalogue Deliverable");
  const gateResultWith = (await decideGates({ entityType: "Deliverable", entityId: catalogueDeliverable.id, seuId: seuWith.id, fromState: "Defined", toState: "In Progress", authorId: (await getSystemActor(seuWith.id)).authorId, authorBadge: ROOT_ACTOR_BADGE, tenantId: seuWith.tenant_id }));
  const gateResultWithout = (await decideGates({ entityType: "Deliverable", entityId: randomUUID(), seuId: seuWithout.id, fromState: "Defined", toState: "In Progress", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, tenantId: seuWithout.tenant_id }));
  assert.equal(gateResultWith.outcome, "Approved", "the composing SEU's Deliverable transition is genuinely gated (found, evaluated, satisfied)");
  assert.equal(gateResultWithout.outcome, "NotApplicable", "the non-composing SEU's Deliverable transition is untouched by a Pack it never selected");

  // Same regression, for Policy — policyEngine.evaluate is a brand new path
  // with no prior test coverage at all, so this also exercises it directly,
  // not just its scoping.
  const policyResultWith = await policyEngine.evaluate({ entityType: "Deliverable", seuId: seuWith.id, fromState: "Defined", toState: "In Progress", context: { producingCapabilityStatus: "Fulfilled" }, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  const policyResultWithout = await policyEngine.evaluate({ entityType: "Deliverable", seuId: seuWithout.id, fromState: "Defined", toState: "In Progress", context: { producingCapabilityStatus: "Fulfilled" }, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.equal(policyResultWith.outcome, "Passed", "the composing SEU's own Policy is found and evaluated (always_true condition)");
  assert.ok(!(policyResultWithout.satisfiedPolicyIds as string[]).includes(scopedPolicy.id), "the non-composing SEU sees no Policy from a Pack it never selected");
  assert.ok(policyResultWith.satisfiedPolicyIds.includes(scopedPolicy.id), "the composing SEU evaluates the Policy from its composed Pack");
});

test("CR-104: policyEngine.evaluate blocks on an unsatisfied 'Policy' constraint but not on 'Standard' alone", async () => {
  const run = randomUUID().slice(0, 8);
  // field_in against a context field nothing supplies — always unsatisfied,
  // for both Packs below.
  const unsatisfiedCondition = { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] };

  // Pack 1: only a Standard (non-blocking) policy.
  const standardPolicy = await ensurePolicyDefinition({ code: `cr104-standard-policy-${run}`, name: `CR-104 standard policy ${run}`, constraintType: "Standard", rows: [{ name: "test-strategy", transitions: ["Deliverable|Defined|In Progress"], governingCondition: unsatisfiedCondition }] });
  const standardPack = { tenantId: PLATFORM_TENANT_ID, code: "cr104-standard-pack", name: "CR-104 Standard Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: { policies: [standardPolicy.code], capabilities: [{ code: "test-strategy-and-design" }] } };
  assert.ok((await publishPack({ seed: standardPack as any, actorId: TESTER_ALL_ID, activate: true })).ok);
  const { data: standardPackRow } = await packsDB.findActiveByCode(standardPack.code);
  const { data: standardTemplate } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-standard-tpl-${run}`, name: "CR-104 Standard Template", deliverableCatalogue: [{ code: "test-strategy" }] });
  await templatesDB.setMandatoryPacks(standardTemplate!.id, [standardPack.code], ROOT_ACTOR_ID, "root");
  await templatesDB.setRequiredCapabilities(standardTemplate!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const standardSeu = await commissionAgainstTemplate(standardTemplate!.id, `cr104-standard-${run}`);

  // Pack 2: a real, blocking Policy constraint.
  const blockingPolicy = await ensurePolicyDefinition({ code: `cr104-blocking-policy-${run}`, name: `CR-104 blocking policy ${run}`, rows: [{ name: "test-strategy", transitions: ["Deliverable|Defined|In Progress"], governingCondition: unsatisfiedCondition }] });
  const blockingPack = { tenantId: PLATFORM_TENANT_ID, code: "cr104-blocking-pack", name: "CR-104 Blocking Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: { policies: [blockingPolicy.code], capabilities: [{ code: "test-strategy-and-design" }] } };
  assert.ok((await publishPack({ seed: blockingPack as any, actorId: TESTER_ALL_ID, activate: true })).ok);
  const { data: blockingPackRow } = await packsDB.findActiveByCode(blockingPack.code);
  const { data: blockingTemplate } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-blocking-tpl-${run}`, name: "CR-104 Blocking Template", deliverableCatalogue: [{ code: "test-strategy" }] });
  await templatesDB.setMandatoryPacks(blockingTemplate!.id, [blockingPack.code], ROOT_ACTOR_ID, "root");
  await templatesDB.setRequiredCapabilities(blockingTemplate!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const blockingSeu = await commissionAgainstTemplate(blockingTemplate!.id, `cr104-blocking-${run}`);

  const standardResult = await policyEngine.evaluate({ entityType: "Deliverable", seuId: standardSeu.id, fromState: "Defined", toState: "In Progress", context: { producingCapabilityStatus: "Fulfilled" }, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.equal(standardResult.outcome, "Passed", "an unsatisfied Standard-only policy deviates non-blockingly, never Blocked");

  const blockingResult = await policyEngine.evaluate({ entityType: "Deliverable", seuId: blockingSeu.id, fromState: "Defined", toState: "In Progress", context: { producingCapabilityStatus: "Fulfilled" }, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.equal(blockingResult.outcome, "Blocked");
  if (blockingResult.outcome === "Blocked") assert.equal(blockingResult.policyCode, blockingPolicy.code);
});

test("CR-104: a Quality Gate's applicabilityDeliverableNames targets only the named Deliverable(s), not every Deliverable on the same transition", async () => {
  const run = randomUUID().slice(0, 8);
  // Deliverables of the test Ontology: the test Service "test-strategy-and-design-service" makes both.
  const targetedName = "test-strategy";
  const otherName = "test-plan";

  const namedPack = {
    tenantId: PLATFORM_TENANT_ID,
    code: "cr104-named-pack", name: "CR-104 Named Pack", category: "Organisation",
    packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: {
      qualityGates: [
        await ensureQualityGateDefinition({ code: `cr104-named-gate-${run}`, name: `CR-104 named gate ${run}`, category: "Exit", governedTransition: "Deliverable|Defined|In Progress", criteriaType: "no_unresolved_obligations", deliverableName: targetedName }),
      ],
    },
  };
  const namedPublished = await publishPack({ seed: namedPack as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(namedPublished.ok, `named pack must publish: ${!namedPublished.ok ? JSON.stringify(namedPublished) : ""}`);

  // Not run through publishTemplate's own validateTemplateSeed (which would
  // assertCanonicalCategory these against the real deliverable-name Ontology
  // vocabulary) — a raw templatesDB.upsert, same as every other Template
  // this file creates; commissioning's own deliverable materialisation
  // (commissioning.ts) falls back to the bare code as the label when no
  // Ontology concept resolves one, so an unregistered code still works
  // mechanically here.
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-named-tpl-${run}`, name: "CR-104 Named Template", deliverableCatalogue: [{ code: targetedName }, { code: otherName }] });
  await templatesDB.setMandatoryPacks(template!.id, [namedPack.code], ROOT_ACTOR_ID, "root");
  await templatesDB.setRequiredCapabilities(template!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const seu = await commissionAgainstTemplate(template!.id, `cr104-named-${run}`);

  const { data: deliverables } = await deliverablesDB.findBySeuId(seu.id);
  const targeted = deliverables?.find((d) => d.code === targetedName);
  const other = deliverables?.find((d) => d.code === otherName);
  assert.ok(targeted && other, "both catalogue entries materialised into real Deliverable rows");

  const targetedGates = (await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: targeted!.id, seuId: seu.id, fromState: "Defined", toState: "In Progress", authorId: (await getSystemActor(seu.id)).authorId, authorBadge: ROOT_ACTOR_BADGE, tenantId: seu.tenant_id })) as Array<{ gate: { code: string } }>;
  const otherGates = (await qualityGateEngine.evaluate({ entityType: "Deliverable", entityId: other!.id, seuId: seu.id, fromState: "Defined", toState: "In Progress", authorId: (await getSystemActor(seu.id)).authorId, authorBadge: ROOT_ACTOR_BADGE, tenantId: seu.tenant_id })) as Array<{ gate: { code: string } }>;
  // The Mandatory baseline Pack lists its own gate for every Deliverable of the catalogue on this transition, so both Deliverables are gated by it. The named gate applies to the named Deliverable only.
  const namedGateCode = `cr104-named-gate-${run}`;
  assert.ok(targetedGates.some((g) => g.gate.code === namedGateCode), "the named Deliverable is genuinely gated by the named gate");
  assert.ok(!otherGates.some((g) => g.gate.code === namedGateCode), "a different Deliverable on the SAME transition, SAME SEU, is untouched by the named gate — the gate targets only the named one");
});
