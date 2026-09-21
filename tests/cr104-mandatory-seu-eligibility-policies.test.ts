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
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { findEligibleParticipants, resolveEligibilityPolicies } from "../src/routes/seu/core/participantEligibility.js";
import { unravelComposition } from "../src/domain/engine/profileCompositionUnravel.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import { uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded, ensurePolicyDefinitionWithObligation } from "./testFixtures.js";

async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('organisation-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

async function createTestTenant(label: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO tenants (code, name) VALUES ($1, $2) RETURNING id",
    [`${label}-${randomUUID().slice(0, 8)}`, label]
  );
  return rows[0].id;
}


test("CR-104: a Pack marked installation_classification 'Mandatory' composes into every Template automatically — Platform-scoped everywhere, tenant-scoped only within its own tenant", async () => {
  const run = randomUUID().slice(0, 8);

  // Platform-scoped: no tenantId given, defaults to PLATFORM_TENANT_ID.
  const platformMandatory = { code: `cr104-platform-mandatory-${run}`, name: "CR-104 Platform Mandatory", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Mandatory", contributions: {} };
  await registerOrganisationName(platformMandatory.code);
  const platformPublished = await publishPack({ seed: platformMandatory as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(platformPublished.ok, `platform-mandatory pack must publish: ${!platformPublished.ok ? JSON.stringify(platformPublished) : ""}`);
  const { data: platformPackRow } = await packsDB.findActiveByCode(platformMandatory.code);

  // A Template with NO explicit mandatoryPackCodes at all, Platform tenant.
  const { data: platformTemplate } = await templatesDB.upsert({ code: `cr104-mandatory-tpl-${run}`, name: "CR-104 Mandatory Template", deliverableCatalogue: [] });
  await templatesDB.setRequiredCapabilities(platformTemplate!.id, []);
  const { data: platformProfile } = await profilesDB.upsert({ code: `cr104-mandatory-profile-${run}`, name: "CR-104 Mandatory Profile", baseTemplateId: platformTemplate!.id, environment: "development" });

  const platformUnraveled = await unravelComposition({ templateIds: [platformTemplate!.id], profileIds: [platformProfile!.id] }, PLATFORM_TENANT_ID);
  assert.ok(
    platformUnraveled.composedPacks.some((p) => p.packId === platformPackRow!.id),
    "a Platform-scoped Mandatory Pack composes into a Template that never listed it"
  );

  // Tenant-scoped: a fresh tenant, a Pack marked Mandatory under that same
  // tenant, and two Templates — one in that tenant (must compose it), one
  // in a different tenant (must NOT).
  const tenantId = await createTestTenant(`cr104-tenant-${run}`);
  const tenantMandatory = { code: `cr104-tenant-mandatory-${run}`, name: "CR-104 Tenant Mandatory", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Mandatory", contributions: {}, tenantId };
  await registerOrganisationName(tenantMandatory.code);
  const tenantPublished = await publishPack({ seed: tenantMandatory as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(tenantPublished.ok, `tenant-mandatory pack must publish: ${!tenantPublished.ok ? JSON.stringify(tenantPublished) : ""}`);
  const { data: tenantPackRow } = await packsDB.findActiveByCode(tenantMandatory.code);

  const { data: sameTenantTemplate } = await templatesDB.upsert({ code: `cr104-same-tenant-tpl-${run}`, name: "CR-104 Same Tenant Template", deliverableCatalogue: [], tenantId });
  await templatesDB.setRequiredCapabilities(sameTenantTemplate!.id, []);
  const { data: sameTenantProfile } = await profilesDB.upsert({ code: `cr104-same-tenant-profile-${run}`, name: "CR-104 Same Tenant Profile", baseTemplateId: sameTenantTemplate!.id, environment: "development" });
  const sameTenantUnraveled = await unravelComposition({ templateIds: [sameTenantTemplate!.id], profileIds: [sameTenantProfile!.id] }, tenantId);
  assert.ok(
    sameTenantUnraveled.composedPacks.some((p) => p.packId === tenantPackRow!.id),
    "a tenant-scoped Mandatory Pack composes into a Template belonging to that same tenant"
  );

  const otherTenantUnraveled = await unravelComposition({ templateIds: [platformTemplate!.id], profileIds: [platformProfile!.id] }, PLATFORM_TENANT_ID);
  assert.ok(
    !otherTenantUnraveled.composedPacks.some((p) => p.packId === tenantPackRow!.id),
    "a tenant-scoped Mandatory Pack must NOT leak into a Template belonging to a different tenant"
  );
});

test("CR-104/CR-106: an SEU-scoped Policy ('SEU|Activated|Operational') blocks the SEU's own commence-work transition, never the entity-scoped path — and raises a real Obligation instead of hard-failing the SEU", async () => {
  const run = randomUUID().slice(0, 8);

  const seuPolicyPack = { code: `cr104-seu-policy-pack-${run}`, name: "CR-104 SEU Policy Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(seuPolicyPack.code);
  const published = await publishPack({ seed: seuPolicyPack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `seu policy pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(seuPolicyPack.code);

  // Always-unsatisfied — proves the block, not just that a Policy exists.
  const { data: seuPolicy } = await policiesDB.upsert({
    code: `cr104-seu-commence-work-${run}`, name: `CR-104 commence-work policy ${run}`, constraintType: "Policy",
    scope: "Transition", governedTransition: "SEU|Activated|Operational",
    condition: { type: "field_in", field: "neverSet", values: ["only-this-satisfies"] },
    originatingPackId: packRow!.id,
  });
  assert.ok(seuPolicy);
  await ensurePolicyDefinitionWithObligation({ code: `cr104-seu-commence-work-${run}`, name: `CR-104 commence-work policy ${run}`, category: "Compliance", title: `CR-104 commence-work blocker ${run}` });

  const { data: template } = await templatesDB.upsert({ code: `cr104-seu-policy-tpl-${run}`, name: "CR-104 SEU Policy Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [seuPolicyPack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `cr104-seu-policy-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `cr104-seu-policy-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: 1001 });
  const { data: profile } = await profilesDB.upsert({ code: `cr104-seu-policy-profile-${run}`, name: "CR-104 SEU Policy Profile", baseTemplateId: template!.id, environment: "development" });
  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");

  // driveCommissioningToActive drives Compose EBM itself (a manual
  // transition — nothing auto-fires it) and then waits for the async
  // EBMActivated cascade to settle. CR-106 Option C: a Policy block at the
  // commence-work hop is its own distinct outcome (stage "blocked") — the
  // SEU stays "Activated" forever, never Operational, never Failed. No new
  // event vocabulary signals this (Chapter 8's own event list is closed);
  // driveCommissioningToActive detects it via the real Obligation raised,
  // checked precisely below.
  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001", timeoutMs: 30000 });
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

test("CR-104: a scope:'Eligibility' Policy governs Capability Fulfilment directly, checked against the Participant's own behaviour_context, resolved without any EBM", async () => {
  const run = randomUUID().slice(0, 8);

  const eligibilityPack = { code: `cr104-eligibility-pack-${run}`, name: "CR-104 Eligibility Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  await registerOrganisationName(eligibilityPack.code);
  const published = await publishPack({ seed: eligibilityPack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `eligibility pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);
  const { data: packRow } = await packsDB.findActiveByCode(eligibilityPack.code);

  const backgroundCheckCode = `cr104-background-check-${run}`;
  const { data: policy } = await policiesDB.upsert({
    code: backgroundCheckCode, name: `CR-104 background check ${run}`, constraintType: "Policy",
    scope: "Eligibility", governedTransition: null,
    condition: { type: "field_in", field: "cleared", values: [true] },
    originatingPackId: packRow!.id,
  });
  assert.ok(policy);
  assert.equal(policy!.governed_transition, null, "an Eligibility-scoped Policy carries no governed_transition at all");

  const capabilityCode = "requirements-analysis";
  const { data: template } = await templatesDB.upsert({ code: `cr104-eligibility-tpl-${run}`, name: "CR-104 Eligibility Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [eligibilityPack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);
  const { data: profile } = await profilesDB.upsert({ code: `cr104-eligibility-profile-${run}`, name: "CR-104 Eligibility Profile", baseTemplateId: template!.id, environment: "development" });

  // A plain SEU row, deliberately not commissioned through the full async
  // pipeline — resolveEligibilityPolicies works off template_id/profile_id
  // directly, with no active_ebm_id at all, proving the "never through the
  // EBM" design point concretely, not just by omission.
  const { objective } = await createObjective({ statement: `cr104-eligibility-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { data: seu } = await seusDB.create({ objectiveId: objective.id, templateId: template!.id, profileId: profile!.id, tenantId: PLATFORM_TENANT_ID });
  assert.ok(seu);
  assert.equal(seu!.active_ebm_id, null, "sanity check: this SEU genuinely has no EBM yet");

  const resolvedPolicies = await resolveEligibilityPolicies(seu!);
  assert.ok(resolvedPolicies.some((p) => p.id === policy!.id), "the Eligibility policy resolves live off Template/Profile composition with no EBM at all");

  const cleared = await participantsMasterDB.create({
    tenantId: seu!.tenant_id, type: "Human", displayName: `CR-104 cleared ${run}`,
    capabilities: [capabilityCode], behaviourContext: [{ policy: backgroundCheckCode, payload: { cleared: true } }],
  });
  const uncleared = await participantsMasterDB.create({
    tenantId: seu!.tenant_id, type: "Human", displayName: `CR-104 uncleared ${run}`,
    capabilities: [capabilityCode], behaviourContext: [{ policy: backgroundCheckCode, payload: { cleared: false } }],
  });
  const noRecord = await participantsMasterDB.create({
    tenantId: seu!.tenant_id, type: "Human", displayName: `CR-104 no-record ${run}`,
    capabilities: [capabilityCode], behaviourContext: [],
  });

  const eligible = await findEligibleParticipants({
    tenantId: seu!.tenant_id, capabilityCode, requiredPolicyIds: resolvedPolicies.map((p) => p.id),
  });
  const eligibleIds = new Set(eligible.map((p) => p.id));
  assert.ok(eligibleIds.has(cleared.data!.id), "a Participant whose behaviour_context satisfies the required Policy is eligible");
  assert.ok(!eligibleIds.has(uncleared.data!.id), "a Participant whose behaviour_context fails the required Policy is not eligible");
  assert.ok(!eligibleIds.has(noRecord.data!.id), "a Participant with no matching behaviour_context entry at all fails closed, not open");
});
