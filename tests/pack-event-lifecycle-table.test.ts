// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.5. An executable check of the Pack's own
// transition_definitions rows, including the birth row, the schema and Ontology policies and the comment policy.
//
//   - DEFINITION: every row's transition_definitions record matches the table.
//   - DRIVEN: creation goes through a real call site (createPackDraft), which reads the birth row. Every hop runs
//     through transitionEntity. The events are asserted against eventsDB directly. No mocking.
//   - POLICY: policy-validate-schema (structure, Ontology and referential-list checks), policy-ontology-values-present
//     and policy-comment-required refuse what they should.
//   - COMMENTS: a comment is added only with a transition, is kept, and is never replaced.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { packsDB } from "../src/dblayer/packsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { createPackDraft, type PackSeedInput } from "../src/routes/seu/core/packs.js";
import { computeRowActions, publishAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { validateReferentialFields } from "../src/routes/seu/core/referentialOptions.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { evaluateImplementedPolicy } from "../src/policies/index.js";
import { generateFields, type JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";
import { COMMENT_REQUIRED_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE, VALIDATE_SCHEMA_POLICY_CODE } from "../src/dblayer/constants.js";
import { query } from "../src/utils/db.js";
import { ensureTestFixturePacks, uniqueTestPackVersion, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

async function freshPackSeed(overrides: Partial<PackSeedInput> = {}): Promise<PackSeedInput> {
  return {
    code: "test-pack",
    name: "Test Pack",
    category: "Engineering",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {
      capabilities: [{ code: "software-construction" }],
    },
    tenantId: PLATFORM_TENANT_ID,
    ...overrides,
  };
}

async function freshPack(overrides: Partial<PackSeedInput> = {}) {
  const draft = await createPackDraft(await freshPackSeed(overrides), ROOT_ACTOR_ID);
  assert.equal(draft.ok, true, draft.ok ? "" : draft.errors.join("; "));
  if (!draft.ok) throw new Error("unreachable");
  return draft.pack;
}

async function hop(id: string, targetState: string, context?: Record<string, unknown>, actorId = TESTER_ALL_ID) {
  return transitionAndPublish({ entityType: "Pack", entityId: id, targetState, actorId, context });
}

function outcome(r: Awaited<ReturnType<typeof hop>>): { ok: boolean; reason: string | null } {
  return { ok: r.ok, reason: r.ok ? null : r.reason };
}

async function policyDefinitionId(code: string): Promise<string> {
  const { data } = await policyDefinitionsDB.findActiveByCodeVisibleTo(code, PLATFORM_TENANT_ID);
  assert.ok(data, `no Active Policy Definition ${code}`);
  return data!.id;
}

interface PackTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
}

const PACK_TABLE: PackTableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Draft", verb: "define", eventType: "PackDefined", versionEvent: null, policyCodes: [] },
  { row: 3, description: "Validate", fromState: "Draft", toState: "Validated", verb: "validate", eventType: "PackValidated", versionEvent: "VersionValidated", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 4, description: "Reject", fromState: "Validated", toState: "Draft", verb: "reject", eventType: "PackRejected", versionEvent: null, policyCodes: [COMMENT_REQUIRED_POLICY_CODE] },
  { row: 5, description: "Publish", fromState: "Validated", toState: "Published", verb: "publish", eventType: "PackPublished", versionEvent: "VersionPublished", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE] },
  { row: 6, description: "Activate", fromState: "Published", toState: "Active", verb: "activate", eventType: "PackActivated", versionEvent: "VersionActivated", policyCodes: [] },
  { row: 7, description: "Retire", fromState: "Active", toState: "Retired", verb: "retire", eventType: "PackRetired", versionEvent: "VersionDeprecated", policyCodes: [] },
  { row: 8, description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", eventType: "PackArchived", versionEvent: "VersionArchived", policyCodes: [] },
];

// The forward hops, in order, after the birth row.
const FORWARD_HOPS = ["Validated", "Published", "Active", "Retired", "Archived"];

test("DEFINITION: every Pack transition_definitions row matches its own verb, trigger, event_type, version_event and policies", async () => {
  for (const row of PACK_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Pack", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Pack ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.verb, row.verb, `row ${row.row} (${row.description}): verb`);
    assert.equal(def!.trigger, "manual", `row ${row.row} (${row.description}): trigger`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
    for (const code of row.policyCodes) {
      assert.ok(def!.required_policy_ids.includes(await policyDefinitionId(code)), `row ${row.row} (${row.description}): required_policy_ids should list ${code}`);
    }
  }
});

test("DEFINITION: there are exactly the table's Pack rows, and none publishes PackRegistered", async () => {
  const { rows } = await query<{ event_type: string | null }>("SELECT event_type FROM transition_definitions WHERE entity_type = 'Pack'");
  assert.equal(rows.length, PACK_TABLE.length);
  assert.ok(!rows.some((r) => r.event_type === "PackRegistered"), "PackRegistered is replaced by PackDefined");
});

test("DEFINITION: the Pack schema carries comments as a read-only array, and the form leaves it out", async () => {
  const { data: schemaRow } = await schemaDefinitionsDB.findLatest("Pack");
  const schema = schemaRow!.schema as JsonSchemaDocument;
  const comments = schema.properties?.comments;
  assert.ok(comments, "the Pack schema should describe comments");
  assert.equal(comments!.type, "array");
  assert.equal(comments!["x-read-only"], true);
  assert.deepEqual(Object.keys(comments!.items?.properties ?? {}).sort(), ["actorId", "authorityBadge", "createdAt", "text"]);
  assert.ok(!generateFields(schema, {}).some((f) => f.name === "comments"), "a read-only field must not be offered as an input");
});

test("BIRTH: the birth row is the only row from None and starts a Pack in Draft", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Pack");
  assert.equal(birth?.to_state, "Draft");
  assert.equal(birth?.event_type, "PackDefined");
});

test("BIRTH: an actor without pack_define is refused when creating a Pack, and no row is written", async () => {
  const packVersion = uniqueTestPackVersion();
  await assert.rejects(
    async () => createPackDraft(await freshPackSeed({ packVersion }), TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId),
    /does not hold pack_define/
  );
  const { rows } = await query<{ id: string }>("SELECT id FROM packs WHERE code = $1 AND pack_version = $2", ["test-pack", packVersion]);
  assert.equal(rows.length, 0);
});

test("DRIVEN: creation stores the birth to_state, starts with no comments and publishes PackDefined with the real actor and badge", async () => {
  const pack = await freshPack();
  const { data: row } = await packsDB.findById(pack.id);
  assert.equal(row?.status, "Draft");
  assert.deepEqual(row?.comments, []);

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", pack.id);
  assert.equal(events?.length, 1);
  assert.equal(events?.[0]?.event_type, "PackDefined");
  assert.equal(events?.[0]?.actor_id, ROOT_ACTOR_ID);
  assert.equal(events?.[0]?.authority_badge, ROOT_ACTOR_BADGE);
});

test("DRIVEN: row 2 (Edit) is a pure Revision — no event published", async () => {
  const pack = await freshPack();
  const { error } = await packsDB.updateDraftContent(pack.id, {
    code: pack.code,
    name: "Edited Test Pack",
    category: pack.category,
    packVersion: pack.pack_version,
    contributions: pack.contributions,
  });
  assert.equal(error, undefined);

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", pack.id);
  assert.equal(events?.length, 1, "still just the PackDefined event — Edit adds none");
});

test("DRIVEN: the five forward hops each publish their matching event through transitionEntity, as Pack objects", async () => {
  const pack = await freshPack();
  for (const toState of FORWARD_HOPS) {
    const result = await hop(pack.id, toState);
    assert.equal(result.ok, true, result.ok ? "" : `${toState}: ${"detail" in result ? result.detail : result.reason}`);
  }
  const { data: events } = await eventsDB.findByOriginatingObject("Pack", pack.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const row of PACK_TABLE.filter((r) => FORWARD_HOPS.includes(r.toState))) {
    assert.ok(eventTypes.includes(row.eventType), `expected ${row.eventType} among published events, got: ${eventTypes.join(", ")}`);
  }
  const { data: row } = await packsDB.findById(pack.id);
  assert.equal(row?.status, "Archived");
});

test("GUARD: Draft cannot go straight to Published, and a repeat Validate is refused", async () => {
  const pack = await freshPack();
  assert.deepEqual(outcome(await hop(pack.id, "Published")), { ok: false, reason: "no_transition_definition" });
  await hop(pack.id, "Validated");
  assert.deepEqual(outcome(await hop(pack.id, "Validated")), { ok: false, reason: "no_transition_definition" });
});

test("GUARD: a Retired or Archived Pack cannot return to Active", async () => {
  const pack = await freshPack();
  for (const toState of ["Validated", "Published", "Active", "Retired"]) await hop(pack.id, toState);
  assert.deepEqual(outcome(await hop(pack.id, "Active")), { ok: false, reason: "no_transition_definition" });
  await hop(pack.id, "Archived");
  assert.deepEqual(outcome(await hop(pack.id, "Active")), { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: Validate is refused to an actor without pack_validate", async () => {
  const pack = await freshPack();
  await assert.rejects(() => hop(pack.id, "Validated", undefined, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold pack_validate/);
  const { data: row } = await packsDB.findById(pack.id);
  assert.equal(row?.status, "Draft");
});

test("AUTHORITY: Reject is refused to an actor without pack_reject", async () => {
  const pack = await freshPack();
  await hop(pack.id, "Validated");
  await assert.rejects(() => hop(pack.id, "Draft", { comment: "not good enough" }, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold pack_reject/);
  const { data: row } = await packsDB.findById(pack.id);
  assert.equal(row?.status, "Validated");
  assert.deepEqual(row?.comments, []);
});

test("POLICY: a Pack with no pinned schema cannot be Validated (policy-validate-schema)", async () => {
  const pack = await freshPack();
  await query("UPDATE packs SET schema_definition_id = NULL WHERE id = $1", [pack.id]);
  assert.deepEqual(outcome(await hop(pack.id, "Validated")), { ok: false, reason: "policy_blocked" });
});

test("POLICY: a Pack that depends on a Pack code nobody offers cannot be Validated (referential-list check)", async () => {
  const pack = await freshPack();
  await query(`UPDATE packs SET dependencies = $2::jsonb WHERE id = $1`, [pack.id, JSON.stringify([{ packCode: `no-such-pack-${randomUUID()}`, version: "1.0.0", type: "required" }])]);
  assert.deepEqual(outcome(await hop(pack.id, "Validated")), { ok: false, reason: "policy_blocked" });
  const { data: row } = await packsDB.findById(pack.id);
  assert.equal(row?.status, "Draft");
});

test("POLICY: validateReferentialFields names the field and the value that no source offers", async () => {
  const { data: schemaRow } = await schemaDefinitionsDB.findLatest("Pack");
  const schema = schemaRow!.schema as JsonSchemaDocument;
  const unknown = `no-such-pack-${randomUUID()}`;
  const errors = await validateReferentialFields(schema, { code: "x", dependencies: [{ packCode: unknown, version: "1.0.0", type: "required" }] }, { isRoot: false, tenantId: PLATFORM_TENANT_ID });
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`"dependencies" row 1 "packCode": "${unknown}"`));
  assert.deepEqual(await validateReferentialFields(schema, { code: "x", dependencies: [] }, { isRoot: false, tenantId: PLATFORM_TENANT_ID }), []);
});

test("POLICY: an unknown checklist reference in a quality gate is reported, one the Pack declares is not", async () => {
  const { data: schemaRow } = await schemaDefinitionsDB.findLatest("Pack");
  const schema = schemaRow!.schema as JsonSchemaDocument;
  const viewer = { isRoot: false, tenantId: PLATFORM_TENANT_ID };
  const gate = (checklistIds: string[]) => ({ name: "gate", prompt: "p", category: "", checklistIds });
  const unknown = await validateReferentialFields(schema, { code: "x", contributionQualityGates: [gate([randomUUID()])] }, viewer);
  assert.ok(unknown.some((e) => /checklist/i.test(e)), `expected a Checklist error, got: ${unknown.join("; ")}`);
  const declared = await validateReferentialFields(schema, { code: "x", contributionChecklists: [{ name: "own-list", items: [] }], contributionQualityGates: [gate(["own-list"])] }, viewer);
  assert.ok(!declared.some((e) => /checklist/i.test(e)), `a declared checklist must pass, got: ${declared.join("; ")}`);
});

test("POLICY: loadPolicyChecks reads each Pack policy on its own hop only", async () => {
  const schemaId = await policyDefinitionId(VALIDATE_SCHEMA_POLICY_CODE);
  for (const hopKey of ["Pack|Draft|Validated", "Pack|Validated|Published"]) {
    const checks = await loadPolicyChecks([schemaId], hopKey);
    assert.equal(checks.length, 1, hopKey);
    assert.deepEqual(checks[0].condition, { type: "implemented" });
  }
  assert.deepEqual(await loadPolicyChecks([schemaId], "Pack|Active|Retired"), []);

  const ontologyId = await policyDefinitionId(ONTOLOGY_VALUES_PRESENT_POLICY_CODE);
  assert.equal((await loadPolicyChecks([ontologyId], "Pack|Validated|Published")).length, 1);
  assert.deepEqual(await loadPolicyChecks([ontologyId], "Pack|Draft|Validated"), []);

  const commentId = await policyDefinitionId(COMMENT_REQUIRED_POLICY_CODE);
  assert.equal((await loadPolicyChecks([commentId], "Pack|Validated|Draft")).length, 1);
  assert.deepEqual(await loadPolicyChecks([commentId], "Pack|Validated|Published"), []);
});

test("POLICY: policy-ontology-values-present is true for a Pack whose composable values are in the Ontology", async () => {
  const pack = await freshPack();
  assert.equal(await evaluateImplementedPolicy(ONTOLOGY_VALUES_PRESENT_POLICY_CODE, { entityType: "Pack", entityId: pack.id, context: {} }), true);
});

test("POLICY: policy-comment-required is true for a comment with text and false for none, blank or non-text", async () => {
  const input = (context: Record<string, unknown>) => ({ entityType: "Pack", entityId: undefined, context });
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: "needs a clearer description" })), true);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({})), false);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: "   " })), false);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: 42 })), false);
});

