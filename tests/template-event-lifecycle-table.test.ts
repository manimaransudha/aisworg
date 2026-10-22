// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.6. An executable check of the Template's own
// transition_definitions rows: the birth row, the reject row, the schema, materialise and comment policies, and the
// unravel action.
//
//   - DEFINITION: every row's transition_definitions record matches the table. The reactivation rows are gone.
//   - DRIVEN: creation goes through real call sites (createTemplateDraft, copyTemplateAsNewDraft, publishTemplate), which
//     read the birth row. Every hop runs through transitionEntity. The events are asserted against eventsDB. No mocking.
//   - POLICY: policy-validate-schema, policy-materialise-template, policy-ontology-values-present and policy-comment-required.
//   - ACTION: unravel-template writes the Pack selections when the Template is published, and not before.
//   - COMMENTS: a comment is added only with a transition, is kept, and is never replaced.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { createTemplateDraft, copyTemplateAsNewDraft, publishTemplate, getPackSelectionsByCategory, PACK_SELECTION_SLOTS, type TemplateSeedInput } from "../src/routes/seu/core/templates.js";
import { computeRowActions, publishAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { evaluateImplementedPolicy } from "../src/policies/index.js";
import { generateFields, type JsonSchemaDocument } from "../src/domain/sdk/formGenerator.js";
import { COMMENT_REQUIRED_POLICY_CODE, MATERIALISE_TEMPLATE_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE, UNRAVEL_TEMPLATE_ACTION_CODE, VALIDATE_SCHEMA_POLICY_CODE } from "../src/dblayer/constants.js";
import { query } from "../src/utils/db.js";
import { uniqueTestPackVersion, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, PLATFORM_TENANT_ID } from "./testFixtures.js";

// "test-template-lifecycle-template" is a test-only template-categories Ontology concept, so activating a new version never
// supersedes a seeded Template. "source-code" is a platform-seeded deliverable-name concept. Identity is
// (code, templateVersion, tenantId), so reusing the code every run is safe while templateVersion differs.
async function freshTemplateSeed(overrides: Partial<TemplateSeedInput> = {}): Promise<TemplateSeedInput> {
  return {
    code: "test-template-lifecycle-template",
    name: "Test Template",
    purpose: "Test Template fixture for the Ch.6 event/lifecycle table check.",
    templateVersion: uniqueTestPackVersion(),
    deliverableCatalogue: [{ code: "source-code" }],
    tenantId: PLATFORM_TENANT_ID,
    ...overrides,
  };
}

async function birthState(): Promise<string> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Template");
  if (!birth) throw new Error("no birth Transition Definition for Template");
  return birth.to_state;
}

// One hop at a time needs a bare Draft, the row the interactive authoring path produces.
async function freshTemplateDraft(): Promise<{ id: string }> {
  const { data: templateSchema } = await schemaDefinitionsDB.findLatest("Template");
  if (!templateSchema) throw new Error("no schema_definitions grammar for Template");
  const { data: draft, error } = await templatesDB.createDraft({
    status: (await birthState()) as "Draft",
    tenantId: PLATFORM_TENANT_ID,
    code: "test-template-lifecycle-template",
    name: "Test Template Draft",
    templateVersion: uniqueTestPackVersion(),
    authoredBy: ROOT_ACTOR_ID,
    authorBadge: ROOT_ACTOR_BADGE,
    draftContent: { purpose: "Test Template fixture for the Ch.6 event/lifecycle table check." },
    schemaDefinitionId: templateSchema.id,
  });
  if (error || !draft) throw error ?? new Error("failed to create Template draft");
  return { id: draft.id };
}

async function hop(id: string, targetState: string, context?: Record<string, unknown>, actorId = TESTER_ALL_ID) {
  return transitionAndPublish({ entityType: "Template", entityId: id, targetState, actorId, context });
}

function outcome(r: Awaited<ReturnType<typeof hop>>): { ok: boolean; reason: string | null } {
  return { ok: r.ok, reason: r.ok ? null : r.reason };
}

async function policyDefinitionId(code: string): Promise<string> {
  const { data } = await policyDefinitionsDB.findActiveByCodeVisibleTo(code, PLATFORM_TENANT_ID);
  assert.ok(data, `no Active Policy Definition ${code}`);
  return data!.id;
}

interface TemplateTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
  actionCode: string | null;
}

