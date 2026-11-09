// CR-139: unravelServices gathers the facts of the Services table.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import { unravelServices } from "../src/domain/engine/conflicts/unravelServices.js";
import { ROOT_ACTOR_ID } from "./testFixtures.js";

import { PLATFORM_TENANT_ID } from "./testFixtures.js";

async function templateAndProfile(catalogueCodes: string[]) {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-unravel-services-template-${randomUUID()}`, name: "Fixture Template", deliverableCatalogue: catalogueCodes.map((code) => ({ code })) });
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-unravel-services-profile-${randomUUID()}`, name: "Fixture Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  return { template: template!, profile: profile! };
}

test("unravelServices: the catalogue Deliverables and, for each, the Services that make it with the Service Definition's default levels", async () => {
  const { template, profile } = await templateAndProfile(["reuse-assessment", "incident-report-post-mortem"]);
  const facts = await unravelServices({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  assert.deepEqual(facts.deliverableCodes, ["incident-report-post-mortem", "reuse-assessment"]);
  assert.deepEqual(facts.candidates["reuse-assessment"].map((c) => c.code), ["asset-reuse-service"]);
  assert.deepEqual(facts.candidates["incident-report-post-mortem"].map((c) => c.code).sort(), ["availability-assurance-service", "incident-response-service"]);

  const { data: definition } = await serviceDefinitionsDB.findActiveByCodeVisibleTo("asset-reuse-service", PLATFORM_TENANT_ID);
  const expectedDefaults = Object.fromEntries((definition!.service_level ?? []).map((l) => [l.code, l.target]));
  assert.deepEqual(facts.candidates["reuse-assessment"][0].defaultLevels, expectedDefaults);
});

test("unravelServices: an empty catalogue has no candidates", async () => {
  const { template, profile } = await templateAndProfile([]);
  const facts = await unravelServices({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  assert.deepEqual(facts.deliverableCodes, []);
  assert.deepEqual(facts.candidates, {});
});

test("unravelServices: a Template that exposes no service level has no level settings", async () => {
  const { template, profile } = await templateAndProfile(["reuse-assessment"]);
  const facts = await unravelServices({ templates: [template], profiles: [profile] }, PLATFORM_TENANT_ID);
  assert.deepEqual(facts.levelSettings, {});
});
