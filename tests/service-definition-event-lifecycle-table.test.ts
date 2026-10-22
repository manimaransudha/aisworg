// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.11. An executable check of Service
// Definition's own transition_definitions rows, including the birth row, the Validated state, the reject hop, the
// schema policy and the comment policy.
//
// Scope note (definition vs execution, Ch.11 §18.9): this file covers SERVICE DEFINITION, the canonical, versioned
// catalog entry a Pack's contributionServices[] picks by code. It does not cover the separate `services` table.
//
//   - DEFINITION: every row's transition_definitions record matches the table.
//   - DRIVEN: creation goes through a real call site (copyServiceDefinitionAsNewDraft), which reads the birth row.
//     Every hop runs through transitionEntity. The events are asserted against eventsDB directly. No mocking.
//   - POLICY: policy-validate-schema and policy-comment-required refuse what they should.
//   - COMMENTS: a comment is added only with a transition, is kept, and is never replaced.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionRow } from "../src/dblayer/seuTypes.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { copyServiceDefinitionAsNewDraft } from "../src/routes/seu/core/serviceDefinitions.js";
import { computeRowActions, publishAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { evaluateImplementedPolicy } from "../src/policies/index.js";
import { generateFields, type JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";
import { COMMENT_REQUIRED_POLICY_CODE, VALIDATE_SCHEMA_POLICY_CODE } from "../src/dblayer/constants.js";
import { query } from "../src/utils/db.js";
import { TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

// serviceDefinitionsDB.createDraft is a raw DB-layer insert (no validateServiceDefinitionSeed call), the same "bare
// Draft, one hop at a time" fixture pattern the other lifecycle tests use. createDraft still enforces the schema's own
// x-ontology fields, so capabilityCode below is a real registered capability-name code.
// Deliberately the baseline (lowest) schema version, not findLatest: a row pins the exact schema version it was
// authored against, and a stray schema-registry test can add newer, Ontology-blind versions.
async function requireServiceSchema(): Promise<SchemaDefinitionRow> {
  const { data: versions } = await schemaDefinitionsDB.findAllVersions("Service");
  const baseline = (versions ?? []).reduce<SchemaDefinitionRow | undefined>((lowest, v) => (!lowest || v.version < lowest.version ? v : lowest), undefined);
  if (!baseline) throw new Error("no schema_definitions grammar for Service");
  return baseline;
}

async function birthState(): Promise<string> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Service");
  if (!birth) throw new Error("no birth Transition Definition for Service");
  return birth.to_state;
}

async function freshServiceDefinitionDraft(): Promise<{ id: string; code: string }> {
  const { data: draft, error } = await serviceDefinitionsDB.createDraft({
    tenantId: PLATFORM_TENANT_ID,
    code: `test-service-definition-lifecycle-${randomUUID()}`,
    name: "Test Service Definition",
    capabilityCode: "requirements-analysis",
    schemaDefinitionId: (await requireServiceSchema()).id,
    status: (await birthState()) as never,
    authoredBy: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
  });
  if (error || !draft) throw error ?? new Error("failed to create Service Definition draft");
  return { id: draft.id, code: draft.code };
}

async function hop(id: string, targetState: string, context?: Record<string, unknown>, actorId = TESTER_ALL_ID) {
  return transitionAndPublish({ entityType: "Service", entityId: id, targetState, actorId, context });
}

function outcome(r: Awaited<ReturnType<typeof hop>>): { ok: boolean; reason: string | null } {
  return { ok: r.ok, reason: r.ok ? null : r.reason };
}

async function policyDefinitionId(code: string): Promise<string> {
  const { data } = await policyDefinitionsDB.findActiveByCodeVisibleTo(code, PLATFORM_TENANT_ID);
  assert.ok(data, `no Active Policy Definition ${code}`);
  return data!.id;
}

interface ServiceDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
}

const SERVICE_DEFINITION_TABLE: ServiceDefinitionTableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Defined", verb: "define", eventType: "ServiceDefined", versionEvent: null, policyCodes: [] },
  { row: 2, description: "Validate", fromState: "Defined", toState: "Validated", verb: "validate", eventType: "ServiceValidated", versionEvent: "VersionValidated", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 3, description: "Publish", fromState: "Validated", toState: "Published", verb: "publish", eventType: "ServicePublished", versionEvent: "VersionPublished", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 4, description: "Reject", fromState: "Validated", toState: "Defined", verb: "reject", eventType: "ServiceRejected", versionEvent: null, policyCodes: [COMMENT_REQUIRED_POLICY_CODE] },
  { row: 5, description: "Activate", fromState: "Published", toState: "Active", verb: "activate", eventType: "ServiceActivated", versionEvent: "VersionActivated", policyCodes: [] },
  { row: 6, description: "Deprecate", fromState: "Active", toState: "Deprecated", verb: "deprecate", eventType: "ServiceDeprecated", versionEvent: "VersionDeprecated", policyCodes: [] },
  { row: 7, description: "Retire", fromState: "Deprecated", toState: "Retired", verb: "retire", eventType: "ServiceRetired", versionEvent: "VersionSuperseded", policyCodes: [] },
  { row: 8, description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", eventType: "ServiceArchived", versionEvent: "VersionArchived", policyCodes: [] },
];

// The forward hops, in order, after the birth row.
const FORWARD_HOPS = ["Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

test("DEFINITION: every Service transition_definitions row matches its own verb, trigger, event_type, version_event and policies", async () => {
  for (const row of SERVICE_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Service", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Service ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.verb, row.verb, `row ${row.row} (${row.description}): verb`);
    assert.equal(def!.trigger, "manual", `row ${row.row} (${row.description}): trigger`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
    for (const code of row.policyCodes) {
      assert.ok(def!.required_policy_ids.includes(await policyDefinitionId(code)), `row ${row.row} (${row.description}): required_policy_ids should list ${code}`);
    }
  }
  const { data: skipped } = await transitionDefinitionsDB.find("Service", "Defined", "Published");
  assert.equal(skipped, null, "Defined -> Published must not exist: a Service is Validated first");
});

test("DEFINITION: no Service event is named ServiceDefinition*, and there are exactly the table's rows", async () => {
  const { rows } = await query<{ event_type: string | null }>("SELECT event_type FROM transition_definitions WHERE entity_type = 'Service'");
  assert.equal(rows.length, SERVICE_DEFINITION_TABLE.length);
  for (const r of rows) {
    assert.ok(r.event_type?.startsWith("Service"), `event ${r.event_type} should start with Service`);
    assert.ok(!r.event_type!.startsWith("ServiceDefinition"), `event ${r.event_type} must not use the ServiceDefinition prefix`);
  }
});

test("DEFINITION: the Service schema carries comments as a read-only array, and the form leaves it out", async () => {
  const schema = (await requireServiceSchema()).schema as JsonSchemaDocument;
  const comments = schema.properties?.comments;
  assert.ok(comments, "the Service schema should describe comments");
  assert.equal(comments!.type, "array");
  assert.equal(comments!["x-read-only"], true);
  assert.deepEqual(Object.keys(comments!.items?.properties ?? {}).sort(), ["actorId", "authorityBadge", "createdAt", "text"]);
  assert.ok(!generateFields(schema, {}).some((f) => f.name === "comments"), "a read-only field must not be offered as an input");
});

test("BIRTH: the birth row is the only row from None, and every seeded Service Definition went through it", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Service");
  assert.equal(birth?.to_state, "Defined");
  const { data: seeded } = await serviceDefinitionsDB.findActivePlatformOwned();
  assert.ok((seeded ?? []).length > 0, "expected seeded baseline Service Definitions");
  const { data: events } = await eventsDB.findByOriginatingObject("Service", seeded![0].id);
  const types = (events ?? []).map((e) => e.event_type);
  for (const expected of ["ServiceDefined", "ServiceValidated", "ServicePublished", "ServiceActivated"]) {
    assert.ok(types.includes(expected), `seeded Service Definition should have published ${expected}, got: ${types.join(", ")}`);
  }
});

test("BIRTH: an actor without service_define is refused when copying a Service Definition, and no row is written", async () => {
  const source = await freshServiceDefinitionDraft();
  const { data: before } = await serviceDefinitionsDB.findAll();
  await assert.rejects(
    () => copyServiceDefinitionAsNewDraft(source.id, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId),
    /does not hold service_define/
  );
  const { data: after } = await serviceDefinitionsDB.findAll();
  assert.equal((after ?? []).length, (before ?? []).length);
});

test("DRIVEN: creation through copyServiceDefinitionAsNewDraft stores the birth to_state, starts with no comments and publishes ServiceDefined with the real actor and badge", async () => {
  const source = await freshServiceDefinitionDraft();
  const copy = await copyServiceDefinitionAsNewDraft(source.id, ROOT_ACTOR_ID);
  assert.equal(copy.ok, true, copy.ok ? "" : copy.errors.join("; "));
  if (!copy.ok) return;

  const { data: row } = await serviceDefinitionsDB.findById(copy.draftId);
  assert.equal(row?.status, await birthState());
  assert.deepEqual(row?.comments, []);

  const { data: events } = await eventsDB.findByOriginatingObject("Service", copy.draftId);
  const defined = events?.find((e) => e.event_type === "ServiceDefined");
  assert.ok(defined, "expected a ServiceDefined event");
  assert.equal(defined!.actor_id, ROOT_ACTOR_ID);
  assert.equal(defined!.authority_badge, ROOT_ACTOR_BADGE);
  const { data: legacy } = await eventsDB.findByOriginatingObject("ServiceDefinition", copy.draftId);
  assert.equal(legacy?.length ?? 0, 0, "no event may carry the ServiceDefinition object type");
});

// Regression: inputs/outputs are TEXT[] NOT NULL (migration 159), and must round-trip as real string arrays.
test("REGRESSION: Service Definition inputs/outputs round-trip as real string arrays, not a bare string", async () => {
  const { data: draft, error } = await serviceDefinitionsDB.createDraft({
    tenantId: PLATFORM_TENANT_ID,
    code: `test-service-definition-io-${randomUUID()}`,
    name: "Test Service Definition IO",
    capabilityCode: "requirements-analysis",
    inputs: ["requirements-specification", "domain-model"],
    outputs: ["source-code"],
    schemaDefinitionId: (await requireServiceSchema()).id,
    status: (await birthState()) as never,
    authoredBy: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.equal(error, undefined);
  assert.deepEqual(draft?.inputs, ["requirements-specification", "domain-model"]);
  assert.deepEqual(draft?.outputs, ["source-code"]);

  const { data: bare, error: bareError } = await serviceDefinitionsDB.createDraft({
    tenantId: PLATFORM_TENANT_ID,
    code: `test-service-definition-io-bare-${randomUUID()}`,
    name: "Test Service Definition IO Bare",
    capabilityCode: "requirements-analysis",
    schemaDefinitionId: (await requireServiceSchema()).id,
    status: (await birthState()) as never,
    authoredBy: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.equal(bareError, undefined);
  assert.deepEqual(bare?.inputs, []);
  assert.deepEqual(bare?.outputs, []);
});

test("DRIVEN: the six forward hops each publish their matching event through transitionEntity, as Service objects", async () => {
  const draft = await freshServiceDefinitionDraft();
  for (const toState of FORWARD_HOPS) {
    const result = await hop(draft.id, toState);
    assert.equal(result.ok, true, result.ok ? "" : `${toState}: ${"detail" in result ? result.detail : result.reason}`);
  }
  const { data: events } = await eventsDB.findByOriginatingObject("Service", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const row of SERVICE_DEFINITION_TABLE.filter((r) => FORWARD_HOPS.includes(r.toState))) {
    assert.ok(eventTypes.includes(row.eventType), `expected ${row.eventType} among published events, got: ${eventTypes.join(", ")}`);
  }
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Archived");
});

test("GUARD: Defined cannot go straight to Published, and a repeat Validate is refused", async () => {
  const draft = await freshServiceDefinitionDraft();
  assert.deepEqual(outcome(await hop(draft.id, "Published")), { ok: false, reason: "no_transition_definition" });
  await hop(draft.id, "Validated");
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "no_transition_definition" });
});

test("GUARD: the lifecycle has no back-edge other than reject: Active cannot return to Published", async () => {
  const draft = await freshServiceDefinitionDraft();
  for (const toState of ["Validated", "Published", "Active"]) await hop(draft.id, toState);
  assert.deepEqual(outcome(await hop(draft.id, "Published")), { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: Validate is refused to an actor without service_validate", async () => {
  const draft = await freshServiceDefinitionDraft();
  await assert.rejects(() => hop(draft.id, "Validated", undefined, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold service_validate/);
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Defined");
});

test("AUTHORITY: Reject is refused to an actor without service_reject", async () => {
  const draft = await freshServiceDefinitionDraft();
  await hop(draft.id, "Validated");
  await assert.rejects(() => hop(draft.id, "Defined", { comment: "not good enough" }, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold service_reject/);
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Validated");
  assert.deepEqual(row?.comments, []);
});

test("POLICY: a Service Definition with no pinned schema cannot be Validated (policy-validate-schema)", async () => {
  const draft = await freshServiceDefinitionDraft();
  await query("UPDATE service_definitions SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "policy_blocked" });
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Defined");
});

test("POLICY: a Service Definition whose capabilityCode left the Ontology cannot be Validated", async () => {
  const draft = await freshServiceDefinitionDraft();
  await query("UPDATE service_definitions SET capability_code = $2 WHERE id = $1", [draft.id, `not-a-real-capability-${randomUUID()}`]);
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "policy_blocked" });
});

test("POLICY: loadPolicyChecks reads each Service policy on its own hop only", async () => {
  const schemaId = await policyDefinitionId(VALIDATE_SCHEMA_POLICY_CODE);
  for (const hopKey of ["Service|Defined|Validated", "Service|Validated|Published"]) {
    const checks = await loadPolicyChecks([schemaId], hopKey);
    assert.equal(checks.length, 1, hopKey);
    assert.deepEqual(checks[0].condition, { type: "implemented" });
  }
  assert.deepEqual(await loadPolicyChecks([schemaId], "Service|Active|Deprecated"), []);

  const commentId = await policyDefinitionId(COMMENT_REQUIRED_POLICY_CODE);
  assert.equal((await loadPolicyChecks([commentId], "Service|Validated|Defined")).length, 1);
  assert.deepEqual(await loadPolicyChecks([commentId], "Service|Validated|Published"), []);
});

test("POLICY: policy-comment-required is true for a comment with text and false for none, blank or non-text", async () => {
  const input = (context: Record<string, unknown>) => ({ entityType: "Service", entityId: undefined, context });
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: "needs the inputs listed" })), true);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({})), false);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: "   " })), false);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: 42 })), false);
});

