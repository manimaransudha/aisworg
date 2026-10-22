// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.15. An executable check of Deliverable
// Definition's own transition_definitions rows (entity type DeliverableDefinition), including the birth row, the schema
// policy and the composable-value policy.
//
// Scope note: this file covers the DELIVERABLE DEFINITION, the authored catalogue entry. It does not cover the runtime
// Deliverable (the `deliverables` table), which the Execution Engine moves.
//
//   - DEFINITION: every row's transition_definitions record matches the table.
//   - DRIVEN: creation goes through a real call site (copyDeliverableDefinitionAsNewDraft), which reads the birth row.
//     Every hop runs through transitionEntity. The events are asserted against eventsDB directly. No mocking.
//   - POLICY: policy-validate-schema and policy-ontology-values-present refuse what they should, on their own hops only.
//   - BUTTONS: the buttons are the manual next transitions the actor holds.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool, { query } from "../src/utils/db.js";
import { deliverableDefinitionsDB } from "../src/dblayer/deliverableDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { copyDeliverableDefinitionAsNewDraft } from "../src/routes/seu/core/deliverableDefinitions.js";
import { computeRowActions } from "../src/routes/seu/core/sdkAuthoring.js";
import { syncConceptFromEntity } from "../src/routes/seu/core/ontology.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { ONTOLOGY_VALUES_PRESENT_POLICY_CODE, VALIDATE_SCHEMA_POLICY_CODE } from "../src/dblayer/constants.js";
import { TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

const createdIds: string[] = [];
const createdConceptCodes: string[] = [];

after(async () => {
  if (createdIds.length) {
    await pool.query("UPDATE deliverable_definitions SET parent_deliverable_definition_id = NULL WHERE id = ANY($1::uuid[])", [createdIds]);
    await pool.query("DELETE FROM version_events WHERE entity_type = 'DeliverableDefinition' AND entity_id = ANY($1::uuid[])", [createdIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'DeliverableDefinition' AND originating_object_id = ANY($1::uuid[])", [createdIds]);
    await pool.query("DELETE FROM deliverable_definitions WHERE id = ANY($1::uuid[])", [createdIds]);
  }
  if (createdConceptCodes.length) await pool.query("DELETE FROM ontology_concepts WHERE concept_type = 'deliverable-name' AND code = ANY($1::text[])", [createdConceptCodes]);
});

async function birthState(): Promise<string> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("DeliverableDefinition");
  if (!birth) throw new Error("no birth Transition Definition for DeliverableDefinition");
  return birth.to_state;
}

// deliverableDefinitionsDB.createDraft is a raw DB-layer insert, the same "bare Draft, one hop at a time" fixture the other lifecycle tests use.
// The code is a composable Ontology value, so a concept is registered for it when the hops must reach Published.
async function freshDefinitionDraft(options: { inOntology: boolean } = { inOntology: true }): Promise<{ id: string; code: string }> {
  const { data: schema } = await schemaDefinitionsDB.findLatest("Deliverable");
  if (!schema) throw new Error("no schema_definitions grammar for Deliverable");
  const code = `test-deliverable-lifecycle-${randomUUID()}`;
  if (options.inOntology) {
    createdConceptCodes.push(code);
    await syncConceptFromEntity("deliverable-name", code, code, "A lifecycle test Deliverable.", PLATFORM_TENANT_ID, ROOT_ACTOR_ID);
  }
  const { data: draft, error } = await deliverableDefinitionsDB.createDraft({
    tenantId: PLATFORM_TENANT_ID,
    code,
    description: "A lifecycle test Deliverable.",
    version: "1.0.0",
    status: (await birthState()) as never,
    authoredBy: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
    schemaDefinitionId: schema.id,
  });
  if (error || !draft) throw error ?? new Error("failed to create Deliverable Definition draft");
  createdIds.push(draft.id);
  return { id: draft.id, code };
}

async function hop(id: string, targetState: string, actorId = TESTER_ALL_ID) {
  return transitionAndPublish({ entityType: "DeliverableDefinition", entityId: id, targetState, actorId });
}

function outcome(r: Awaited<ReturnType<typeof hop>>): { ok: boolean; reason: string | null } {
  return { ok: r.ok, reason: r.ok ? null : r.reason };
}

async function policyDefinitionId(code: string): Promise<string> {
  const { data } = await policyDefinitionsDB.findActiveByCodeVisibleTo(code, PLATFORM_TENANT_ID);
  assert.ok(data, `no Active Policy Definition ${code}`);
  return data!.id;
}

interface TableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
}

const DELIVERABLE_DEFINITION_TABLE: TableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Draft", verb: "define", eventType: "DeliverableDefinitionDefined", versionEvent: null, policyCodes: [] },
  { row: 2, description: "Validate", fromState: "Draft", toState: "Validated", verb: "validate", eventType: "DeliverableDefinitionValidated", versionEvent: "VersionValidated", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 3, description: "Publish", fromState: "Validated", toState: "Published", verb: "publish", eventType: "DeliverableDefinitionPublished", versionEvent: "VersionPublished", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE] },
  { row: 4, description: "Activate", fromState: "Published", toState: "Active", verb: "activate", eventType: "DeliverableDefinitionActivated", versionEvent: "VersionActivated", policyCodes: [] },
  { row: 5, description: "Deprecate", fromState: "Active", toState: "Deprecated", verb: "deprecate", eventType: "DeliverableDefinitionDeprecated", versionEvent: "VersionDeprecated", policyCodes: [] },
  { row: 6, description: "Retire", fromState: "Deprecated", toState: "Retired", verb: "retire", eventType: "DeliverableDefinitionRetired", versionEvent: "VersionSuperseded", policyCodes: [] },
  { row: 7, description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", eventType: "DeliverableDefinitionArchived", versionEvent: "VersionArchived", policyCodes: [] },
];

