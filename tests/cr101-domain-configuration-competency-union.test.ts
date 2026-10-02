// CR-101 — `domain` as a ninth Profile Configuration Parameter, and the EBM
// composition competency union (computeCompetencyRequirements, inlined in
// src/domain/engine/profileCompositionUnravel.ts's unravelComposition):
// every selected Profile's own primaryProgrammingLanguage unions into
// competencyRequirements.Technology, every selected Profile's own domain
// unions into competencyRequirements.Domain, and every composed Pack's own
// contributions.competencies[] (CR-099) unions in by its own dimension — a
// genuine union, never a composition conflict. Also covers
// validateProfileSeed's own domain/primaryProgrammingLanguage checks
// (core/profiles.ts). Real DB throughout, no mocking — same fixture pattern
// tests/profile-composition-unravel.test.ts already establishes
// (packsDB.create + updateStatus("Active"), templatesDB.upsert +
// setMandatoryPacks, profilesDB.upsert + setDraftContent).
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { unravelComposition, detectCompositionConflicts } from "../src/domain/engine/profileCompositionUnravel.js";
import { validateProfileSeed, type ProfileSeedInput } from "../src/routes/seu/core/profiles.js";
import { addConcept, type OntologyActor } from "../src/routes/seu/core/ontology.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
const PLATFORM_TENANT_ID = await getPlatformTenantId();
import type { PackContributions } from "../src/dblayer/seuTypes.js";
import { ROOT_ACTOR_ID, TESTER_ALL_ID } from "./testFixtures.js";

const ACTOR: OntologyActor = { isRoot: true, tenantId: null, actorId: TESTER_ALL_ID, actorBadge: "root" };

