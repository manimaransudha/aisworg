// CR-088 closing (owner, 2026-09-06: "Profile should allow override of
// everything that is configurable") — Policy's three applicability
// dimensions and Checklist's configurableKey tags were already exposed on a
// Template's own "Exposable Parameters" tab (deriveExposableParameterCandidates
// already looped over POLICY_APPLICABILITY_PARAMETERS/configurableKey), but
// deriveOverridableParameterCandidates dropped every one of them before a
// Profile's own "Parameter Overrides" tab ever saw them — a `c.valueBearing
// &&` filter with no technical justification, not a missing mechanism.
// Fixed: deriveExposableParameterCandidates now gives these filter-shaped
// candidates a real, closed valueOptions set (the same vocabularies their
// own canonical authoring forms already use); deriveOverridableParameterCandidates
// no longer excludes them by shape, only by whether the Template actually
// flagged them overridable.
// Real DB throughout, no mocking — a dedicated, uniquely-coded fixture Pack/
// Template/Profile (no real seed Pack adopts any Policy today — checked
// directly, every *.pack.json's own contributions.policies is empty), built
// straight off the DB layer (policiesDB/checklistsDB/templatesDB), the same
// way tests/testFixtures.ts builds its own fixtures.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { checklistsDB } from "../src/dblayer/checklistsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { deriveExposableParameterCandidates, deriveOverridableParameterCandidates, publishTemplate, extractExposedParameters } from "../src/routes/seu/core/templates.js";
import { validateProfileSeed, publishProfile, extractExposedParameterOverrides, type ProfileSeedInput } from "../src/routes/seu/core/profiles.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import { uniqueTestPackVersion } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

// A real, already-seeded, Active canonical Policy — confirmed directly
// against the live DB (no *.pack.json adopts it today, but the Definition
// itself is real Platform-seeded data, not test-only).
const REAL_POLICY_CODE = "adr-required";

async function buildFixturePack(): Promise<{ packId: string; packCode: string; checklistId: string }> {
  const packCode = `test-cr088-pack-${randomUUID()}`;
  const { data: pack, error: packError } = await packsDB.create({
    code: packCode,
    name: "CR-088 filter-shaped override fixture Pack",
    category: "Engineering",
    packVersion: "1.0.0",
    contributions: {},
  });
  assert.ok(!packError && pack, packError?.message);

  const { data: policy, error: policyError } = await policiesDB.upsert({
    code: REAL_POLICY_CODE,
    name: "ADR Required (fixture adoption)",
    governedTransition: "deliverable.transition",
    originatingPackId: pack!.id,
  });
  assert.ok(!policyError && policy, policyError?.message);

  const { data: checklist, error: checklistError } = await checklistsDB.upsert({
    name: `CR-088 fixture checklist ${randomUUID()}`,
    items: [{ statement: "Fixture item tagged for filtering.", configurableKey: "type", configurableValue: "required" }],
    originatingPackId: pack!.id,
  });
  assert.ok(!checklistError && checklist, checklistError?.message);

  return { packId: pack!.id, packCode, checklistId: checklist!.id };
}

test("deriveExposableParameterCandidates: Policy applicability dimensions get real, closed valueOptions", async () => {
  const { packCode } = await buildFixturePack();
  const candidates = await deriveExposableParameterCandidates([packCode], PLATFORM_TENANT_ID, []);

  const deliverableNames = candidates.find((c) => c.sourceType === "policy" && c.sourceCode === REAL_POLICY_CODE && c.parameterName === "applicabilityDeliverableNames");
  assert.ok(deliverableNames, "expected an applicabilityDeliverableNames candidate for the adopted Policy");
  assert.equal(deliverableNames!.valueBearing, false);
  assert.ok(deliverableNames!.valueOptions && deliverableNames!.valueOptions.length > 0, "expected a real, non-empty deliverable-name vocabulary");

  const environments = candidates.find((c) => c.sourceType === "policy" && c.sourceCode === REAL_POLICY_CODE && c.parameterName === "applicabilityEnvironments");
  assert.ok(environments?.valueOptions && environments.valueOptions.length > 0, "expected a real, non-empty category:environment vocabulary");

  const lifecycle = candidates.find((c) => c.sourceType === "policy" && c.sourceCode === REAL_POLICY_CODE && c.parameterName === "applicabilityDeliverableLifecycle");
  assert.deepEqual(
    lifecycle?.valueOptions ? [...lifecycle.valueOptions].sort() : [],
    ["Approved", "Baselined", "Defined", "In Progress"],
    "applicabilityDeliverableLifecycle must be exactly the real transition_definitions states, not Ontology-derived"
  );
});