// The forward hops, in order, after the birth row.
const FORWARD_HOPS = DELIVERABLE_DEFINITION_TABLE.filter((r) => r.fromState !== "None");

test("DEFINITION: every DeliverableDefinition transition_definitions row matches its own verb, trigger, event_type, version_event and policies", async () => {
  for (const row of DELIVERABLE_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("DeliverableDefinition", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for DeliverableDefinition ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
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

test("DEFINITION: there are exactly the table's rows, and no reactivation row", async () => {
  const { rows } = await query<{ event_type: string | null }>("SELECT event_type FROM transition_definitions WHERE entity_type = 'DeliverableDefinition'");
  assert.equal(rows.length, DELIVERABLE_DEFINITION_TABLE.length);
  for (const from of ["Deprecated", "Retired", "Archived"]) {
    const { data: reactivation } = await transitionDefinitionsDB.find("DeliverableDefinition", from, "Active");
    assert.equal(reactivation, null, `${from} -> Active must not exist: a terminal Definition is not reactivated`);
  }
});

test("DEFINITION: the runtime Deliverable keeps its own rows, apart from the Definition", async () => {
  const { rows } = await query<{ from_state: string }>("SELECT from_state FROM transition_definitions WHERE entity_type = 'Deliverable' ORDER BY from_state");
  assert.deepEqual(rows.map((r) => r.from_state).sort(), ["Approved", "Defined", "In Progress", "None"]);
});

test("BIRTH: the birth row is the only row from None and starts a Deliverable Definition in Draft", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("DeliverableDefinition");
  assert.equal(birth?.to_state, "Draft");
  assert.equal(birth?.event_type, "DeliverableDefinitionDefined");
});

test("BIRTH: an actor without deliverabledefinition_define is refused when copying a Deliverable Definition, and no row is written", async () => {
  const source = await freshDefinitionDraft();
  const { data: before } = await deliverableDefinitionsDB.findAll();
  await assert.rejects(
    () => copyDeliverableDefinitionAsNewDraft(source.id, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId),
    /does not hold deliverabledefinition_define/
  );
  const { data: after } = await deliverableDefinitionsDB.findAll();
  assert.equal((after ?? []).length, (before ?? []).length);
});

test("DRIVEN: creation through copyDeliverableDefinitionAsNewDraft stores the birth to_state and publishes DeliverableDefinitionDefined with the real actor and badge", async () => {
  const source = await freshDefinitionDraft();
  const copy = await copyDeliverableDefinitionAsNewDraft(source.id, ROOT_ACTOR_ID);
  assert.equal(copy.ok, true, copy.ok ? "" : copy.errors.join("; "));
  if (!copy.ok) return;
  createdIds.push(copy.draftId);

  const { data: row } = await deliverableDefinitionsDB.findById(copy.draftId);
  assert.equal(row?.status, await birthState());

  const { data: events } = await eventsDB.findByOriginatingObject("DeliverableDefinition", copy.draftId);
  const defined = events?.find((e) => e.event_type === "DeliverableDefinitionDefined");
  assert.ok(defined, "expected a DeliverableDefinitionDefined event");
  assert.equal(defined!.actor_id, ROOT_ACTOR_ID);
  assert.equal(defined!.authority_badge, ROOT_ACTOR_BADGE);
  const { data: runtime } = await eventsDB.findByOriginatingObject("Deliverable", copy.draftId);
  assert.equal(runtime?.length ?? 0, 0, "no Definition event may carry the Deliverable object type");
});

test("DRIVEN: the six forward hops each publish their matching event through transitionEntity, as DeliverableDefinition objects", async () => {
  const draft = await freshDefinitionDraft();
  for (const row of FORWARD_HOPS) {
    const result = await hop(draft.id, row.toState);
    assert.equal(result.ok, true, result.ok ? "" : `row ${row.row} (${row.description}): ${result.reason}: ${"detail" in result ? result.detail : ""}`);
  }
  const { data: events } = await eventsDB.findByOriginatingObject("DeliverableDefinition", draft.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), FORWARD_HOPS.map((row) => row.eventType));
});

test("GUARD: Draft cannot go straight to Published, and a terminal Deliverable Definition cannot be reactivated", async () => {
  const draft = await freshDefinitionDraft();
  assert.deepEqual(outcome(await hop(draft.id, "Published")), { ok: false, reason: "no_transition_definition" });
  for (const row of FORWARD_HOPS) await hop(draft.id, row.toState);
  assert.deepEqual(outcome(await hop(draft.id, "Active")), { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: Validate is refused to an actor without deliverabledefinition_validate", async () => {
  const draft = await freshDefinitionDraft();
  await assert.rejects(() => hop(draft.id, "Validated", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold deliverabledefinition_validate/);
  const { data: row } = await deliverableDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
});

test("POLICY: a Deliverable Definition with no pinned schema cannot be Validated (policy-validate-schema)", async () => {
  const draft = await freshDefinitionDraft();
  await query("UPDATE deliverable_definitions SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "policy_blocked" });
  const { data: row } = await deliverableDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
});

test("POLICY: a Deliverable Definition whose code is not in the Ontology can be Validated but not Published (policy-ontology-values-present)", async () => {
  const draft = await freshDefinitionDraft({ inOntology: false });
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: true, reason: null });
  assert.deepEqual(outcome(await hop(draft.id, "Published")), { ok: false, reason: "policy_blocked" });
  const { data: row } = await deliverableDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Validated");
});

test("POLICY: loadPolicyChecks reads each Deliverable Definition policy on its own hop only", async () => {
  const schemaId = await policyDefinitionId(VALIDATE_SCHEMA_POLICY_CODE);
  for (const hopKey of ["DeliverableDefinition|Draft|Validated", "DeliverableDefinition|Validated|Published"]) {
    const checks = await loadPolicyChecks([schemaId], hopKey);
    assert.equal(checks.length, 1, hopKey);
    assert.deepEqual(checks[0].condition, { type: "implemented" });
  }
  assert.deepEqual(await loadPolicyChecks([schemaId], "DeliverableDefinition|Active|Deprecated"), []);

  const ontologyId = await policyDefinitionId(ONTOLOGY_VALUES_PRESENT_POLICY_CODE);
  assert.equal((await loadPolicyChecks([ontologyId], "DeliverableDefinition|Validated|Published")).length, 1);
  assert.deepEqual(await loadPolicyChecks([ontologyId], "DeliverableDefinition|Draft|Validated"), []);
});

test("BUTTONS: Deliverable Definition buttons are the manual next transitions the actor holds", async () => {
  assert.deepEqual((await nextActionsFor("DeliverableDefinition", "Draft", TESTER_ALL_ID)).map((a) => a.toState), ["Validated"]);
  assert.deepEqual(await nextActionsFor("DeliverableDefinition", "Draft", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  const actions = await computeRowActions("Deliverable", "Validated", TESTER_ALL_ID);
  assert.deepEqual(actions.map((a) => ({ toState: a.toState, endpoint: a.endpoint, requiresComment: a.requiresComment })), [{ toState: "Published", endpoint: "transition", requiresComment: false }]);
});
