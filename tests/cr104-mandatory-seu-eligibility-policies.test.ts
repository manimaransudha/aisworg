// CR-104 — the three follow-on design decisions, each its own test:
//   1. "Mandatory" made a real composition rule: composition itself now
//      folds in every Active Pack marked installation_classification =
//      'Mandatory', not just whatever a Template's own mandatoryPackCodes
//      explicitly lists — Platform-scoped ones for every Template
//      everywhere, tenant-scoped ones for every Template in that same
//      tenant (design/foundations Ch.5 §7 itself flagged this as
//      previously "closer to descriptive metadata than an enforced
//      composition rule").
//   2. SEU-scoped Policy delivery: a Policy governing the SEU's own
//      "SEU|Activated|Operational" hop is materialised onto the EBM's own
//      seu_scoped_policy_ids (never applicable_policy_ids, which is
//      entity-scoped governance for owned Deliverables/AttentionItems/etc)
//      and actually checked by commissioning.ts at that exact hop.
//   3. Eligibility-scoped Policy: governs whether a Participant may be
//      selected to fulfil a Capability at all — no transition involved,
//      checked against the Participant's own behaviour_context, resolved
//      live off the SEU's own Template/Profile composition, never through
//      the EBM (onboarding, not engineering behaviour).
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { findEligibleParticipants, resolveEligibilityPolicies } from "../src/routes/seu/core/participantEligibility.js";
import { flattenComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { ensureSeuSystemParticipant } from "../src/dblayer/constants.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { PLATFORM_TENANT_ID } from "./testFixtures.js";
import { uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded, ensurePolicyDefinitionWithObligation, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID, createActiveObjective, seuBirthState } from "./testFixtures.js";
import { initiateAndValidateSeu } from "./testFixtures.js";

async function createTestTenant(label: string): Promise<string> {
  const { data: tenant, error } = await tenantsDB.create({
    code: `${label}-${randomUUID().slice(0, 8)}`,
    name: label,
    authorId: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
    is_system: false,
  });
  if (error || !tenant) throw error ?? new Error(`createTestTenant: failed to create tenant "${label}"`);
  return tenant.id;
}


test("CR-104: a Pack marked installation_classification 'Mandatory' composes into every Template automatically — Platform-scoped everywhere, tenant-scoped only within its own tenant", async () => {
  const run = randomUUID().slice(0, 8);

  // Platform-scoped: no tenantId given, defaults to PLATFORM_TENANT_ID.
  const platformMandatory = { tenantId: PLATFORM_TENANT_ID, code: "cr104-platform-mandatory", name: "CR-104 Platform Mandatory", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Mandatory", contributions: {} };
  const platformPublished = await publishPack({ seed: platformMandatory as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(platformPublished.ok, `platform-mandatory pack must publish: ${!platformPublished.ok ? JSON.stringify(platformPublished) : ""}`);
  const { data: platformPackRow } = await packsDB.findActiveByCode(platformMandatory.code);

  // A Template with NO explicit mandatoryPackCodes at all, Platform tenant.
  const { data: platformTemplate } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-mandatory-tpl-${run}`, name: "CR-104 Mandatory Template", deliverableCatalogue: [] });
  await templatesDB.setRequiredCapabilities(platformTemplate!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const { data: platformProfile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-mandatory-profile-${run}`, name: "CR-104 Mandatory Profile", baseTemplateId: platformTemplate!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });

  const platformUnraveled = await flattenComposedPacks({ templates: [platformTemplate!], profiles: [platformProfile!] }, PLATFORM_TENANT_ID);
  assert.ok(
    platformUnraveled.packs.some((p) => p.id === platformPackRow!.id),
    "a Platform-scoped Mandatory Pack composes into a Template that never listed it"
  );

  // Tenant-scoped: a fresh tenant, a Pack marked Mandatory under that same
  // tenant, and two Templates — one in that tenant (must compose it), one
  // in a different tenant (must NOT).
  const tenantId = await createTestTenant(`cr104-tenant-${run}`);
  const tenantMandatory = { code: "cr104-tenant-mandatory", name: "CR-104 Tenant Mandatory", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Mandatory", contributions: {}, tenantId };
  const tenantPublished = await publishPack({ seed: tenantMandatory as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(tenantPublished.ok, `tenant-mandatory pack must publish: ${!tenantPublished.ok ? JSON.stringify(tenantPublished) : ""}`);
  const { data: tenantPackRow } = await packsDB.findActiveByCode(tenantMandatory.code);

  const { data: sameTenantTemplate } = await templatesDB.upsert({ status: "Active", code: `cr104-same-tenant-tpl-${run}`, name: "CR-104 Same Tenant Template", deliverableCatalogue: [], tenantId });
  await templatesDB.setRequiredCapabilities(sameTenantTemplate!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const { data: sameTenantProfile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-same-tenant-profile-${run}`, name: "CR-104 Same Tenant Profile", baseTemplateId: sameTenantTemplate!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  const sameTenantUnraveled = await flattenComposedPacks({ templates: [sameTenantTemplate!], profiles: [sameTenantProfile!] }, tenantId);
  assert.ok(
    sameTenantUnraveled.packs.some((p) => p.id === tenantPackRow!.id),
    "a tenant-scoped Mandatory Pack composes into a Template belonging to that same tenant"
  );

  const otherTenantUnraveled = await flattenComposedPacks({ templates: [platformTemplate!], profiles: [platformProfile!] }, PLATFORM_TENANT_ID);
  assert.ok(
    !otherTenantUnraveled.packs.some((p) => p.id === tenantPackRow!.id),
    "a tenant-scoped Mandatory Pack must NOT leak into a Template belonging to a different tenant"
  );
});

test("CR-104/CR-106: an SEU-scoped Policy ('SEU|Activated|Operational') blocks the SEU's own commence-work transition, never the entity-scoped path — and raises a real Obligation instead of hard-failing the SEU", async () => {
  const run = randomUUID().slice(0, 8);

  const seuPolicyPack = { tenantId: PLATFORM_TENANT_ID, code: "cr104-seu-policy-pack", name: "CR-104 SEU Policy Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  const published = await publishPack({ seed: seuPolicyPack as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(published.ok, `seu policy pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(seuPolicyPack.code);

  // Always-unsatisfied — proves the block, not just that a Policy exists.
  const { data: seuPolicy } = await policiesDB.upsert({
    code: `cr104-seu-commence-work-${run}`, name: `CR-104 commence-work policy ${run}`, constraintType: "Policy",
    scope: "Transition", governedTransition: "SEU|Activated|Operational",
    condition: { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] },
    originatingPackId: packRow!.id,
    authorId: packRow!.authored_by,
    authorBadge: packRow!.author_badge,
  });
  assert.ok(seuPolicy);
  await ensurePolicyDefinitionWithObligation({ code: `cr104-seu-commence-work-${run}`, name: `CR-104 commence-work policy ${run}`, category: "Compliance", title: `CR-104 commence-work blocker ${run}` });

  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-seu-policy-tpl-${run}`, name: "CR-104 SEU Policy Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [seuPolicyPack.code], ROOT_ACTOR_ID, "root");
  await templatesDB.setRequiredCapabilities(template!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr104-seu-policy-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID, });
  const { objective } = await createActiveObjective({ statement: `cr104-seu-policy-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: TESTER_ALL_ID });
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-seu-policy-profile-${run}`, name: "CR-104 SEU Policy Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  const requested = await initiateAndValidateSeu({ objectiveId: objective.id, profileId: profile!.id, actorId: TESTER_ALL_ID });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : "assertion failed");
  if (!requested.ok) throw new Error("unreachable");

  // driveCommissioningToActive drives Compose EBM itself (a manual
  // transition — nothing auto-fires it) and then waits for the async
  // EBMActivated cascade to settle. CR-106 Option C: a Policy block at the
  // commence-work hop is its own distinct outcome (stage "blocked") — the
  // SEU stays "Activated" forever, never Operational, never Failed. No new
  // event vocabulary signals this (Chapter 8's own event list is closed);
  // driveCommissioningToActive detects it via the real Obligation raised,
  // checked precisely below.
  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorId: TESTER_ALL_ID, timeoutMs: 30000 });
  assert.equal(result.ok, false, "an unsatisfied SEU-scoped Policy must block the Activated -> Operational hop");
  if (!result.ok) assert.equal(result.stage, "blocked");

  // Confirm the materialised fact itself: this Policy landed in
  // seu_scoped_policy_ids, never applicable_policy_ids (entity-scoped).
  const { data: seu } = await seusDB.findById(requested.seu.id);
  assert.ok(seu?.active_ebm_id, "Compose EBM must have succeeded even though Activate later blocked");
  assert.equal(seu?.lifecycle_state, "Activated", "a Policy block leaves the SEU Activated — never the hard, terminal Failed state a genuinely broken commission uses");
  const { data: ebm } = await ebmsDB.findById(seu!.active_ebm_id!);
  assert.ok(ebm!.seu_scoped_policy_ids.includes(seuPolicy!.id), "the SEU-scoped policy is materialised onto seu_scoped_policy_ids");
  assert.ok(!ebm!.applicable_policy_ids.includes(seuPolicy!.id), "an SEU-scoped policy must never appear in applicable_policy_ids (entity-scoped governance)");

  // CR-106 Option C step 1 — a real Obligation, not just an event, records
  // exactly which transition is blocked so a later resolution can retry it.
  const { data: obligations } = await obligationsDB.findByRelatedObject("SEU", seu!.id);
  const blockingObligation = (obligations ?? []).find((o) => o.blocked_to_state === "Operational");
  assert.ok(blockingObligation, "a real Obligation must be raised against the SEU for the blocked commence-work hop");
  assert.equal(blockingObligation!.blocked_from_state, "Activated");
});

test("CR-104: a scope:'Eligibility' Policy governs Capability Fulfilment directly, checked against the Participant's own behaviour_context, resolved from the SEU's own EBM", async () => {
  const run = randomUUID().slice(0, 8);

  const eligibilityPack = { tenantId: PLATFORM_TENANT_ID, code: "cr104-eligibility-pack", name: "CR-104 Eligibility Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  const published = await publishPack({ seed: eligibilityPack as any, actorId: TESTER_ALL_ID, activate: true });
  assert.ok(published.ok, `eligibility pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(eligibilityPack.code);

  const backgroundCheckCode = `cr104-background-check-${run}`;
  const { data: policy } = await policiesDB.upsert({
    code: backgroundCheckCode, name: `CR-104 background check ${run}`, constraintType: "Policy",
    scope: "Eligibility", governedTransition: null,
    condition: { type: "field_in", field: "cleared", values: [true] },
    originatingPackId: packRow!.id,
    authorId: packRow!.authored_by,
    authorBadge: packRow!.author_badge,
  });
  assert.ok(policy);
  assert.equal(policy!.governed_transition, null, "an Eligibility-scoped Policy carries no governed_transition at all");

  const capabilityCode = "requirements-analysis";
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-eligibility-tpl-${run}`, name: "CR-104 Eligibility Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [eligibilityPack.code], ROOT_ACTOR_ID, "root");
  await templatesDB.setRequiredCapabilities(template!.id, [], ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `cr104-eligibility-profile-${run}`, name: "CR-104 Eligibility Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });

  // A plain SEU row, deliberately not commissioned through the full async pipeline. With no EBM it has no eligibility Policies;
  // once an EBM that records the Policy id is its active EBM, the Policy resolves from that EBM.
  const { objective } = await createObjective({ statement: `cr104-eligibility-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TESTER_ALL_ID, });
  const { data: seu } = await seusDB.create({ lifecycleState: await seuBirthState(), authorBadge: ROOT_ACTOR_BADGE, objectiveId: objective.id, templateId: template!.id, profileId: profile!.id, tenantId: PLATFORM_TENANT_ID, requestedBy: TESTER_ALL_ID });
  await ensureSeuSystemParticipant(seu!.id);
  assert.ok(seu);
  assert.equal(seu!.active_ebm_id, null, "sanity check: this SEU genuinely has no EBM yet");
  assert.deepEqual(await resolveEligibilityPolicies(seu!), [], "an SEU with no EBM has no eligibility Policies");

  const { data: birth } = await transitionDefinitionsDB.findBirth("EBM");
  const { data: ebm, error: ebmError } = await ebmsDB.create({
    seuId: seu!.id, templateId: template!.id, profileId: profile!.id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    status: birth!.to_state as never, composedPacks: [], compositionReport: {} as never,
    behaviors: { settled: { policies: { result: [{ policyCode: backgroundCheckCode, scope: "Eligibility", governingCondition: { type: "field_in", field: "cleared", values: [true] } }] } } },
  });
  assert.ok(ebm && !ebmError, ebmError?.message ?? "EBM must be created");
  const { data: seuWithEbm } = await seusDB.setActiveEbm(seu!.id, ebm!.id);
  const resolvedPolicies = await resolveEligibilityPolicies(seuWithEbm!);
  assert.ok(resolvedPolicies.some((p) => p.code === backgroundCheckCode), "the Eligibility policy resolves from the settled result of the SEU's EBM");

  const cleared = await participantsMasterDB.create({
    tenantId: seu!.tenant_id!, type: "Human", displayName: `CR-104 cleared ${run}`, userId: null,
    capabilities: [capabilityCode], behaviourContext: [{ policy: backgroundCheckCode, payload: { cleared: true } }],
  });
  const uncleared = await participantsMasterDB.create({
    tenantId: seu!.tenant_id!, type: "Human", displayName: `CR-104 uncleared ${run}`, userId: null,
    capabilities: [capabilityCode], behaviourContext: [{ policy: backgroundCheckCode, payload: { cleared: false } }],
  });
  const noRecord = await participantsMasterDB.create({
    tenantId: seu!.tenant_id!, type: "Human", displayName: `CR-104 no-record ${run}`, userId: null,
    capabilities: [capabilityCode], behaviourContext: [],
  });

  const eligible = await findEligibleParticipants({
    tenantId: seu!.tenant_id!, capabilityCode, requiredPolicies: resolvedPolicies,
  });
  const eligibleIds = new Set(eligible.map((p) => p.id));
  assert.ok(eligibleIds.has(cleared.data!.id), "a Participant whose behaviour_context satisfies the required Policy is eligible");
  assert.ok(!eligibleIds.has(uncleared.data!.id), "a Participant whose behaviour_context fails the required Policy is not eligible");
  assert.ok(!eligibleIds.has(noRecord.data!.id), "a Participant with no matching behaviour_context entry at all fails closed, not open");
});
