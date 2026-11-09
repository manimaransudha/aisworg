// CR-139: unravelPolicies gathers the rules of the Policies that the composed Packs list.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
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

test("unravelPolicies: a Pack's listed Policy gives one rule for each Deliverable and step of its conditions", async () => {
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo("test-test-coverage-threshold", PLATFORM_TENANT_ID);
  assert.ok(definition, "the seed Policy test-test-coverage-threshold must be Active");
  const composedPacks = await packListing(["test-test-coverage-threshold"]);
  const { rules } = await unravelPolicies({ composedPacks }, PLATFORM_TENANT_ID);
  const expected = definition!.conditions.flatMap((c) => c.applicabilityDeliverables.flatMap((a) => a.transitions.map((step) => `${a.name}|${step}`))).sort();
  assert.deepEqual(rules.map((r) => `${r.deliverable}|${r.step}`).sort(), expected);
  assert.ok(rules.every((r) => r.policyCode === "test-test-coverage-threshold" && r.packCode === composedPacks.packs[0].code));
});

test("unravelPolicies: a condition with no governing field has no field and no rule", async () => {
  const composedPacks = await packListing(["test-test-coverage-threshold"]);
  const { rules } = await unravelPolicies({ composedPacks }, PLATFORM_TENANT_ID);
  assert.ok(rules.length > 0);
  assert.ok(rules.every((r) => r.field === null && r.rule === null));
});

test("unravelPolicies: a Pack that lists no Policy gives no rules, and a code with no Active Definition is skipped", async () => {
  assert.deepEqual((await unravelPolicies({ composedPacks: await packListing([]) }, PLATFORM_TENANT_ID)).rules, []);
  assert.deepEqual((await unravelPolicies({ composedPacks: await packListing([`no-such-policy-${randomUUID()}`]) }, PLATFORM_TENANT_ID)).rules, []);
});