const TEMPLATE_TABLE: TemplateTableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Draft", verb: "define", eventType: "TemplateDefined", versionEvent: null, policyCodes: [], actionCode: null },
  { row: 3, description: "Validate", fromState: "Draft", toState: "Validated", verb: "validate", eventType: "TemplateValidated", versionEvent: "VersionValidated", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE, MATERIALISE_TEMPLATE_POLICY_CODE], actionCode: null },
  { row: 4, description: "Reject", fromState: "Validated", toState: "Draft", verb: "reject", eventType: "TemplateRejected", versionEvent: null, policyCodes: [COMMENT_REQUIRED_POLICY_CODE], actionCode: null },
  { row: 5, description: "Publish", fromState: "Validated", toState: "Published", verb: "publish", eventType: "TemplatePublished", versionEvent: "VersionPublished", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE], actionCode: UNRAVEL_TEMPLATE_ACTION_CODE },
  { row: 6, description: "Activate", fromState: "Published", toState: "Active", verb: "activate", eventType: "TemplateActivated", versionEvent: "VersionActivated", policyCodes: [], actionCode: null },
  { row: 7, description: "Deprecate", fromState: "Active", toState: "Deprecated", verb: "deprecate", eventType: "TemplateDeprecated", versionEvent: "VersionDeprecated", policyCodes: [], actionCode: null },
  { row: 8, description: "Retire", fromState: "Deprecated", toState: "Retired", verb: "retire", eventType: "TemplateRetired", versionEvent: "VersionSuperseded", policyCodes: [], actionCode: null },
  { row: 9, description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", eventType: "TemplateArchived", versionEvent: "VersionArchived", policyCodes: [], actionCode: null },
];

// The forward hops, in order, after the birth row.
const FORWARD_HOPS = ["Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

test("DEFINITION: every Template transition_definitions row matches its own verb, trigger, event_type, version_event, policies and action", async () => {
  for (const row of TEMPLATE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Template", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Template ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.verb, row.verb, `row ${row.row} (${row.description}): verb`);
    assert.equal(def!.trigger, "manual", `row ${row.row} (${row.description}): trigger`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
    assert.equal(def!.action_code, row.actionCode, `row ${row.row} (${row.description}): action_code`);
    for (const code of row.policyCodes) {
      assert.ok(def!.required_policy_ids.includes(await policyDefinitionId(code)), `row ${row.row} (${row.description}): required_policy_ids should list ${code}`);
    }
  }
});

test("DEFINITION: there are exactly the table's Template rows, no reactivation rows and no TemplateCreated", async () => {
  const { rows } = await query<{ event_type: string | null }>("SELECT event_type FROM transition_definitions WHERE entity_type = 'Template'");
  assert.equal(rows.length, TEMPLATE_TABLE.length);
  assert.ok(!rows.some((r) => r.event_type === "TemplateCreated"), "TemplateCreated is replaced by TemplateDefined");
  for (const fromState of ["Deprecated", "Retired", "Archived"]) {
    const { data: def } = await transitionDefinitionsDB.find("Template", fromState, "Active");
    assert.equal(def, null, `${fromState} -> Active must not exist: reactivation was removed`);
  }
});

test("DEFINITION: the Template schema carries comments as a read-only array, and the form leaves it out", async () => {
  const { data: schemaRow } = await schemaDefinitionsDB.findLatest("Template");
  const schema = schemaRow!.schema as JsonSchemaDocument;
  const comments = schema.properties?.comments;
  assert.ok(comments, "the Template schema should describe comments");
  assert.equal(comments!.type, "array");
  assert.equal(comments!["x-read-only"], true);
  assert.deepEqual(Object.keys(comments!.items?.properties ?? {}).sort(), ["actorId", "authorityBadge", "createdAt", "text"]);
  assert.ok(!generateFields(schema, {}).some((f) => f.name === "comments"), "a read-only field must not be offered as an input");
});

test("BIRTH: the birth row is the only row from None and starts a Template in Draft", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Template");
  assert.equal(birth?.to_state, "Draft");
  assert.equal(birth?.event_type, "TemplateDefined");
});

test("BIRTH: an actor without template_define is refused when creating a Template, and no row is written", async () => {
  const version = uniqueTestPackVersion();
  await assert.rejects(
    async () => createTemplateDraft(await freshTemplateSeed({ templateVersion: version }), TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId),
    /does not hold template_define/
  );
  const { rows } = await query<{ id: string }>("SELECT id FROM templates WHERE template_version = $1", [version]);
  assert.equal(rows.length, 0);
});

test("DRIVEN: creation stores the birth to_state, starts with no comments and publishes TemplateDefined with the real actor and badge", async () => {
  const created = await createTemplateDraft(await freshTemplateSeed(), ROOT_ACTOR_ID);
  assert.equal(created.ok, true, created.ok ? "" : created.errors.join("; "));
  if (!created.ok) return;
  const { data: row } = await templatesDB.findById(created.draft.id);
  assert.equal(row?.status, "Draft");
  assert.deepEqual(row?.comments, []);
  const { data: events } = await eventsDB.findByOriginatingObject("Template", created.draft.id);
  assert.equal(events?.length, 1);
  assert.equal(events?.[0]?.event_type, "TemplateDefined");
  assert.equal(events?.[0]?.actor_id, ROOT_ACTOR_ID);
  assert.equal(events?.[0]?.authority_badge, ROOT_ACTOR_BADGE);
});

test("DRIVEN: copying a Template creates a Draft and publishes TemplateDefined", async () => {
  const source = await freshTemplateDraft();
  const copy = await copyTemplateAsNewDraft(source.id, ROOT_ACTOR_ID);
  assert.equal(copy.ok, true, copy.ok ? "" : copy.errors.join("; "));
  if (!copy.ok) return;
  const { data: row } = await templatesDB.findById(copy.draftId);
  assert.equal(row?.status, "Draft");
  const { data: events } = await eventsDB.findByOriginatingObject("Template", copy.draftId);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["TemplateDefined"]);
  await assert.rejects(() => copyTemplateAsNewDraft(source.id, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold template_define/);
});

test("DRIVEN: publishTemplate creates a Draft and walks it to Active, firing TemplateDefined then the governed events", async () => {
  const created = await publishTemplate({ seed: await freshTemplateSeed(), actorId: TESTER_ALL_ID });
  assert.equal(created.ok, true, created.ok ? "" : created.errors.join("; "));
  if (!created.ok) return;
  const { data: events } = await eventsDB.findByOriginatingObject("Template", created.templateId);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["TemplateDefined", "TemplateValidated", "TemplatePublished", "TemplateActivated"]);
  const { data: template } = await templatesDB.findById(created.templateId);
  assert.equal(template?.status, "Active");
});

