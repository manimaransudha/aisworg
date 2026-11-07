// CR-139 part 1: EBM Capabilities come from the Deliverable Catalogue through the Service that outputs each Deliverable,
// limited to the Services the composed Packs contribute. The Profile adds no list of Capabilities.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { COMPETENCY_DIMENSION_ROLE, COMPETENCY_DIMENSION_WORK_TYPE } from "../src/dblayer/constants.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import type { PackContributions } from "../src/dblayer/seuTypes.js";
import { ROOT_ACTOR_ID, serviceDefinitionIdFor } from "./testFixtures.js";

const PLATFORM_TENANT_ID = await getPlatformTenantId();

async function createPack(contributions: PackContributions): Promise<string> {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(schema, "no schema_definitions grammar for Pack");
  const code = `test-cr139-pack-${randomUUID()}`;
  const { data: pack, error } = await packsDB.create({
    code, name: `Fixture Pack ${code}`, category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions, dependencies: [], authoredBy: ROOT_ACTOR_ID, status: "Draft", authorBadge: "root", schemaDefinitionId: schema!.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(!error && pack, error?.message ?? "pack must be created");
  await packsDB.updateStatus(pack!.id, "Active");
  return pack!.code;
}

async function createComposition(packCodes: string[], catalogueCodes: string[], profileDraft: Record<string, unknown> = {}): Promise<{ templateIds: string[]; profileIds: string[] }> {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-cr139-template-${randomUUID()}`, name: "Fixture Template", deliverableCatalogue: catalogueCodes.map((code) => ({ code })) });
  await templatesDB.setMandatoryPacks(template!.id, packCodes, ROOT_ACTOR_ID, "root");
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-cr139-profile-${randomUUID()}`, name: "Fixture Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development", draftContent: profileDraft } as never);
  return { templateIds: [template!.id], profileIds: [profile!.id] };
}

const service = async (code: string) => ({ code, serviceDefinitionId: await serviceDefinitionIdFor(code), serviceLevel: [] });

const PICK_AVAILABILITY = { "serviceChoice::incident-report-post-mortem": "availability-assurance-service", "serviceChoice::operational-intelligence-report": "availability-assurance-service" };

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: a Capability enters the pool through the catalogue Deliverable and its Service, and records the Deliverable and the catalogue source", async () => {
//   const pack = await createPack({ services: [await service("availability-assurance-service")] });
//   const composition = await createComposition([pack], ["incident-report-post-mortem", "operational-intelligence-report"]);
//   const unraveled = await unravelComposition({ ...composition, resolutions: PICK_AVAILABILITY }, PLATFORM_TENANT_ID);
//   const entry = unraveled.pool.find((e) => e.propertyName === "operating-production-systems");
//   assert.ok(entry);
//   assert.deepEqual(entry!.deliverableCodes, ["incident-report-post-mortem", "operational-intelligence-report"]);
//   assert.equal(entry!.source.kind, "template");
//   assert.equal(entry!.source.id, composition.templateIds[0]);
// });

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: a Deliverable with one Service brings that Service's Capability without any Pack", async () => {
//   const pack = await createPack({});
//   const unraveled = await unravelComposition(await createComposition([pack], ["reuse-assessment"]), PLATFORM_TENANT_ID);
//   const entry = unraveled.pool.find((e) => e.propertyName === "engineering-assets-reuse");
//   assert.ok(entry);
//   assert.deepEqual(entry!.deliverableCodes, ["reuse-assessment"]);
// });

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: an empty catalogue brings no Capability", async () => {
//   const pack = await createPack({ services: [await service("availability-assurance-service")] });
//   const unraveled = await unravelComposition(await createComposition([pack], []), PLATFORM_TENANT_ID);
//   assert.ok(!unraveled.pool.some((e) => e.propertyName === "operating-production-systems"));
// });

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: a Deliverable with several Services brings no Capability until the user picks one, and a Service no Pack lists still counts", async () => {
//   const pack = await createPack({ services: [await service("asset-reuse-service")] });
//   const composition = await createComposition([pack], ["incident-report-post-mortem"]);
//   const undecided = await unravelComposition(composition, PLATFORM_TENANT_ID);
//   assert.deepEqual(undecided.pool.filter((e) => e.deliverableCodes).map((e) => e.propertyName), []);
//   const picked = await unravelComposition({ ...composition, resolutions: { "serviceChoice::incident-report-post-mortem": "incident-response-service" } }, PLATFORM_TENANT_ID);
//   assert.deepEqual(picked.pool.filter((e) => e.deliverableCodes).map((e) => e.propertyName), ["incident-response-management"]);
// });

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: a Pack's own capability list does not enter the pool", async () => {
//   const pack = await createPack({ capabilities: [{ code: "learning" }] });
//   const unraveled = await unravelComposition(await createComposition([pack], []), PLATFORM_TENANT_ID);
//   assert.ok(!unraveled.pool.some((e) => e.propertyName === "learning"));
// });

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: a Profile's additionalCapabilityCodes is not pooled", async () => {
//   const pack = await createPack({});
//   const unraveled = await unravelComposition(await createComposition([pack], [], { additionalCapabilityCodes: ["learning"] }), PLATFORM_TENANT_ID);
//   assert.ok(!unraveled.pool.some((e) => e.propertyName === "additionalCapabilityCodes"));
//   assert.ok(!unraveled.pool.some((e) => e.propertyName === "learning"));
// });