async function createPack(contributions: PackContributions = {}): Promise<string> {
  const code = `test-cr101-pack-${randomUUID()}`;
  // CR-114 follow-on — packsDB.create's schemaDefinitionId is now mandatory.
  const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(packSchema, "no schema_definitions grammar for Pack");
  const { data: pack, error } = await packsDB.create({ code, name: `CR-101 fixture Pack ${code}`, category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", schemaDefinitionId: packSchema!.id, tenantId: PLATFORM_TENANT_ID });
  assert.ok(!error && pack, error?.message ?? "assertion failed");
  const { error: activateError } = await packsDB.updateStatus(pack!.id, "Active");
  assert.ok(!activateError, activateError?.message ?? "assertion failed");
  return pack!.code;
}

async function createTemplate(mandatoryPackCodes: string[]): Promise<{ id: string; code: string }> {
  const templateCode = `test-cr101-template-${randomUUID()}`;
  const { data: template, error } = await templatesDB.upsert({ code: templateCode, name: "CR-101 fixture Template", deliverableCatalogue: [] });
  assert.ok(!error && template, error?.message ?? "assertion failed");
  await templatesDB.setMandatoryPacks(template!.id, mandatoryPackCodes, ROOT_ACTOR_ID, "root");
  return { id: template!.id, code: template!.code };
}

async function createProfile(template: { id: string; code: string }, draftContent: Record<string, unknown>): Promise<string> {
  const profileCode = `test-cr101-profile-${randomUUID()}`;
  const { data: profile, error } = await profilesDB.upsert({ code: profileCode, name: "CR-101 fixture Profile", baseTemplateId: template.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  assert.ok(!error && profile, error?.message ?? "assertion failed");
  const { error: draftContentError } = await profilesDB.setDraftContent(profile!.id, { baseTemplateCode: template.code, ...draftContent });
  assert.ok(!draftContentError, draftContentError?.message ?? "assertion failed");
  return profile!.id;
}

test("unravelComposition: a Profile's primaryProgrammingLanguage unions into competencyRequirements.Technology", async () => {
  const template = await createTemplate([]);
  const profileId = await createProfile(template, { primaryProgrammingLanguage: "python" });

  const unraveled = await unravelComposition({ templateIds: [template.id], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  assert.ok(unraveled.competencyRequirements.Technology?.includes("python"), `expected "python" unioned into Technology, got: ${JSON.stringify(unraveled.competencyRequirements)}`);
});

test("unravelComposition: a Profile's domain unions into competencyRequirements.Domain", async () => {
  const template = await createTemplate([]);
  const profileId = await createProfile(template, { domain: "customer-service" });

  const unraveled = await unravelComposition({ templateIds: [template.id], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  assert.ok(unraveled.competencyRequirements.Domain?.includes("customer-service"), `expected "customer-service" unioned into Domain, got: ${JSON.stringify(unraveled.competencyRequirements)}`);
});

test("unravelComposition: a composed Pack's own contributionCompetencies union in by their own dimension, any dimension", async () => {
  const pack = await createPack({ competencies: [{ dimension: "Technology", value: "rust" }] });
  const template = await createTemplate([pack]);
  const profileId = await createProfile(template, {});

  const unraveled = await unravelComposition({ templateIds: [template.id], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  assert.ok(unraveled.competencyRequirements.Technology?.includes("rust"), `expected the Pack's own Technology competency unioned in, got: ${JSON.stringify(unraveled.competencyRequirements)}`);
});

test("unravelComposition: Profile Configuration Parameter values and a Pack's own competency both land in the same dimension's union, deduplicated, and are NEVER reported as a conflict", async () => {
  const pack = await createPack({ competencies: [{ dimension: "Technology", value: "nodejs" }] });
  const template = await createTemplate([pack]);
  const profileId = await createProfile(template, { primaryProgrammingLanguage: "python" });

  const unraveled = await unravelComposition({ templateIds: [template.id], profileIds: [profileId] }, PLATFORM_TENANT_ID);
  const technology = [...(unraveled.competencyRequirements.Technology ?? [])].sort();
  assert.deepEqual(technology, ["nodejs", "python"], "expected a genuine union of the Pack's own competency and the Profile's own Configuration Parameter value");

  const conflicts = detectCompositionConflicts(unraveled);
  assert.equal(conflicts.filter((c) => c.propertyName.toLowerCase().includes("technology") || c.propertyName.toLowerCase().includes("competenc")).length, 0, "a competency union must never be flagged as a composition conflict");
});

test("unravelComposition: two Profiles disagreeing on domain IS a real, detected composition conflict (domain also joins the simpleFields pool)", async () => {
  const template = await createTemplate([]);
  const profileA = await createProfile(template, { domain: "customer-service" });
  const profileB = await createProfile(template, { domain: "accounting-finance" });

  const unraveled = await unravelComposition({ templateIds: [template.id], profileIds: [profileA, profileB] }, PLATFORM_TENANT_ID);
  const conflicts = detectCompositionConflicts(unraveled);
  assert.ok(conflicts.some((c) => c.propertyName === "domain"), `expected a real "domain" composition conflict between disagreeing Profiles, got: ${JSON.stringify(conflicts.map((c) => c.propertyName))}`);

  // The union into competencyRequirements.Domain still happens regardless —
  // the conflict and the union are two independent, non-blocking mechanisms.
  const domainValues = [...(unraveled.competencyRequirements.Domain ?? [])].sort();
  assert.deepEqual(domainValues, ["accounting-finance", "customer-service"]);
});

function baseTemplateAndProfileSeed(templateCode: string, overrides: Partial<ProfileSeedInput> = {}): ProfileSeedInput {
  return {
    code: `test-cr101-seed-profile-${randomUUID()}`,
    name: "CR-101 validateProfileSeed fixture",
    baseTemplateCode: templateCode,
    environment: "development",
    profileVersion: "1.0.0",
    developmentMethodology: "scrum",
    primaryProgrammingLanguage: "python",
    sourceControlProvider: "github",
    ...overrides,
  };
}

test("validateProfileSeed: domain must resolve to a real domain concept", async () => {
  const templateCode = `test-cr101-validate-template-${randomUUID()}`;
  const { data: template } = await templatesDB.upsert({ code: templateCode, name: "CR-101 fixture Template", deliverableCatalogue: [] });
  assert.ok(template);

  const badSeed = baseTemplateAndProfileSeed(templateCode, { domain: `not-a-real-domain-${randomUUID()}` });
  const badResult = await validateProfileSeed(badSeed);
  assert.equal(badResult.ok, false);
  if (!badResult.ok) assert.ok(badResult.errors.some((e) => e.includes("domain")));

  const goodSeed = baseTemplateAndProfileSeed(templateCode, { domain: "customer-service" });
  const goodResult = await validateProfileSeed(goodSeed);
  assert.equal(goodResult.ok, true, !goodResult.ok ? JSON.stringify(goodResult.errors) : "assertion failed");
});

test("validateProfileSeed: primaryProgrammingLanguage is rejected when it has no matching \"technology\" competency concept", async () => {
  // Every real, seeded primary-programming-language value already has a
  // matching technology concept (migration 200 closed the last gap,
  // "typescript") — so this test mints its own fresh, deliberately
  // orphaned primary-programming-language concept, the exact live bug this
  // CR fixed (owner: "If typescript is not in Ontology, that should have
  // not been allowed for selection").
  const orphanLanguage = `test-cr101-orphan-lang-${randomUUID()}`;
  await addConcept({ conceptType: "primary-programming-language", code: orphanLanguage, defaultLabel: "CR-101 orphan fixture language" }, ACTOR);

  const templateCode = `test-cr101-validate-template-${randomUUID()}`;
  const { data: template } = await templatesDB.upsert({ code: templateCode, name: "CR-101 fixture Template", deliverableCatalogue: [] });
  assert.ok(template);

  const seed = baseTemplateAndProfileSeed(templateCode, { primaryProgrammingLanguage: orphanLanguage });
  const result = await validateProfileSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => e.includes("technology")), `expected the orphaned primaryProgrammingLanguage to be rejected, got: ${JSON.stringify(result.errors)}`);
});

test("validateProfileSeed: a real primaryProgrammingLanguage value with a matching technology concept (\"python\") is accepted", async () => {
  const templateCode = `test-cr101-validate-template-${randomUUID()}`;
  const { data: template } = await templatesDB.upsert({ code: templateCode, name: "CR-101 fixture Template", deliverableCatalogue: [] });
  assert.ok(template);

  const seed = baseTemplateAndProfileSeed(templateCode, { primaryProgrammingLanguage: "python" });
  const result = await validateProfileSeed(seed);
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : "assertion failed");
});