test("DRIVEN: the six forward hops each publish their matching event through transitionEntity, as Template objects", async () => {
  const draft = await freshTemplateDraft();
  for (const toState of FORWARD_HOPS) {
    const result = await hop(draft.id, toState);
    assert.equal(result.ok, true, result.ok ? "" : `${toState}: ${"detail" in result ? result.detail : result.reason}`);
  }
  const { data: events } = await eventsDB.findByOriginatingObject("Template", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const row of TEMPLATE_TABLE.filter((r) => FORWARD_HOPS.includes(r.toState))) {
    assert.ok(eventTypes.includes(row.eventType), `expected ${row.eventType} among published events, got: ${eventTypes.join(", ")}`);
  }
  const { data: row } = await templatesDB.findById(draft.id);
  assert.equal(row?.status, "Archived");
});

test("GUARD: Draft cannot go straight to Published, and a Template cannot be reactivated", async () => {
  const draft = await freshTemplateDraft();
  assert.deepEqual(outcome(await hop(draft.id, "Published")), { ok: false, reason: "no_transition_definition" });
  for (const toState of ["Validated", "Published", "Active", "Deprecated"]) await hop(draft.id, toState);
  assert.deepEqual(outcome(await hop(draft.id, "Active")), { ok: false, reason: "no_transition_definition" });
  await hop(draft.id, "Retired");
  assert.deepEqual(outcome(await hop(draft.id, "Active")), { ok: false, reason: "no_transition_definition" });
  await hop(draft.id, "Archived");
  assert.deepEqual(outcome(await hop(draft.id, "Active")), { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: Validate is refused to an actor without template_validate", async () => {
  const draft = await freshTemplateDraft();
  await assert.rejects(() => hop(draft.id, "Validated", undefined, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold template_validate/);
  const { data: row } = await templatesDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
});

test("AUTHORITY: Reject is refused to an actor without template_reject", async () => {
  const draft = await freshTemplateDraft();
  await hop(draft.id, "Validated");
  await assert.rejects(() => hop(draft.id, "Draft", { comment: "not good enough" }, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), /does not hold template_reject/);
  const { data: row } = await templatesDB.findById(draft.id);
  assert.equal(row?.status, "Validated");
  assert.deepEqual(row?.comments, []);
});

test("POLICY: a Template with no pinned schema cannot be Validated (policy-validate-schema)", async () => {
  const draft = await freshTemplateDraft();
  await query("UPDATE templates SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "policy_blocked" });
});

test("POLICY: a Template that selects a Pack nobody offers cannot be Validated (referential-list check)", async () => {
  const draft = await freshTemplateDraft();
  const slot = PACK_SELECTION_SLOTS[0];
  const content = { purpose: "x", [slot.field]: [{ packCode: `no-such-pack-${randomUUID()}` }] };
  await query("UPDATE templates SET draft_content = $2::jsonb WHERE id = $1", [draft.id, JSON.stringify(content)]);
  assert.deepEqual(outcome(await hop(draft.id, "Validated")), { ok: false, reason: "policy_blocked" });
  const { data: row } = await templatesDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
});

test("POLICY: loadPolicyChecks reads each Template policy on its own hop only", async () => {
  const schemaId = await policyDefinitionId(VALIDATE_SCHEMA_POLICY_CODE);
  for (const hopKey of ["Template|Draft|Validated", "Template|Validated|Published"]) {
    const checks = await loadPolicyChecks([schemaId], hopKey);
    assert.equal(checks.length, 1, hopKey);
    assert.deepEqual(checks[0].condition, { type: "implemented" });
  }
  assert.deepEqual(await loadPolicyChecks([schemaId], "Template|Active|Deprecated"), []);

  const materialiseId = await policyDefinitionId(MATERIALISE_TEMPLATE_POLICY_CODE);
  assert.equal((await loadPolicyChecks([materialiseId], "Template|Draft|Validated")).length, 1);
  assert.deepEqual(await loadPolicyChecks([materialiseId], "Template|Validated|Published"), []);

  const ontologyId = await policyDefinitionId(ONTOLOGY_VALUES_PRESENT_POLICY_CODE);
  assert.equal((await loadPolicyChecks([ontologyId], "Template|Validated|Published")).length, 1);

  const commentId = await policyDefinitionId(COMMENT_REQUIRED_POLICY_CODE);
  assert.equal((await loadPolicyChecks([commentId], "Template|Validated|Draft")).length, 1);
  assert.deepEqual(await loadPolicyChecks([commentId], "Template|Validated|Published"), []);
});

test("POLICY: the materialise and Ontology policies are true for a clean Template", async () => {
  const draft = await freshTemplateDraft();
  const input = { entityType: "Template", entityId: draft.id, context: {} };
  assert.equal(await evaluateImplementedPolicy(MATERIALISE_TEMPLATE_POLICY_CODE, input), true);
  assert.equal(await evaluateImplementedPolicy(ONTOLOGY_VALUES_PRESENT_POLICY_CODE, input), true);
});

test("POLICY: policy-comment-required is true for a comment with text and false for none, blank or non-text", async () => {
  const input = (context: Record<string, unknown>) => ({ entityType: "Template", entityId: undefined, context });
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: "needs a purpose" })), true);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({})), false);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: "   " })), false);
  assert.equal(await evaluateImplementedPolicy(COMMENT_REQUIRED_POLICY_CODE, input({ comment: 42 })), false);
});