test("COMMENTS: Reject without a comment is refused and changes nothing; with a comment it returns the row to Defined and keeps the comment", async () => {
  const draft = await freshServiceDefinitionDraft();
  await hop(draft.id, "Validated");

  assert.deepEqual(outcome(await hop(draft.id, "Defined")), { ok: false, reason: "policy_blocked" });
  assert.deepEqual(outcome(await hop(draft.id, "Defined", { comment: "   " })), { ok: false, reason: "policy_blocked" });
  const { data: refused } = await serviceDefinitionsDB.findById(draft.id);
  assert.equal(refused?.status, "Validated");
  assert.deepEqual(refused?.comments, []);

  const result = await hop(draft.id, "Defined", { comment: "  the outputs are not listed  " });
  assert.equal(result.ok, true, result.ok ? "" : `${"detail" in result ? result.detail : result.reason}`);
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Defined");
  assert.equal(row?.comments.length, 1);
  assert.equal(row?.comments[0].text, "the outputs are not listed");
  assert.equal(row?.comments[0].actorId, TESTER_ALL_ID);
  assert.ok(row?.comments[0].createdAt, "a comment records when it was added");

  // The comment carries the badge the transition was recorded under (root for a root actor).
  const { data: events } = await eventsDB.findByOriginatingObject("Service", draft.id);
  const rejected = events?.find((e) => e.event_type === "ServiceRejected");
  assert.ok(rejected, "expected a ServiceRejected event");
  assert.equal(row?.comments[0].authorityBadge, rejected!.authority_badge);
});

