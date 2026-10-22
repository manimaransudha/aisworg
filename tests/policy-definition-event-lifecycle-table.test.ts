// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.24. An executable check of Policy
// Definition's own transition_definitions rows, including the birth row and the schema policy.
//
//   - DEFINITION: every row's transition_definitions record matches the table.
//   - DRIVEN: creation goes through a real call site (copyPolicyDefinitionAsNewDraft), which reads the birth row.
//     Every hop runs through transitionEntity. The events are asserted against eventsDB directly. No mocking.
//   - POLICY: policy-validate-schema refuses what it should, on its own hops only.
//   - NESTED: the schema checks read the arrays and objects nested inside a condition row.
//   - BUTTONS: the buttons are the manual next transitions the actor holds.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { copyPolicyDefinitionAsNewDraft } from "../src/routes/seu/core/policyDefinitions.js";
import { computeRowActions } from "../src/routes/seu/core/sdkAuthoring.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { VALIDATE_SCHEMA_POLICY_CODE } from "../src/dblayer/constants.js";
import { validateAgainstSchema, type JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";
import { validateReferentialFields } from "../src/routes/seu/core/referentialOptions.js";
import { validateOntologyFieldsAgainstSchema } from "../src/routes/seu/core/ontology.js";
import { query } from "../src/utils/db.js";
import { TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

async function birthState(): Promise<string> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Policy");
  if (!birth) throw new Error("no birth Transition Definition for Policy");
  return birth.to_state;
}

// policyDefinitionsDB.createDraft is a raw DB-layer insert, the same "bare Draft, one hop at a time" fixture the other lifecycle tests use.
async function freshPolicyDefinitionDraft(): Promise<{ id: string; code: string }> {
  const { data: policySchema } = await schemaDefinitionsDB.findLatest("Policy");
  if (!policySchema) throw new Error("no schema_definitions grammar for Policy");
  const { data: draft, error } = await policyDefinitionsDB.createDraft({
    tenantId: PLATFORM_TENANT_ID,
    code: `test-policy-lifecycle-${randomUUID()}`,
    name: "Test Policy Definition",
    category: "Engineering",
    version: "1.0.0",
    status: (await birthState()) as never,
    authoredBy: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
    schemaDefinitionId: policySchema.id,
  });
  if (error || !draft) throw error ?? new Error("failed to create Policy Definition draft");
  return { id: draft.id, code: draft.code };
}

async function hop(id: string, targetState: string, context?: Record<string, unknown>, actorId = TESTER_ALL_ID) {
  return transitionAndPublish({ entityType: "Policy", entityId: id, targetState, actorId, context });
}

function outcome(r: Awaited<ReturnType<typeof hop>>): { ok: boolean; reason: string | null } {
  return { ok: r.ok, reason: r.ok ? null : r.reason };
}

async function policyDefinitionId(code: string): Promise<string> {
  const { data } = await policyDefinitionsDB.findActiveByCodeVisibleTo(code, PLATFORM_TENANT_ID);
  assert.ok(data, `no Active Policy Definition ${code}`);
  return data!.id;
}

interface PolicyDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
}

const POLICY_DEFINITION_TABLE: PolicyDefinitionTableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Draft", verb: "define", eventType: "PolicyDefinitionDefined", versionEvent: null, policyCodes: [] },
  { row: 2, description: "Validate", fromState: "Draft", toState: "Validated", verb: "validate", eventType: "PolicyDefinitionValidated", versionEvent: "VersionValidated", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 3, description: "Publish", fromState: "Validated", toState: "Published", verb: "publish", eventType: "PolicyDefinitionPublished", versionEvent: "VersionPublished", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 4, description: "Activate", fromState: "Published", toState: "Active", verb: "activate", eventType: "PolicyDefinitionActivated", versionEvent: "VersionActivated", policyCodes: [] },
  { row: 5, description: "Deprecate", fromState: "Active", toState: "Deprecated", verb: "deprecate", eventType: "PolicyDefinitionDeprecated", versionEvent: "VersionDeprecated", policyCodes: [] },
  { row: 6, description: "Retire", fromState: "Deprecated", toState: "Retired", verb: "retire", eventType: "PolicyDefinitionRetired", versionEvent: "VersionSuperseded", policyCodes: [] },
  { row: 7, description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", eventType: "PolicyDefinitionArchived", versionEvent: "VersionArchived", policyCodes: [] },
];

// The forward hops, in order, after the birth row.
const FORWARD_HOPS = POLICY_DEFINITION_TABLE.filter((r) => r.fromState !== "None");