test("ACTION: unravel-template writes the Pack selections when the Template is published, and not before", async () => {
  const slot = PACK_SELECTION_SLOTS[0];
  const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
  const packCode = `test-template-unravel-pack-${randomUUID()}`;
  const { data: pack, error } = await packsDB.create({
    code: packCode, name: "Unravel fixture Pack", category: slot.packCategory as never, packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, status: "Active", authoredBy: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, schemaDefinitionId: packSchema!.id, tenantId: PLATFORM_TENANT_ID,
  });
  assert.ok(!error && pack, error?.message ?? "pack creation failed");

  const created = await createTemplateDraft(await freshTemplateSeed({ [slot.field]: [packCode] }), ROOT_ACTOR_ID);
  assert.equal(created.ok, true, created.ok ? "" : created.errors.join("; "));
  if (!created.ok) return;
  const id = created.draft.id;
  const selected = async () => ((await getPackSelectionsByCategory(id))[slot.field as keyof Awaited<ReturnType<typeof getPackSelectionsByCategory>>] ?? []) as string[];

  assert.deepEqual(await selected(), [], "nothing is written at creation");
  assert.equal((await hop(id, "Validated")).ok, true);
  assert.deepEqual(await selected(), [], "nothing is written at Validate");
  const published = await hop(id, "Published");
  assert.equal(published.ok, true, published.ok ? "" : `${"detail" in published ? published.detail : published.reason}`);
  assert.deepEqual(await selected(), [packCode], "the Pack selection is written at Publish");
});

