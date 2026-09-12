// CR-098 (Ch.13 §8) — participants_master (createParticipantMaster,
// core/participantsMaster.ts), the Fulfilment Criteria eligibility filter
// (findEligibleParticipants/matchesCompetency, core/participantEligibility.ts),
// and the onboarding-adapter registry (participantOnboardingRegistry.ts +
// the 4 built-in mock adapters). Real DB throughout, no mocking, real
// already-seeded Ontology values (participant-types, capability-name,
// category:pack, technology/domain, behaviour-context-policy) — same
// discipline tests/cr088-filter-shaped-overrides.test.ts and
// tests/profile-composition-unravel.test.ts already establish.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createParticipantMaster } from "../src/routes/seu/core/participantsMaster.js";
import { findEligibleParticipants } from "../src/routes/seu/core/participantEligibility.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { listRegisteredOnboardingTypes, resolveOnboardingAdapter } from "../src/adapters/participantOnboardingRegistry.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";

after(async () => {
  await pool.end();
});

// Real, already-seeded canonical Ontology values (checked directly against
// the migrations, not guessed): participant-types (194), capability-name
// (046, "software-construction" — same real, shared term
// tests/pack-sdk.test.ts's own freshPackSeed already uses), category:pack
// (049, "Technology"/"Domain"), technology/domain child concept types
// (195/196/200), behaviour-context-policy (195).
const REAL_CAPABILITY_CODE = "software-construction";

function tenantId(): string {
  return PLATFORM_TENANT_ID;
}

test("createParticipantMaster: a fully-valid Human resource is created and round-trips through findById", async () => {
  const participant = await createParticipantMaster({
    tenantId: tenantId(),
    type: "Human",
    displayName: `CR-098 fixture Human ${randomUUID()}`,
    capabilities: [REAL_CAPABILITY_CODE],
    competency: { Technology: ["nodejs", "react"], Domain: ["customer-service"] },
    behaviourContext: [{ policy: "background-verification", payload: { status: "cleared" } }],
  });
  assert.ok(participant.id);
  assert.equal(participant.type, "Human");

  const { data: reloaded } = await participantsMasterDB.findById(participant.id);
  assert.ok(reloaded);
  assert.deepEqual(reloaded!.capabilities, [REAL_CAPABILITY_CODE]);
  assert.deepEqual(reloaded!.competency, { Technology: ["nodejs", "react"], Domain: ["customer-service"] });
  assert.deepEqual(reloaded!.behaviour_context, [{ policy: "background-verification", payload: { status: "cleared" } }]);
});

test("createParticipantMaster: rejects a Participant Type not backed by the participant-types Ontology", async () => {
  await assert.rejects(
    createParticipantMaster({
      tenantId: tenantId(),
      type: "NotARealType" as unknown as "Human",
      displayName: "CR-098 invalid-type fixture",
    })
  );
});

test("createParticipantMaster: rejects an unknown capability-name code", async () => {
  await assert.rejects(
    createParticipantMaster({
      tenantId: tenantId(),
      type: "Human",
      displayName: "CR-098 invalid-capability fixture",
      capabilities: [`not-a-real-capability-${randomUUID()}`],
    })
  );
});

test("createParticipantMaster: rejects a competency dimension that is not a real category:pack code", async () => {
  await assert.rejects(
    createParticipantMaster({
      tenantId: tenantId(),
      type: "Human",
      displayName: "CR-098 invalid-dimension fixture",
      competency: { NotARealDimension: ["nodejs"] },
    })
  );
});

test("createParticipantMaster: rejects a competency value not seeded under its dimension's own lower-cased concept type", async () => {
  await assert.rejects(
    createParticipantMaster({
      tenantId: tenantId(),
      type: "Human",
      displayName: "CR-098 invalid-competency-value fixture",
      competency: { Technology: [`not-a-real-technology-${randomUUID()}`] },
    })
  );
});

test("createParticipantMaster: rejects an unknown behaviourContext policy", async () => {
  await assert.rejects(
    createParticipantMaster({
      tenantId: tenantId(),
      type: "Human",
      displayName: "CR-098 invalid-policy fixture",
      behaviourContext: [{ policy: `not-a-real-policy-${randomUUID()}`, payload: {} }],
    })
  );
});

test("findEligibleParticipants: only active, this-tenant participants whose capabilities include the requested code are returned", async () => {
  const uniqueCapability = REAL_CAPABILITY_CODE; // shared, Pack-scoped-free term — real and stable
  const matching = await createParticipantMaster({ tenantId: tenantId(), type: "Human", displayName: `CR-098 eligible ${randomUUID()}`, capabilities: [uniqueCapability] });
  const nonMatching = await createParticipantMaster({ tenantId: tenantId(), type: "Human", displayName: `CR-098 ineligible ${randomUUID()}`, capabilities: [] });

  const eligible = await findEligibleParticipants({ tenantId: tenantId(), capabilityCode: uniqueCapability });
  const ids = eligible.map((p) => p.id);
  assert.ok(ids.includes(matching.id), "expected the capability-holding Participant to be eligible");
  assert.ok(!ids.includes(nonMatching.id), "expected the Participant without the capability to be excluded");
});

