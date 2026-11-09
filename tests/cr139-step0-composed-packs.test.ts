// CR-139 Step 0: flattening the Packs of a composition into one list.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { flattenComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import { detectEbmConflicts } from "../src/domain/engine/conflicts/index.js";
import { ROOT_ACTOR_ID } from "./testFixtures.js";

import { PLATFORM_TENANT_ID } from "./testFixtures.js";

async function createPack(dependencies: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }> = []): Promise<string> {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(schema, "no schema_definitions grammar for Pack");
  const code = `test-step0-pack-${randomUUID()}`;
  const { data: pack, error } = await packsDB.create({
    code, name: `Fixture Pack ${code}`, category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, dependencies, authoredBy: ROOT_ACTOR_ID, status: "Draft", authorBadge: "root", schemaDefinitionId: schema!.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(!error && pack, error?.message ?? "pack must be created");
  await packsDB.updateStatus(pack!.id, "Active");
  return pack!.code;
}

async function createTemplateAndProfile(packCodes: string[]) {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-step0-template-${randomUUID()}`, name: "Fixture Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, packCodes, ROOT_ACTOR_ID, "root");
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-step0-profile-${randomUUID()}`, name: "Fixture Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  return { template: template!, profile: profile! };
}

test("Step 0: the Packs a Template names are in the list, and the codes named directly are recorded", async () => {
  const a = await createPack();
  const { template, profile } = await createTemplateAndProfile([a]);
  const flattened = await flattenComposedPacks({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  assert.ok(flattened.packs.some((p) => p.code === a));
  assert.ok(flattened.directPackCodes.includes(a));
});

test("Step 0: a Pack that a named Pack depends on is in the list but is not a direct code", async () => {
  const b = await createPack();
  const a = await createPack([{ packCode: b, version: "1.0.0", type: "required" }]);
  const { template, profile } = await createTemplateAndProfile([a]);
  const flattened = await flattenComposedPacks({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  const codes = flattened.packs.map((p) => p.code);
  assert.ok(codes.includes(a) && codes.includes(b));
  assert.ok(flattened.directPackCodes.includes(a));
  assert.ok(!flattened.directPackCodes.includes(b));
});

test("Step 0: a named Pack with no Active version is skipped with a warning", async () => {
  const missing = `test-step0-missing-${randomUUID()}`;
  const { template, profile } = await createTemplateAndProfile([missing]);
  const flattened = await flattenComposedPacks({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  assert.ok(!flattened.packs.some((p) => p.code === missing));
  assert.ok(flattened.warnings.some((w) => w.includes(missing)));
});

test("detectEbmConflicts runs Step 0 first and returns every table's conflicts", async () => {
  const a = await createPack();
  const { template, profile } = await createTemplateAndProfile([a]);
  const result = await detectEbmConflicts({ templateIds: [template.id], profileIds: [profile.id], viewerTenantId: PLATFORM_TENANT_ID });
  assert.deepEqual(Object.keys(result), ["services", "capabilities", "policies", "authorityRules", "qualityGates", "reviewGates", "obligationDefinitions", "engineeringCapital", "dependencies"]);
  for (const conflicts of Object.values(result)) assert.deepEqual(conflicts.filter((c) => !c.notice), []);
});

// The dependency conflicts are found by Step 0
import { DEPENDENCY_MESSAGE, dependencyKey } from "../src/domain/engine/conflicts/dependencies.js";

test("Step 0: a required dependency that is in the list, because Step 0 pulled it in, is no conflict", async () => {
  const b = await createPack();
  const a = await createPack([{ packCode: b, version: "1.0.0", type: "required" }]);
  const { template, profile } = await createTemplateAndProfile([a]);
  assert.deepEqual((await flattenComposedPacks({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID)).dependencyConflicts, []);
});

test("Step 0: a required dependency that has no Active version is a conflict the user cannot resolve here", async () => {
  const missing = `test-step0-missing-dependency-${randomUUID()}`;
  const a = await createPack([{ packCode: missing, version: "1.0.0", type: "required" }]);
  const { template, profile } = await createTemplateAndProfile([a]);
  const { dependencyConflicts } = await flattenComposedPacks({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  assert.equal(dependencyConflicts.length, 1);
  assert.equal(dependencyConflicts[0].key, dependencyKey(a, missing));
  assert.equal(dependencyConflicts[0].kind, "dependency-required-missing");
  assert.equal(dependencyConflicts[0].table, "dependencies");
  assert.equal(dependencyConflicts[0].resolvable, false);
  assert.ok(dependencyConflicts[0].message.includes(DEPENDENCY_MESSAGE));
});

test("Step 0: an incompatible Pack that is in the list is a conflict, and one that is not is no conflict", async () => {
  const b = await createPack();
  const a = await createPack([{ packCode: b, version: "1.0.0", type: "incompatible" }]);
  const together = await createTemplateAndProfile([a, b]);
  const present = await flattenComposedPacks({ templates: [together.template], profiles: [together.profile] }, PLATFORM_TENANT_ID);
  assert.deepEqual(present.dependencyConflicts.map((c) => [c.key, c.kind]), [[dependencyKey(a, b), "dependency-incompatible-present"]]);
  const alone = await createTemplateAndProfile([a]);
  assert.deepEqual((await flattenComposedPacks({ templates: [alone.template], profiles: [alone.profile] }, PLATFORM_TENANT_ID)).dependencyConflicts, []);
});

test("Step 0: an optional dependency is never a conflict", async () => {
  const a = await createPack([{ packCode: `test-step0-optional-${randomUUID()}`, version: "1.0.0", type: "optional" }]);
  const { template, profile } = await createTemplateAndProfile([a]);
  assert.deepEqual((await flattenComposedPacks({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID)).dependencyConflicts, []);
});

test("detectEbmConflicts shows the dependency conflicts of Step 0 under the dependencies table", async () => {
  const missing = `test-step0-missing-dependency-${randomUUID()}`;
  const a = await createPack([{ packCode: missing, version: "1.0.0", type: "required" }]);
  const { template, profile } = await createTemplateAndProfile([a]);
  const result = await detectEbmConflicts({ templateIds: [template.id], profileIds: [profile.id], viewerTenantId: PLATFORM_TENANT_ID });
  assert.deepEqual(result.dependencies.map((c) => c.key), [dependencyKey(a, missing)]);
});
