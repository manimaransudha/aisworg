// CR-139: unravelCapabilities gathers the two lists of the Capabilities table.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { flattenComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import { unravelCapabilities } from "../src/domain/engine/conflicts/unravelCapabilities.js";
import { ROOT_ACTOR_ID } from "./testFixtures.js";

import { PLATFORM_TENANT_ID } from "./testFixtures.js";

async function createPack(capabilityCodes: string[]): Promise<string> {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(schema, "no schema_definitions grammar for Pack");
  const code = `test-unravel-capabilities-pack-${randomUUID()}`;
  const { data: pack, error } = await packsDB.create({
    code, name: `Fixture Pack ${code}`, category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: { capabilities: capabilityCodes.map((c) => ({ code: c })) }, dependencies: [], authoredBy: ROOT_ACTOR_ID, status: "Draft", authorBadge: "root", schemaDefinitionId: schema!.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(!error && pack, error?.message ?? "pack must be created");
  await packsDB.updateStatus(pack!.id, "Active");
  return pack!.code;
}

async function compose(packCodes: string[], catalogueCodes: string[]) {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-unravel-capabilities-template-${randomUUID()}`, name: "Fixture Template", deliverableCatalogue: catalogueCodes.map((code) => ({ code })) });
  await templatesDB.setMandatoryPacks(template!.id, packCodes, ROOT_ACTOR_ID, "root");
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-unravel-capabilities-profile-${randomUUID()}`, name: "Fixture Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  const composedPacks = await flattenComposedPacks({ templates: [template!], profiles: [profile!] }, PLATFORM_TENANT_ID);
  return { templates: [template!], profiles: [profile!], composedPacks };
}

test("unravelCapabilities: list A holds the Capability of every candidate Service of every catalogue Deliverable", async () => {
  const input = await compose([await createPack([])], ["reuse-assessment", "incident-report-post-mortem"]);
  const { listA } = await unravelCapabilities(input, PLATFORM_TENANT_ID);
  assert.deepEqual(listA.filter((e) => e.deliverableCode === "reuse-assessment").map((e) => e.capabilityCode), ["engineering-assets-reuse"]);
  assert.deepEqual(listA.filter((e) => e.deliverableCode === "incident-report-post-mortem").map((e) => e.capabilityCode).sort(), ["incident-response-management", "operating-production-systems"]);
});

test("unravelCapabilities: list B holds the Capabilities the composed Packs name, with the Pack", async () => {
  const pack = await createPack(["software-construction", "code-review"]);
  const input = await compose([pack], []);
  const { listB } = await unravelCapabilities(input, PLATFORM_TENANT_ID);
  assert.deepEqual(listB.filter((e) => e.packCode === pack).map((e) => e.capabilityCode).sort(), ["code-review", "software-construction"]);
});

test("unravelCapabilities: an empty catalogue has an empty list A", async () => {
  const input = await compose([await createPack([])], []);
  assert.deepEqual((await unravelCapabilities(input, PLATFORM_TENANT_ID)).listA, []);
});
