// Composition Engine (src/domain/engine/compositionEngine.ts): the conflicts that compose reports, and the merge of values that cannot be shown as text.
//
//   - merge and union run on hand-built sources, so the test needs no database for them.
//   - compose reads Active Packs, a Template and Profiles. The Packs are written for this test as Active rows with the contributions the conflict
//     rules read: two roles for one governed transition, and two Quality Gates for one transition and category. They are Optional, so they compose only
//     into the Templates that name them. The transitions are fabricated, so no real transition is touched.
//   - Rows are not deleted, as in the other tests that create Packs, Templates and Profiles.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { compositionEngine, type CompositionSource } from "../src/domain/engine/compositionEngine.js";
import { uniqueTestPackVersion, PLATFORM_TENANT_ID, ROOT_ACTOR_ID } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const source = (code: string, fields: Record<string, unknown>): CompositionSource => ({ id: `id-${code}`, code, fields });

test("merge reports a value that cannot be written as JSON by its string form", () => {
  const result = compositionEngine.merge([source("same", { size: 1n }), source("same", { size: 2n })]);
  assert.ok(result.ok);
  assert.deepEqual(result.conflicts, ['Composition conflict on "size": same has 1, same has 2.']);
});

test("union merges two lists of plain values of one length item by item, and reports the items that differ", () => {
  const result = compositionEngine.union([source("a", { tags: ["x", "y", "z"] }), source("b", { tags: ["x", "q", "z"] })]);
  assert.ok(result.ok);
  assert.deepEqual(result.fields.tags, ["x", "z"], "the items both agree on are kept");
  assert.deepEqual(result.conflicts, ['Composition conflict on "tags[1]": a has "y", b has "q".']);
});

async function createActivePack(label: string, contributions: Record<string, unknown>) {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Pack");
  assert.ok(schema, "no schema_definitions grammar for Pack");
  const { data: pack, error } = await packsDB.create({
    code: `zz-composition-${label}-${run}`, name: `Composition ${label}`, category: "Engineering", packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: contributions as never, dependencies: [], authoredBy: ROOT_ACTOR_ID, status: "Active", authorBadge: "root", schemaDefinitionId: schema.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(pack && !error, error?.message);
  return pack;
}

async function createTemplate(label: string, packCodes: string[]) {
  const { data: template } = await templatesDB.upsert({ status: "Active", tenantId: PLATFORM_TENANT_ID, code: `zz-composition-template-${label}-${run}`, name: `Composition ${label}`, deliverableCatalogue: [] });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template.id, packCodes, ROOT_ACTOR_ID, "root");
  return template;
}

const rule = (code: string, governedTransition: string, authorisedRole: string) => ({ code, governedTransition, authorisedRole });
const gate = (name: string, governedTransition: string, category: string) => ({ name, governedTransition, category, criteriaType: "no_unresolved_obligations" });

test("compose reports Packs that assign different roles to one transition, and Packs that contribute a Quality Gate to one transition and category", async () => {
  const contested = "Deliverable|zz-a|zz-b";
  const agreed = "Deliverable|zz-c|zz-d";
  const solo = "Deliverable|zz-e|zz-f";
  const first = await createActivePack("one", {
    authorityRules: [rule("r1", contested, "lead"), rule("r2", agreed, "lead"), rule("r3", solo, "lead"), rule("r4", solo, "manager")],
    qualityGates: [gate("Gate one", contested, "Exit")],
  });
  const second = await createActivePack("two", {
    authorityRules: [rule("r5", contested, "manager"), rule("r6", agreed, "lead")],
    qualityGates: [gate("Gate two", contested, "Exit")],
  });
  const template = await createTemplate("conflicts", [first.code, second.code]);

  const { composedPacks, compositionReport } = await compositionEngine.compose({ templateIds: [template.id], profileIds: [] });
  assert.deepEqual(composedPacks.map((p) => p.packCode).sort(), [first.code, second.code].sort());
  assert.equal(compositionReport.conflicts.length, 2, JSON.stringify(compositionReport.conflicts));
  const authority = compositionReport.conflicts.find((c) => c.startsWith("Authority conflict"));
  assert.ok(authority?.includes(`on "${contested}"`));
  assert.ok(authority?.includes(`${first.code} requires "lead"`) && authority?.includes(`${second.code} requires "manager"`), authority);
  const qualityGate = compositionReport.conflicts.find((c) => c.startsWith("Quality Gate conflict"));
  assert.ok(qualityGate?.includes(`${contested} [Exit]`) && qualityGate?.includes(first.code) && qualityGate?.includes(second.code), qualityGate);
});

test("compose reports a parameter that two Profiles override differently, and not one the user has resolved or the Profiles set alike", async () => {
  const template = await createTemplate("parameters", []);
  const createProfile = async (label: string, overrides: Array<{ sourceCode: string; parameterName: string; value: string }>) => {
    const { data: profile } = await profilesDB.upsert({
      status: "Active", tenantId: PLATFORM_TENANT_ID, code: `zz-composition-profile-${label}-${run}`, name: `Composition ${label}`, baseTemplateId: template.id,
      authoredBy: ROOT_ACTOR_ID, authorBadge: "root", environment: "development",
    });
    assert.ok(profile);
    await profilesDB.setDraftContent(profile.id, { exposedParameterOverrides: overrides.map((o) => ({ sourceType: "service", ...o })) });
    return profile;
  };
  const left = await createProfile("left", [{ sourceCode: "svc", parameterName: "size", value: "small" }, { sourceCode: "svc", parameterName: "shape", value: "round" }]);
  const right = await createProfile("right", [{ sourceCode: "svc", parameterName: "size", value: "large" }, { sourceCode: "svc", parameterName: "shape", value: "round" }]);

  const { compositionReport } = await compositionEngine.compose({ templateIds: [], profileIds: [left.id, right.id] });
  assert.equal(compositionReport.parameterConflicts.length, 1, "only the parameter with two values is a conflict");
  const conflict = compositionReport.parameterConflicts[0];
  assert.deepEqual([conflict.key, conflict.parameterName, conflict.options.map((o) => o.value).sort()], ["service::svc::size", "size", ["large", "small"]]);

  const resolved = await compositionEngine.compose({ templateIds: [], profileIds: [left.id, right.id], resolvedParameterOverrides: { [conflict.key]: "large" } });
  assert.deepEqual(resolved.compositionReport.parameterConflicts, []);
});