test("DEFINITION: every Policy transition_definitions row matches its own verb, trigger, event_type, version_event and policies", async () => {
  for (const row of POLICY_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Policy", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Policy ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
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

test("DEFINITION: there are exactly the table's rows", async () => {
  const { rows } = await query<{ event_type: string | null }>("SELECT event_type FROM transition_definitions WHERE entity_type = 'Policy'");
  assert.equal(rows.length, POLICY_DEFINITION_TABLE.length);
});

test("BIRTH: the birth row is the only row from None and starts a Policy Definition in Draft", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Policy");
  assert.equal(birth?.to_state, "Draft");
  assert.equal(birth?.event_type, "PolicyDefinitionDefined");
});

test("BIRTH: an actor without policy_define is refused when copying a Policy Definition, and no row is written", async () => {
  const source = await freshPolicyDefinitionDraft();
  const { data: before } = await policyDefinitionsDB.findAll();
  await assert.rejects(
    () => copyPolicyDefinitionAsNewDraft(source.id, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId),
    /does not hold policy_define/
  );
  const { data: after } = await policyDefinitionsDB.findAll();
  assert.equal((after ?? []).length, (before ?? []).length);
});

test("DRIVEN: creation through copyPolicyDefinitionAsNewDraft stores the birth to_state and publishes PolicyDefinitionDefined with the real actor and badge", async () => {
  const source = await freshPolicyDefinitionDraft();
  const copy = await copyPolicyDefinitionAsNewDraft(source.id, ROOT_ACTOR_ID);
  assert.equal(copy.ok, true, copy.ok ? "" : copy.errors.join("; "));
  if (!copy.ok) return;

  const { data: row } = await policyDefinitionsDB.findById(copy.draftId);
  assert.equal(row?.status, await birthState());

  const { data: events } = await eventsDB.findByOriginatingObject("Policy", copy.draftId);
  const defined = events?.find((e) => e.event_type === "PolicyDefinitionDefined");
  assert.ok(defined, "expected a PolicyDefinitionDefined event");
  assert.equal(defined!.actor_id, ROOT_ACTOR_ID);
  assert.equal(defined!.authority_badge, ROOT_ACTOR_BADGE);
  const { data: legacy } = await eventsDB.findByOriginatingObject("PolicyDefinition", copy.draftId);
  assert.equal(legacy?.length ?? 0, 0, "no event may carry the PolicyDefinition object type");
});

test("DRIVEN: the six forward hops each publish their matching event through transitionEntity, as Policy objects", async () => {
  const draft = await freshPolicyDefinitionDraft();
  for (const row of FORWARD_HOPS) {
    const result = await hop(draft.id, row.toState);
    assert.equal(result.ok, true, result.ok ? "" : `row ${row.row} (${row.description}): ${result.reason}: ${"detail" in result ? result.detail : ""}`);
  }
  const { data: events } = await eventsDB.findByOriginatingObject("Policy", draft.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), FORWARD_HOPS.map((row) => row.eventType));
  const { data: legacy } = await eventsDB.findByOriginatingObject("PolicyDefinition", draft.id);
  assert.equal(legacy?.length ?? 0, 0, "no event may carry the PolicyDefinition object type");
});

test("GUARD: Draft cannot go straight to Published, and a Policy Definition cannot be reactivated", async () => {
  const draft = await freshPolicyDefinitionDraft();
  assert.deepEqual(outcome(await hop(draft.id, "Published")), { ok: false, reason: "no_transition_definition" });
  for (const row of FORWARD_HOPS) await hop(draft.id, row.toState);
  assert.deepEqual(outcome(await hop(draft.id, "Active")), { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: Validate is refused to an actor without policy_validate", async () => {
  const draft = await freshPolicyDefinitionDraft();
  await assert.rejects(() => hop(draft.id, "Validated", undefined, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold policy_validate/);
  const { data: row } = await policyDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
});

test("POLICY: a Policy Definition with no pinned schema cannot be Validated (policy-validate-schema)", async () => {
  const draft = await freshPolicyDefinitionDraft();
  await query("UPDATE policy_definitions SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "policy_blocked" });
  const { data: row } = await policyDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
});

test("POLICY: loadPolicyChecks reads policy-validate-schema on its own Policy hops only", async () => {
  const schemaId = await policyDefinitionId(VALIDATE_SCHEMA_POLICY_CODE);
  for (const hopKey of ["Policy|Draft|Validated", "Policy|Validated|Published"]) {
    const checks = await loadPolicyChecks([schemaId], hopKey);
    assert.equal(checks.length, 1, hopKey);
    assert.deepEqual(checks[0].condition, { type: "implemented" });
  }
  assert.deepEqual(await loadPolicyChecks([schemaId], "Policy|Active|Deprecated"), []);
});

test("BUTTONS: Policy buttons are the manual next transitions the actor holds", async () => {
  assert.deepEqual((await nextActionsFor("Policy", "Draft", TESTER_ALL_ID)).map((a) => a.toState), ["Validated"]);
  assert.deepEqual(await nextActionsFor("Policy", "Draft", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  const actions = await computeRowActions("Policy", "Validated", TESTER_ALL_ID);
  assert.deepEqual(actions.map((a) => ({ toState: a.toState, endpoint: a.endpoint, requiresComment: a.requiresComment })), [{ toState: "Published", endpoint: "transition", requiresComment: false }]);
});

async function policySchema(): Promise<JsonSchemaDocument> {
  const { data } = await schemaDefinitionsDB.findLatest("Policy");
  assert.ok(data, "no schema_definitions grammar for Policy");
  return data!.schema as JsonSchemaDocument;
}

const VALID_CONDITION = {
  statement: "A condition",
  applicabilityDeliverables: [{ name: "Deliverable", transitions: ["Deliverable|In Progress|Approved"], governingCondition: { type: "always_true" } }],
  relatedObligations: [{ category: "Compliance" }],
  exceptionRules: [{ exceptionStatement: "An exception", exceptionComposition: "all" }],
};

test("NESTED: a well-formed condition passes the nested required and enum checks", async () => {
  const content = { code: "x", name: "x", category: "Engineering", constraintType: "Policy", conditions: [VALID_CONDITION] };
  assert.deepEqual(validateAgainstSchema(await policySchema(), content), []);
});

test("NESTED: validateAgainstSchema reports a missing nested required field and a nested enum value that is not allowed", async () => {
  const bad = {
    statement: "A condition",
    applicabilityDeliverables: [{ transitions: [], governingCondition: { type: "sometimes", operator: "between" } }],
    relatedObligations: [{ title: "No category" }],
    exceptionRules: [{ exceptionComposition: "most" }],
  };
  const errors = validateAgainstSchema(await policySchema(), { code: "x", name: "x", category: "Engineering", constraintType: "Policy", conditions: [bad] }).join(" | ");
  assert.match(errors, /"applicabilityDeliverables" row 1: "name" is required/);
  assert.match(errors, /"governingCondition": "type" must be one of always_true, field_in, comparison, threshold, got: "sometimes"/);
  assert.match(errors, /"governingCondition": "operator" must be one of/);
  assert.match(errors, /"relatedObligations" row 1: "category" is required/);
  assert.match(errors, /"exceptionRules" row 1: "exceptionStatement" is required/);
  assert.match(errors, /"exceptionComposition" must be one of all, any, got: "most"/);
});

test("NESTED: validateReferentialFields checks a nested transition and a nested exception approver", async () => {
  const viewer = { isRoot: false, tenantId: PLATFORM_TENANT_ID };
  const schema = await policySchema();
  const unknown = `no-such-${randomUUID()}`;
  const bad = { ...VALID_CONDITION, applicabilityDeliverables: [{ name: "Deliverable", transitions: [`Deliverable|${unknown}|Approved`] }], exceptionRules: [{ exceptionStatement: "An exception", exceptionApprovers: [unknown] }] };
  const errors = (await validateReferentialFields(schema, { conditions: [bad] }, viewer)).join(" | ");
  assert.match(errors, new RegExp(`transitions.*${unknown}.*transition-definition`));
  assert.match(errors, new RegExp(`exceptionApprovers.*${unknown}.*authority-badge`));
  assert.deepEqual(await validateReferentialFields(schema, { conditions: [{ ...VALID_CONDITION, exceptionRules: [{ exceptionStatement: "An exception" }] }] }, viewer), []);
});

test("NESTED: the applicability row name follows the scope; an Eligibility name is a noun and a Transition name is a deliverable-name concept", async () => {
  const viewer = { isRoot: false, tenantId: PLATFORM_TENANT_ID };
  const schema = await policySchema();
  const unknown = `no-such-${randomUUID()}`;
  const row = (name: string) => ({ ...VALID_CONDITION, applicabilityDeliverables: [{ name, transitions: [] }] });

  const eligibility = { scope: "Eligibility" };
  assert.match((await validateReferentialFields(schema, { ...eligibility, conditions: [row(unknown)] }, viewer)).join(" | "), new RegExp(`name.*${unknown}.*noun`));
  assert.deepEqual(await validateReferentialFields(schema, { ...eligibility, conditions: [row("Pack")] }, viewer), []);

  const transition = { scope: "Transition" };
  assert.match((await validateOntologyFieldsAgainstSchema(schema, { ...transition, conditions: [row(unknown)] }, viewer)).join(" | "), new RegExp(`name.*${unknown}.*deliverable-name`));
  assert.deepEqual(await validateOntologyFieldsAgainstSchema(schema, { ...transition, conditions: [row("source-code")] }, viewer), []);
  assert.deepEqual(await validateReferentialFields(schema, { ...transition, conditions: [row(unknown)] }, viewer), [], "a Transition name is an Ontology source, checked against the Ontology and not here");
});