test("COMMENTS: comments are added, never replaced, and a comment on any transition is kept", async () => {
  const draft = await freshServiceDefinitionDraft();
  await hop(draft.id, "Validated", { comment: "validated after the first read" });
  await hop(draft.id, "Defined", { comment: "first rejection" });
  await hop(draft.id, "Validated");
  await hop(draft.id, "Defined", { comment: "second rejection" });
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.deepEqual(row?.comments.map((c) => c.text), ["validated after the first read", "first rejection", "second rejection"]);
});

test("COMMENTS: a comment given with a refused transition is not stored (the gate runs first)", async () => {
  const draft = await freshServiceDefinitionDraft();
  await hop(draft.id, "Validated");
  await query("UPDATE service_definitions SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  // Publish is blocked by policy-validate-schema, so the comment given with it is not stored.
  assert.deepEqual(outcome(await hop(draft.id, "Published", { comment: "should not be kept" })), { ok: false, reason: "policy_blocked" });
  const { data: row } = await serviceDefinitionsDB.findById(draft.id);
  assert.deepEqual(row?.comments, []);
});

test("ONTOLOGY: activating a Service Definition does not write a service-name concept (the Ontology owns the names)", async () => {
  const draft = await freshServiceDefinitionDraft();
  for (const toState of ["Validated", "Published", "Active"]) {
    const result = await hop(draft.id, toState);
    assert.equal(result.ok, true, result.ok ? "" : `${toState}: ${"detail" in result ? result.detail : result.reason}`);
  }
  const { data: concepts } = await ontologyDB.findConceptsByType("service-name", { isRoot: true, tenantId: PLATFORM_TENANT_ID }, { includeInactive: true });
  assert.ok(!(concepts ?? []).some((c) => c.code === draft.code), "no service-name concept should be created by activation");
});

test("PUBLISH STEP: from Defined the publish step moves to Validated; from Validated it asks for a choice", async () => {
  const draft = await freshServiceDefinitionDraft();
  const first = await publishAuthoringDraft({ kind: "Service", id: draft.id, actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: first.ok, status: first.ok ? first.status : null }, { ok: true, status: "Validated" });
  const second = await publishAuthoringDraft({ kind: "Service", id: draft.id, actorId: TESTER_ALL_ID });
  assert.equal(second.ok, false);
  if (!second.ok) assert.match(second.errors.join(" "), /more than one next step/);
});

test("BUTTONS: Service buttons are the manual next transitions the actor holds; Reject asks for a comment", async () => {
  assert.deepEqual((await nextActionsFor("Service", "Defined", TESTER_ALL_ID)).map((a) => a.toState), ["Validated"]);
  assert.deepEqual(await nextActionsFor("Service", "Defined", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  const actions = await computeRowActions("Service", "Validated", TESTER_ALL_ID);
  assert.deepEqual(
    actions.map((a) => ({ toState: a.toState, endpoint: a.endpoint, requiresComment: a.requiresComment })).sort((a, b) => a.toState.localeCompare(b.toState)),
    [
      { toState: "Defined", endpoint: "transition", requiresComment: true },
      { toState: "Published", endpoint: "transition", requiresComment: false },
    ]
  );
});