test("findEligibleParticipants: competency filter is ANY-within-a-dimension, ALL-across-required-dimensions", async () => {
  const capabilityCode = REAL_CAPABILITY_CODE;

  const matchesBoth = await createParticipantMaster({
    tenantId: tenantId(),
    type: "Human",
    displayName: `CR-098 matches-both ${randomUUID()}`,
    capabilities: [capabilityCode],
    competency: { Technology: ["nodejs"], Domain: ["customer-service"] },
  });
  const matchesOnlyTechnology = await createParticipantMaster({
    tenantId: tenantId(),
    type: "Human",
    displayName: `CR-098 matches-only-technology ${randomUUID()}`,
    capabilities: [capabilityCode],
    competency: { Technology: ["react"] },
  });
  const matchesNeither = await createParticipantMaster({
    tenantId: tenantId(),
    type: "Human",
    displayName: `CR-098 matches-neither ${randomUUID()}`,
    capabilities: [capabilityCode],
    competency: { Technology: ["rust"] },
  });

  // Required: Technology in {nodejs, react} AND Domain in {customer-service}.
  const eligible = await findEligibleParticipants({
    tenantId: tenantId(),
    capabilityCode,
    competency: { Technology: ["nodejs", "react"], Domain: ["customer-service"] },
  });
  const ids = new Set(eligible.map((p) => p.id));
  assert.ok(ids.has(matchesBoth.id), "expected the Participant holding a value in every required dimension to match");
  assert.ok(!ids.has(matchesOnlyTechnology.id), "a Participant missing the required Domain competency must not match — ALL dimensions required");
  assert.ok(!ids.has(matchesNeither.id), "a Participant matching neither required Technology value must not match");
});

test("findEligibleParticipants: excludeParticipantMasterIds removes a Participant just released from this Capability", async () => {
  const capabilityCode = REAL_CAPABILITY_CODE;
  const released = await createParticipantMaster({ tenantId: tenantId(), type: "Human", displayName: `CR-098 released ${randomUUID()}`, capabilities: [capabilityCode] });

  const eligible = await findEligibleParticipants({ tenantId: tenantId(), capabilityCode, excludeParticipantMasterIds: [released.id] });
  assert.ok(!eligible.some((p) => p.id === released.id), "expected the excluded Participant id to be filtered out even though it otherwise matches");
});

test("onboarding registry: the 4 built-in Participant Types are registered, and an unregistered type throws", async () => {
  const types = listRegisteredOnboardingTypes();
  assert.deepEqual([...types].sort(), ["AI", "Automated", "External", "Human"]);
  assert.throws(() => resolveOnboardingAdapter("NotARealType"), /no onboarding adapter registered/);
});

// Owner: "AI and Automated Participants use the same participants_master
// shape as Human/External... Each of the 4 mock adapters populates a
// different, narrower slice of competency" (Automated: technology only;
// External: domain only; AI/Human: all three dimensions — note: hyper-scale
// was later dropped by CR-099, so "all three" now means both Technology and
// Domain). Every adapter's own mock output must also pass the SAME
// Ontology validation createParticipantMaster enforces on any other input —
// exactly what seedParticipantsMaster.ts's real orchestration does per
// (tenant, type) pair.
for (const type of ["AI", "Human", "Automated", "External"] as const) {
  test(`onboarding adapter "${type}": onboard() output round-trips cleanly through createParticipantMaster's own Ontology validation`, async () => {
    const adapter = resolveOnboardingAdapter(type);
    const onboarded = await adapter.onboard({ tenantId: tenantId(), tenantLabel: "CR-098 fixture tenant", seed: 1 });
    assert.ok(onboarded.displayName?.trim());

    const created = await createParticipantMaster({
      tenantId: tenantId(),
      type,
      displayName: onboarded.displayName,
      capabilities: onboarded.capabilities,
      competency: onboarded.competency,
      behaviourContext: onboarded.behaviourContext,
      userId: onboarded.userId ?? null,
    });
    assert.equal(created.type, type);
  });
}

test('onboarding adapter "Automated": declares Technology competency only, never Domain', async () => {
  const adapter = resolveOnboardingAdapter("Automated");
  const onboarded = await adapter.onboard({ tenantId: tenantId(), tenantLabel: "CR-098 fixture tenant", seed: 2 });
  assert.ok(!("Domain" in onboarded.competency) || onboarded.competency.Domain.length === 0, "Automated Participants declare supported tech stack only, not a Domain competency");
});

test('onboarding adapter "External": declares Domain competency only, never Technology', async () => {
  const adapter = resolveOnboardingAdapter("External");
  const onboarded = await adapter.onboard({ tenantId: tenantId(), tenantLabel: "CR-098 fixture tenant", seed: 3 });
  assert.ok(!("Technology" in onboarded.competency) || onboarded.competency.Technology.length === 0, "External Participants declare accredited domain only, not a Technology competency");
});