test("CR-139: the Profile grammar has no additionalCapabilityCodes property", () => {
  const definitions = JSON.parse(readFileSync(new URL("../src/dblayer/seed/data/schemaDefinitions.json", import.meta.url), "utf8")) as unknown;
  assert.ok(!JSON.stringify(definitions).includes("additionalCapabilityCodes"));
});

test("CR-139: findActiveByCodesVisibleTo returns one Active row per code", async () => {
  const { data: rows } = await serviceDefinitionsDB.findActiveByCodesVisibleTo(["availability-assurance-service", "asset-reuse-service", "availability-assurance-service"], PLATFORM_TENANT_ID);
  const codes = (rows ?? []).map((r) => r.code).sort();
  assert.deepEqual(codes, ["asset-reuse-service", "availability-assurance-service"]);
  const { data: none } = await serviceDefinitionsDB.findActiveByCodesVisibleTo(["no-such-service"], PLATFORM_TENANT_ID);
  assert.deepEqual(none, []);
});

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: the role types and work types of the composed Capabilities are the Role and Work type competencies", async () => {
//   const { data: definition } = await capabilityDefinitionsDB.findActiveByCodeVisibleTo("engineering-assets-reuse", PLATFORM_TENANT_ID);
//   assert.ok(definition && definition.roles.length > 0, "the seed Capability Definition must carry roles");
//   const pack = await createPack({});
//   const unraveled = await unravelComposition(await createComposition([pack], ["reuse-assessment"]), PLATFORM_TENANT_ID);
//   assert.deepEqual([...(unraveled.competencyRequirements[COMPETENCY_DIMENSION_ROLE] ?? [])].sort(), definition!.roles.map((r) => r.name).sort());
//   assert.deepEqual([...(unraveled.competencyRequirements[COMPETENCY_DIMENSION_WORK_TYPE] ?? [])].sort(), [...new Set(definition!.roles.flatMap((r) => r.worktypes))].sort());
// });

// Commented out (owner): this test used the old composition. The same behaviour is tested by tests/cr139-unravel-capabilities.test.ts, cr139-settle-tables.test.ts and cr139-settle-services.test.ts.
// test("CR-139: with no composed Capability there are no Role or Work type competencies", async () => {
//   const pack = await createPack({});
//   const unraveled = await unravelComposition(await createComposition([pack], []), PLATFORM_TENANT_ID);
//   assert.equal(unraveled.competencyRequirements[COMPETENCY_DIMENSION_ROLE], undefined);
//   assert.equal(unraveled.competencyRequirements[COMPETENCY_DIMENSION_WORK_TYPE], undefined);
// });

test("CR-139: the Role and Work type competency dimensions are participant-eligibility-dimension concepts, and category:pack does not list them", () => {
  const concepts = JSON.parse(readFileSync(new URL("../src/dblayer/seed/data/ontologyConcepts.json", import.meta.url), "utf8")) as Array<{ concept_type: string; code: string }>;
  const codesOf = (type: string) => new Set(concepts.filter((c) => c.concept_type === type).map((c) => c.code));
  const dimensions = codesOf("participant-eligibility-dimension");
  assert.ok(dimensions.has(COMPETENCY_DIMENSION_ROLE));
  assert.ok(dimensions.has(COMPETENCY_DIMENSION_WORK_TYPE));
  assert.ok(!codesOf("category:pack").has(COMPETENCY_DIMENSION_ROLE));
  assert.ok(!codesOf("category:pack").has(COMPETENCY_DIMENSION_WORK_TYPE));
});