test("deriveExposableParameterCandidates: Checklist configurableKey gets valueOptions from checklist-configurable-value", async () => {
  const { packCode, checklistId } = await buildFixturePack();
  const candidates = await deriveExposableParameterCandidates([packCode], PLATFORM_TENANT_ID, []);

  const configurable = candidates.find((c) => c.sourceType === "checklist" && c.sourceCode === checklistId && c.parameterName === "type");
  assert.ok(configurable, "expected a configurableKey candidate for the fixture Checklist's own tagged item");
  assert.equal(configurable!.valueBearing, false);
  assert.ok(configurable!.valueOptions?.includes("required"), `expected "required" among checklist-configurable-value options, got: ${JSON.stringify(configurable!.valueOptions)}`);
  assert.ok(configurable!.valueOptions?.includes("mandatory"));
  assert.ok(configurable!.valueOptions?.includes("conditional"));
});

async function buildFixtureTemplate(input: { packCode: string; checklistId: string; flagOverridable: boolean }): Promise<string> {
  const templateCode = `test-cr088-template-${randomUUID()}`;
  const { data: template, error } = await templatesDB.upsert({ code: templateCode, name: "CR-088 fixture Template", deliverableCatalogue: [] });
  assert.ok(!error && template, error?.message);
  await templatesDB.setMandatoryPacks(template!.id, [input.packCode]);
  await templatesDB.setDraftContent(template!.id, {
    exposedParameters: [
      { sourceType: "policy", sourceCode: REAL_POLICY_CODE, parameterName: "applicabilityDeliverableNames", overridable: input.flagOverridable },
      { sourceType: "checklist", sourceCode: input.checklistId, parameterName: "type", overridable: input.flagOverridable },
    ],
  });
  return templateCode;
}

test("deriveOverridableParameterCandidates: filter-shaped candidates reach Profile's own tab once the Template flags them overridable", async () => {
  const { packCode, checklistId } = await buildFixturePack();
  const templateCode = await buildFixtureTemplate({ packCode, checklistId, flagOverridable: true });

  const candidates = await deriveOverridableParameterCandidates(templateCode, PLATFORM_TENANT_ID);
  const policyCandidate = candidates.find((c) => c.sourceType === "policy" && c.parameterName === "applicabilityDeliverableNames");
  assert.ok(policyCandidate, "expected the Policy applicability candidate to reach Profile's own tab now that valueBearing is no longer required");
  assert.ok(policyCandidate!.valueOptions && policyCandidate!.valueOptions.length > 0);

  const checklistCandidate = candidates.find((c) => c.sourceType === "checklist" && c.sourceCode === checklistId);
  assert.ok(checklistCandidate, "expected the Checklist configurableKey candidate to reach Profile's own tab too");
  assert.ok(checklistCandidate!.valueOptions?.includes("required"));
});

test("deriveOverridableParameterCandidates: a candidate the Template did NOT flag overridable is still excluded", async () => {
  const { packCode, checklistId } = await buildFixturePack();
  const templateCode = await buildFixtureTemplate({ packCode, checklistId, flagOverridable: false });

  const candidates = await deriveOverridableParameterCandidates(templateCode, PLATFORM_TENANT_ID);
  assert.equal(candidates.length, 0, "removing the valueBearing filter must not also loosen the overridableKeys gate");
});

function baseProfileSeed(templateCode: string): Omit<ProfileSeedInput, "exposedParameterOverrides"> {
  return {
    code: `test-cr088-profile-${randomUUID()}`,
    name: "CR-088 fixture Profile",
    baseTemplateCode: templateCode,
    environment: "development",
    profileVersion: "1.0.0",
    // Platform-mandatory Configuration Parameters (CR-091 Part 2) — real,
    // already-seeded values, required or validateProfileSeed rejects the seed
    // for an unrelated reason before ever reaching the override checks below.
    developmentMethodology: "scrum",
    primaryProgrammingLanguage: "typescript",
    sourceControlProvider: "github",
  } as Omit<ProfileSeedInput, "exposedParameterOverrides">;
}