test("COMMENTS: Reject without a comment is refused and changes nothing; with a comment it returns the Pack to Draft and keeps the comment", async () => {
  const pack = await freshPack();
  await hop(pack.id, "Validated");

  assert.deepEqual(outcome(await hop(pack.id, "Draft")), { ok: false, reason: "policy_blocked" });
  assert.deepEqual(outcome(await hop(pack.id, "Draft", { comment: "   " })), { ok: false, reason: "policy_blocked" });
  const { data: refused } = await packsDB.findById(pack.id);
  assert.equal(refused?.status, "Validated");
  assert.deepEqual(refused?.comments, []);

  const result = await hop(pack.id, "Draft", { comment: "  the description is unclear  " });
  assert.equal(result.ok, true, result.ok ? "" : `${"detail" in result ? result.detail : result.reason}`);
  const { data: row } = await packsDB.findById(pack.id);
  assert.equal(row?.status, "Draft");
  assert.equal(row?.comments.length, 1);
  assert.equal(row?.comments[0].text, "the description is unclear");
  assert.equal(row?.comments[0].actorId, TESTER_ALL_ID);
  assert.ok(row?.comments[0].createdAt, "a comment records when it was added");

  // The comment carries the badge the transition was recorded under (root for a root actor).
  const { data: events } = await eventsDB.findByOriginatingObject("Pack", pack.id);
  const rejected = events?.find((e) => e.event_type === "PackRejected");
  assert.ok(rejected, "expected a PackRejected event");
  assert.equal(row?.comments[0].authorityBadge, rejected!.authority_badge);
});

