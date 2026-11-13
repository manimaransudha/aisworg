// CR-139: unravelPolicies gathers the rules of the Policies that the composed Packs list.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { unravelPolicies } from "../src/domain/engine/conflicts/unravelPolicies.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import { ROOT_ACTOR_ID } from "./testFixtures.js";

import { PLATFORM_TENANT_ID } from "./testFixtures.js";

async function packListing(policies: string[]): Promise<ComposedPacks> {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(schema, "no schema_definitions grammar for Pack");
  const { data: pack, error } = await packsDB.create({
    code: `test-unravel-policies-pack-${randomUUID()}`, name: "Fixture Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: { policies }, dependencies: [], authoredBy: ROOT_ACTOR_ID, status: "Draft", authorBadge: "root", schemaDefinitionId: schema!.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(!error && pack, error?.message ?? "pack must be created");
  return { packs: [pack!], directPackCodes: [pack!.code], warnings: [], dependencyConflicts: [] };
}

// A Template and Profile whose Deliverable Catalogue holds the given codes.
async function catalogueOf(catalogueCodes: string[]) {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-unravel-policies-template-${randomUUID()}`, name: "Fixture Template", deliverableCatalogue: catalogueCodes.map((code) => ({ code })) });
  const { data: profile } = await profilesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `test-unravel-policies-profile-${randomUUID()}`, name: "Fixture Profile", baseTemplateId: template!.id, authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development" });
  assert.ok(template && profile, "template and profile must be created");
  return { templates: [template!], profiles: [profile!] };
}

test("unravelPolicies: a Pack's listed Policy gives one rule for each Deliverable and step of its conditions", async () => {
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo("test-test-coverage-threshold", PLATFORM_TENANT_ID);
  assert.ok(definition, "the seed Policy test-test-coverage-threshold must be Active");
  const composedPacks = await packListing(["test-test-coverage-threshold"]);
  const names = [...new Set(definition!.conditions.flatMap((c) => c.applicabilityDeliverables.map((a) => a.name)))];
  const { rules } = await unravelPolicies({ ...(await catalogueOf(names)), composedPacks }, PLATFORM_TENANT_ID);
  const expected = definition!.conditions.flatMap((c) => c.applicabilityDeliverables.flatMap((a) => a.transitions.map((step) => `${a.name}|${step}`))).sort();
  assert.deepEqual(rules.map((r) => `${r.deliverable}|${r.step}`).sort(), expected);
  assert.ok(rules.every((r) => r.policyCode === "test-test-coverage-threshold" && r.packCode === composedPacks.packs[0].code));
});

test("unravelPolicies: a condition with no governing field has no field and no rule", async () => {
  const composedPacks = await packListing(["test-test-coverage-threshold"]);
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo("test-test-coverage-threshold", PLATFORM_TENANT_ID);
  const names = [...new Set(definition!.conditions.flatMap((c) => c.applicabilityDeliverables.map((a) => a.name)))];
  const { rules } = await unravelPolicies({ ...(await catalogueOf(names)), composedPacks }, PLATFORM_TENANT_ID);
  assert.ok(rules.length > 0);
  assert.ok(rules.every((r) => r.field === null && r.rule === null));
});

test("unravelPolicies: a Pack that lists no Policy gives no rules, and a code with no Active Definition is skipped", async () => {
  assert.deepEqual((await unravelPolicies({ ...(await catalogueOf([])), composedPacks: await packListing([]) }, PLATFORM_TENANT_ID)).rules, []);
  assert.deepEqual((await unravelPolicies({ ...(await catalogueOf([])), composedPacks: await packListing([`no-such-policy-${randomUUID()}`]) }, PLATFORM_TENANT_ID)).rules, []);
});

test("unravelPolicies: a rule for a Deliverable that is not in the Deliverable Catalogue is left out", async () => {
  const composedPacks = await packListing(["test-test-coverage-threshold"]);
  const { rules } = await unravelPolicies({ ...(await catalogueOf([`not-the-deliverable-${randomUUID()}`])), composedPacks }, PLATFORM_TENANT_ID);
  assert.deepEqual(rules, []);
});

test("unravelPolicies: an Eligibility Policy is kept whatever the Deliverable Catalogue holds", async () => {
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo("cr104-demo-background-check", PLATFORM_TENANT_ID);
  assert.ok(definition, "the seed Policy cr104-demo-background-check must be Active");
  const composedPacks = await packListing(["cr104-demo-background-check"]);
  const { rules } = await unravelPolicies({ ...(await catalogueOf([])), composedPacks }, PLATFORM_TENANT_ID);
  assert.ok(rules.length > 0 && rules.every((r) => r.policyCode === "cr104-demo-background-check" && r.scope === "Eligibility"));
});

test("unravelPolicies: a Policy with no Deliverable gives a rule for every Deliverable of the Deliverable Catalogue", async () => {
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo("policy-pack-transition-baseline", PLATFORM_TENANT_ID);
  assert.ok(definition, "the seed Policy policy-pack-transition-baseline must be Active");
  assert.ok(definition!.conditions.every((c) => c.applicabilityDeliverables.length === 0), "the seed Policy must name no Deliverable");
  const composedPacks = await packListing(["policy-pack-transition-baseline"]);
  const catalogue = ["source-code", "deployment-manifest"];
  const { rules } = await unravelPolicies({ ...(await catalogueOf(catalogue)), composedPacks }, PLATFORM_TENANT_ID);
  assert.deepEqual([...new Set(rules.map((r) => r.deliverable))].sort(), [...catalogue].sort());
});