test("Profile override: a real value from the candidate's own valueOptions is accepted and round-trips through publishProfile", async () => {
  const { packCode, checklistId } = await buildFixturePack();
  const templateCode = await buildFixtureTemplate({ packCode, checklistId, flagOverridable: true });

  const seed: ProfileSeedInput = {
    ...baseProfileSeed(templateCode),
    exposedParameterOverrides: [{ sourceType: "checklist", sourceCode: checklistId, parameterName: "type", value: "mandatory" }],
  };

  const validation = await validateProfileSeed(seed);
  assert.equal(validation.ok, true, !validation.ok ? `unexpected validation errors: ${validation.errors.join("; ")}` : undefined);

  const result = await publishProfile({ seed, actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, true, !result.ok ? result.errors.join("; ") : undefined);
  if (!result.ok) return;

  const { data: saved } = await profilesDB.findById(result.profileId);
  assert.ok(saved);
  const overrides = extractExposedParameterOverrides(saved!.draft_content);
  const mine = overrides.find((o) => o.sourceType === "checklist" && o.sourceCode === checklistId && o.parameterName === "type");
  assert.ok(mine, "expected the filter-shaped override to survive the real save/reload path, not be silently dropped");
  assert.equal(mine!.value, "mandatory");
});

test("Profile override: a value NOT in the candidate's own valueOptions is rejected", async () => {
  const { packCode, checklistId } = await buildFixturePack();
  const templateCode = await buildFixtureTemplate({ packCode, checklistId, flagOverridable: true });

  const seed: ProfileSeedInput = {
    ...baseProfileSeed(templateCode),
    exposedParameterOverrides: [{ sourceType: "checklist", sourceCode: checklistId, parameterName: "type", value: "not-a-real-option" }],
  };

  const validation = await validateProfileSeed(seed);
  assert.equal(validation.ok, false, "expected an override value outside the real checklist-configurable-value vocabulary to be rejected");
  if (validation.ok) return;
  assert.ok(validation.errors.some((e) => e.includes("must be one of")), `expected a "must be one of" error, got: ${JSON.stringify(validation.errors)}`);
});

// design/mvp-build-plan/SEU Composition.md — owner: "Template should have
// persisted all the applicable service levels... otherwise this information
// is not available for composing." Root cause: materialisePackSelectionsAndCapabilities
// (shared by publishTemplate and interactive authoring's own Draft-publish
// step) used to just write `{...seed}` verbatim — a seed with no
// exposedParameters of its own (every JSON-seeded Template, since none
// predates CR-088) ended up with none, permanently, since nothing else ever
// defaulted it. loadExposableParameterRows (web/sdkAuthoring.ts) computes the
// same non-sparse "one row per real candidate" set, but only for the SDK
// Authoring form's own display — never persisted unless a human opens that
// Template's Exposable Parameters tab and saves. Fixed: the same non-sparse
// default now happens inside materialisePackSelectionsAndCapabilities itself,
// so it applies uniformly regardless of how the Template was created. This
// test exercises the real entry point (publishTemplate) a JSON seed goes
// through, unlike buildFixtureTemplate above (which pokes draft_content
// directly and so never exercised this code path at all).
test("publishTemplate: materialises a non-sparse exposedParameters set from the Template's own Pack selections, without the seed providing one", async () => {
  const { packCode, checklistId } = await buildFixturePack();

  const result = await publishTemplate({
    seed: {
      code: "test-cr088-publish-template",
      name: "CR-088 publishTemplate fixture",
      templateVersion: uniqueTestPackVersion(),
      engineeringPackCodes: [packCode],
      deliverableCatalogue: [],
    },
    actorRole: "power",
    actorId: "1001",
  });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
  if (!result.ok) return;

  const { data: template } = await templatesDB.findById(result.templateId);
  assert.ok(template);
  const exposed = extractExposedParameters(template!.draft_content as Record<string, unknown>);
  assert.ok(exposed && exposed.length > 0, "expected a non-sparse exposedParameters set materialised automatically, without the seed providing one");

  const policyCandidate = exposed!.find((e) => e.sourceType === "policy" && e.sourceCode === REAL_POLICY_CODE && e.parameterName === "applicabilityDeliverableNames");
  assert.ok(policyCandidate, "expected the fixture Pack's adopted Policy applicability candidate to be materialised");
  assert.equal(policyCandidate!.overridable, true, "by default all of the parameters are checked");

  const checklistCandidate = exposed!.find((e) => e.sourceType === "checklist" && e.sourceCode === checklistId && e.parameterName === "type");
  assert.ok(checklistCandidate, "expected the fixture Pack's Checklist configurableKey candidate to be materialised too");
  assert.equal(checklistCandidate!.overridable, true);
});