test("COMMENTS: comments are added, never replaced, and the same text may be given again", async () => {
  const pack = await freshPack();
  await hop(pack.id, "Validated", { comment: "validated after the first read" });
  await hop(pack.id, "Draft", { comment: "needs work" });
  await hop(pack.id, "Validated");
  await hop(pack.id, "Draft", { comment: "needs work" });
  const { data: row } = await packsDB.findById(pack.id);
  assert.deepEqual(row?.comments.map((c) => c.text), ["validated after the first read", "needs work", "needs work"]);
});

test("COMMENTS: a comment given with a refused transition is not stored (the gate runs first)", async () => {
  const pack = await freshPack();
  await hop(pack.id, "Validated");
  await query("UPDATE packs SET schema_definition_id = NULL WHERE id = $1", [pack.id]);
  // Publish is blocked by policy-validate-schema, so the comment given with it is not stored.
  assert.deepEqual(outcome(await hop(pack.id, "Published", { comment: "should not be kept" })), { ok: false, reason: "policy_blocked" });
  const { data: row } = await packsDB.findById(pack.id);
  assert.deepEqual(row?.comments, []);
});

test("PUBLISH STEP: from Draft it moves to Validated; from Validated it asks for a choice; from Published it activates and retires the previous Active version", async () => {
  // Pack code must be an Ontology engineering-name concept, so a seeded one is reused and versions tell the rows apart.
  await ensureTestFixturePacks();
  const code = "test-pack-supersede";
  const first = await freshPack({ code });
  for (const toState of ["Validated", "Published", "Active"]) await hop(first.id, toState);

  const second = await freshPack({ code });
  const toValidated = await publishAuthoringDraft({ kind: "Pack", id: second.id, actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: toValidated.ok, status: toValidated.ok ? toValidated.status : null }, { ok: true, status: "Validated" });
  const choose = await publishAuthoringDraft({ kind: "Pack", id: second.id, actorId: TESTER_ALL_ID });
  assert.equal(choose.ok, false);
  if (!choose.ok) assert.match(choose.errors.join(" "), /more than one next step/);

  await hop(second.id, "Published");
  const activated = await publishAuthoringDraft({ kind: "Pack", id: second.id, actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: activated.ok, status: activated.ok ? activated.status : null }, { ok: true, status: "Active" });
  const { data: previous } = await packsDB.findById(first.id);
  assert.equal(previous?.status, "Retired");
});

test("BUTTONS: Pack buttons are the manual next transitions the actor holds; Reject asks for a comment", async () => {
  assert.deepEqual((await nextActionsFor("Pack", "Draft", TESTER_ALL_ID)).map((a) => a.toState), ["Validated"]);
  assert.deepEqual(await nextActionsFor("Pack", "Draft", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  const actions = await computeRowActions("Pack", "Validated", TESTER_ALL_ID);
  assert.deepEqual(
    actions.map((a) => ({ toState: a.toState, endpoint: a.endpoint, requiresComment: a.requiresComment })).sort((a, b) => a.toState.localeCompare(b.toState)),
    [
      { toState: "Draft", endpoint: "transition", requiresComment: true },
      { toState: "Published", endpoint: "transition", requiresComment: false },
    ]
  );
});