test("COMMENTS: Reject without a comment is refused and changes nothing; with a comment it returns the Template to Draft and keeps the comment", async () => {
  const draft = await freshTemplateDraft();
  await hop(draft.id, "Validated");

  assert.deepEqual(outcome(await hop(draft.id, "Draft")), { ok: false, reason: "policy_blocked" });
  assert.deepEqual(outcome(await hop(draft.id, "Draft", { comment: "   " })), { ok: false, reason: "policy_blocked" });
  const { data: refused } = await templatesDB.findById(draft.id);
  assert.equal(refused?.status, "Validated");
  assert.deepEqual(refused?.comments, []);

  const result = await hop(draft.id, "Draft", { comment: "  the purpose is unclear  " });
  assert.equal(result.ok, true, result.ok ? "" : `${"detail" in result ? result.detail : result.reason}`);
  const { data: row } = await templatesDB.findById(draft.id);
  assert.equal(row?.status, "Draft");
  assert.equal(row?.comments.length, 1);
  assert.equal(row?.comments[0].text, "the purpose is unclear");
  assert.equal(row?.comments[0].actorId, TESTER_ALL_ID);
  assert.ok(row?.comments[0].createdAt, "a comment records when it was added");

  const { data: events } = await eventsDB.findByOriginatingObject("Template", draft.id);
  const rejected = events?.find((e) => e.event_type === "TemplateRejected");
  assert.ok(rejected, "expected a TemplateRejected event");
  assert.equal(row?.comments[0].authorityBadge, rejected!.authority_badge);
});

test("COMMENTS: comments are added, never replaced, and the same text may be given again", async () => {
  const draft = await freshTemplateDraft();
  await hop(draft.id, "Validated", { comment: "validated after the first read" });
  await hop(draft.id, "Draft", { comment: "needs work" });
  await hop(draft.id, "Validated");
  await hop(draft.id, "Draft", { comment: "needs work" });
  const { data: row } = await templatesDB.findById(draft.id);
  assert.deepEqual(row?.comments.map((c) => c.text), ["validated after the first read", "needs work", "needs work"]);
});

test("COMMENTS: a comment given with a refused transition is not stored (the gate runs first)", async () => {
  const draft = await freshTemplateDraft();
  await hop(draft.id, "Validated");
  await query("UPDATE templates SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  assert.deepEqual(outcome(await hop(draft.id, "Published", { comment: "should not be kept" })), { ok: false, reason: "policy_blocked" });
  const { data: row } = await templatesDB.findById(draft.id);
  assert.deepEqual(row?.comments, []);
});

test("PUBLISH STEP: from Draft it moves to Validated; from Validated it asks for a choice; from Published it activates and deprecates the previous Active version", async () => {
  const first = await publishTemplate({ seed: await freshTemplateSeed(), actorId: TESTER_ALL_ID });
  assert.equal(first.ok, true, first.ok ? "" : first.errors.join("; "));
  if (!first.ok) return;

  const second = await createTemplateDraft(await freshTemplateSeed(), ROOT_ACTOR_ID);
  assert.equal(second.ok, true, second.ok ? "" : second.errors.join("; "));
  if (!second.ok) return;
  const toValidated = await publishAuthoringDraft({ kind: "Template", id: second.draft.id, actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: toValidated.ok, status: toValidated.ok ? toValidated.status : null }, { ok: true, status: "Validated" });
  const choose = await publishAuthoringDraft({ kind: "Template", id: second.draft.id, actorId: TESTER_ALL_ID });
  assert.equal(choose.ok, false);
  if (!choose.ok) assert.match(choose.errors.join(" "), /more than one next step/);

  await hop(second.draft.id, "Published");
  const activated = await publishAuthoringDraft({ kind: "Template", id: second.draft.id, actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: activated.ok, status: activated.ok ? activated.status : null }, { ok: true, status: "Active" });
  const { data: previous } = await templatesDB.findById(first.templateId);
  assert.equal(previous?.status, "Deprecated");
});

test("BUTTONS: Template buttons are the manual next transitions the actor holds; Reject asks for a comment", async () => {
  assert.deepEqual((await nextActionsFor("Template", "Draft", TESTER_ALL_ID)).map((a) => a.toState), ["Validated"]);
  assert.deepEqual(await nextActionsFor("Template", "Draft", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  const actions = await computeRowActions("Template", "Validated", TESTER_ALL_ID);
  assert.deepEqual(
    actions.map((a) => ({ toState: a.toState, endpoint: a.endpoint, requiresComment: a.requiresComment })).sort((a, b) => a.toState.localeCompare(b.toState)),
    [
      { toState: "Draft", endpoint: "transition", requiresComment: true },
      { toState: "Published", endpoint: "transition", requiresComment: false },
    ]
  );
});
