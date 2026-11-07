// CR-139: the authority rules conflict detector, on hand-built rows, and its unravel against the database.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { authorityRulesDB } from "../src/dblayer/authorityRulesDB.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import { detectAuthorityRuleConflictsFrom, authorityRuleKey } from "../src/domain/engine/conflicts/authorityRules.js";
import { unravelAuthorityRules, type AuthorityRuleRow } from "../src/domain/engine/conflicts/unravelAuthorityRules.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import { ROOT_ACTOR_ID } from "./testFixtures.js";

const PLATFORM_TENANT_ID = await getPlatformTenantId();
const STEP = "Deliverable|In Progress|Approved";

const packRow = (pack: string, ...roles: string[]): AuthorityRuleRow => ({ packId: `id-${pack}`, packCode: pack, step: STEP, roles: [...roles].sort() });
const platformRow = (...roles: string[]): AuthorityRuleRow => ({ packId: null, packCode: null, step: STEP, roles });

test("the same role from two Packs, or from a Pack and the platform, is no conflict", () => {
  assert.deepEqual(detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead"), packRow("b", "lead")] }), []);
  assert.deepEqual(detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead"), platformRow("lead")] }), []);
});

test("different roles from two Packs are a conflict the user can resolve", () => {
  const conflicts = detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead"), packRow("b", "manager")] });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, authorityRuleKey(STEP));
  assert.equal(conflicts[0].kind, "authority-different-roles");
  assert.equal(conflicts[0].resolvable, true);
  assert.deepEqual(conflicts[0].options.map((o) => o.value), [["lead"], ["manager"]]);
});

test("the table's example: a Pack's role against the platform's role for the step is a conflict", () => {
  const conflicts = detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead"), platformRow("manager")] });
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].options.map((o) => o.sourceKind), ["pack", "definition"]);
});

test("a Pack's several roles for a step are taken together as one set", () => {
  assert.deepEqual(detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead", "manager"), packRow("b", "manager", "lead")] }), []);
  assert.equal(detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead", "manager"), packRow("b", "lead")] }).length, 1);
});

test("rules at different steps are not compared", () => {
  assert.deepEqual(detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead"), { ...packRow("b", "manager"), step: "Deliverable|Approved|Released" }] }), []);
});

test("a picked conflict is returned with its pick", () => {
  assert.deepEqual(detectAuthorityRuleConflictsFrom({ rules: [packRow("a", "lead"), packRow("b", "manager")] }, { [authorityRuleKey(STEP)]: [["lead"], ["manager"]] }).map((c) => c.resolution), [[["lead"], ["manager"]]]);
});

async function packNaming(...rules: Array<{ governedTransition: string; authorisedRole: string }>): Promise<ComposedPacks> {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(schema, "no schema_definitions grammar for Pack");
  const { data: pack, error } = await packsDB.create({
    code: `test-unravel-authority-pack-${randomUUID()}`, name: "Fixture Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: { authorityRules: rules.map((r, i) => ({ code: `rule-${i}`, ...r })) }, dependencies: [], authoredBy: ROOT_ACTOR_ID, status: "Draft", authorBadge: "root", schemaDefinitionId: schema!.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(!error && pack, error?.message ?? "pack must be created");
  return { packs: [pack!], directPackCodes: [pack!.code], warnings: [], dependencyConflicts: [] };
}

test("unravelAuthorityRules: a Pack's roles for a step are one row, and the platform's rule for that step is another", async () => {
  const composedPacks = await packNaming({ governedTransition: STEP, authorisedRole: "lead" }, { governedTransition: STEP, authorisedRole: "manager" });
  const { rules } = await unravelAuthorityRules({ composedPacks });
  const fromPack = rules.filter((r) => r.packId !== null);
  assert.deepEqual(fromPack.map((r) => [r.step, r.roles]), [[STEP, ["lead", "manager"]]]);

  const { data: definition } = await transitionDefinitionsDB.find("Deliverable", "In Progress", "Approved");
  const { data: platformRule } = definition?.required_authority_rule_id ? await authorityRulesDB.findById(definition.required_authority_rule_id) : { data: null };
  const fromPlatform = rules.filter((r) => r.packId === null);
  assert.deepEqual(fromPlatform.map((r) => r.roles), platformRule ? [[platformRule.authorised_role]] : []);
});

test("unravelAuthorityRules: a step with no definition has no platform row", async () => {
  const composedPacks = await packNaming({ governedTransition: "Deliverable|No|Such", authorisedRole: "lead" });
  const { rules } = await unravelAuthorityRules({ composedPacks });
  assert.equal(rules.filter((r) => r.packId === null).length, 0);
  assert.equal(rules.length, 1);
});
