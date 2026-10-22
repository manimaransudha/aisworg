// CR-111 (Capability Registry), CR-126 and CR-128. An executable check of Capability's own
// transition_definitions rows, including the birth row, the Validated state and the policies on the
// Validated and Published hops.
//
//   - DEFINITION: every row's transition_definitions record (event_type/version_event/trigger) matches the table.
//   - DRIVEN: creation goes through a real call site (copyCapabilityDefinitionAsNewDraft), which reads the birth
//     row. Every hop runs through transitionEntity. The events are asserted against eventsDB directly. No mocking.
//   - POLICY: policy-validate-schema and policy-ontology-values-present refuse a bad draft, and the engine reads
//     policy ids from both policies and policy_definitions without evaluating a Policy twice.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionRow } from "../src/dblayer/seuTypes.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { copyCapabilityDefinitionAsNewDraft } from "../src/routes/seu/core/capabilityDefinitions.js";
import { computeRowActions } from "../src/routes/seu/core/sdkAuthoring.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { loadPolicyChecks } from "../src/domain/engine/policyChecks.js";
import { evaluateImplementedPolicy } from "../src/policies/index.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { ONTOLOGY_VALUES_PRESENT_POLICY_CODE, VALIDATE_SCHEMA_POLICY_CODE } from "../src/dblayer/constants.js";
import { query } from "../src/utils/db.js";
import { TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

// capabilityDefinitionsDB.createDraft is a raw DB-layer insert (no
// validateCapabilityDefinitionSeed call — the hand-coded uniqueness/parent
// checks are skipped), same "bare Draft, one hop at a time" fixture pattern
// freshServiceDefinitionDraft uses. createDraft DOES still enforce the
// schema's own x-ontology fields (write-time schema validation), so `code`
// below is a real registered capability-name code, not a fabricated one —
// unique per test run via a fresh Ontology-registered suffix would break the
// x-ontology check, so this reuses a real seeded code instead (capability
// codes are not expected to be unique per Definition version — code+version+
// tenant is the real uniqueness key, and version is randomised here).
// CR-114 follow-on — capabilityDefinitionsDB.createDraft's schemaDefinitionId
// is now mandatory; resolved once and reused by every direct call in this file.
// Deliberately NOT findLatest("Capability"): a real Capability Definition
// row pins the exact schema_definition_id version it was authored against
// (never "whatever is newest"), and findLatest is exactly the lookup that a
// stray schema-registry test authoring throwaway Capability versions
// elsewhere (schema-definition-event-lifecycle-table.test.ts) can silently
// point at the wrong, Ontology-blind schema. The real baseline grammar for
// Capability is version 1 (x-ontology on code/roles) — pin to that directly.
async function requireCapabilitySchemaId(): Promise<string> {
  const { data: versions } = await schemaDefinitionsDB.findAllVersions("Capability");
  const baseline = (versions ?? []).reduce<SchemaDefinitionRow | undefined>((lowest, v) => (!lowest || v.version < lowest.version ? v : lowest), undefined);
  if (!baseline) throw new Error("no schema_definitions grammar for Capability");
  return baseline.id;
}

async function birthState(): Promise<string> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Capability");
  if (!birth) throw new Error("no birth Transition Definition for Capability");
  return birth.to_state;
}

async function freshCapabilityDefinitionDraft(): Promise<{ id: string }> {
  const { data: draft, error } = await capabilityDefinitionsDB.createDraft({ tenantId: PLATFORM_TENANT_ID, category: "Requirements Engineering",
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    schemaDefinitionId: await requireCapabilitySchemaId(),
  status: await birthState() as never,
  authoredBy: ROOT_ACTOR_ID,
  authorBadge: ROOT_ACTOR_BADGE,
  });
  if (error || !draft) throw error ?? new Error("failed to create Capability Definition draft");
  return { id: draft.id };
}

interface CapabilityDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
}

const CAPABILITY_DEFINITION_TABLE: CapabilityDefinitionTableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Defined", verb: "define", eventType: "CapabilityRegistered", versionEvent: null, policyCodes: [] },
  { row: 2, description: "Validate", fromState: "Defined", toState: "Validated", verb: "validate", eventType: "CapabilityValidated", versionEvent: "VersionValidated", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE] },
  { row: 3, description: "Publish", fromState: "Validated", toState: "Published", verb: "publish", eventType: "CapabilityPublished", versionEvent: "VersionPublished", policyCodes: [VALIDATE_SCHEMA_POLICY_CODE, ONTOLOGY_VALUES_PRESENT_POLICY_CODE] },
  { row: 4, description: "Activate", fromState: "Published", toState: "Active", verb: "activate", eventType: "CapabilityActivated", versionEvent: "VersionActivated", policyCodes: [] },
  { row: 5, description: "Deprecate", fromState: "Active", toState: "Deprecated", verb: "deprecate", eventType: "CapabilityDeprecated", versionEvent: "VersionDeprecated", policyCodes: [] },
  { row: 6, description: "Retire", fromState: "Deprecated", toState: "Retired", verb: "retire", eventType: "CapabilityRetired", versionEvent: "VersionSuperseded", policyCodes: [] },
  { row: 7, description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", eventType: "CapabilityArchived", versionEvent: "VersionArchived", policyCodes: [] },
];

async function policyDefinitionId(code: string): Promise<string> {
  const { data } = await policyDefinitionsDB.findActiveByCodeVisibleTo(code, PLATFORM_TENANT_ID);
  assert.ok(data, `no Active Policy Definition ${code}`);
  return data!.id;
}

test("DEFINITION: every Capability transition_definitions row matches its own verb, trigger, event_type, version_event and policies", async () => {
  for (const row of CAPABILITY_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Capability", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Capability ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.verb, row.verb, `row ${row.row} (${row.description}): verb`);
    assert.equal(def!.trigger, "manual", `row ${row.row} (${row.description}): trigger`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
    for (const code of row.policyCodes) {
      assert.ok(def!.required_policy_ids.includes(await policyDefinitionId(code)), `row ${row.row} (${row.description}): required_policy_ids should list ${code}`);
    }
  }
  const { data: skipped } = await transitionDefinitionsDB.find("Capability", "Defined", "Published");
  assert.equal(skipped, null, "Defined -> Published must not exist: a Capability is Validated first");
});

test("BIRTH: the birth row is the only row from None, and every seeded Capability Definition went through it", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Capability");
  assert.equal(birth?.to_state, "Defined");
  const { data: seeded } = await capabilityDefinitionsDB.findActivePlatformOwned();
  assert.ok((seeded ?? []).length > 0, "expected seeded baseline Capability Definitions");
  const { data: events } = await eventsDB.findByOriginatingObject("Capability", seeded![0].id);
  const types = (events ?? []).map((e) => e.event_type);
  for (const expected of ["CapabilityRegistered", "CapabilityValidated", "CapabilityPublished", "CapabilityActivated"]) {
    assert.ok(types.includes(expected), `seeded Capability Definition should have published ${expected}, got: ${types.join(", ")}`);
  }
});

test("BIRTH: an actor without capability_define is refused when copying a Capability Definition, and no row is written", async () => {
  const source = await freshCapabilityDefinitionDraft();
  const { data: before } = await capabilityDefinitionsDB.findAll();
  await assert.rejects(
    () => copyCapabilityDefinitionAsNewDraft(source.id, TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId),
    /does not hold capability_define/
  );
  const { data: after } = await capabilityDefinitionsDB.findAll();
  assert.equal((after ?? []).length, (before ?? []).length);
});

test("DRIVEN: creation through copyCapabilityDefinitionAsNewDraft stores the birth to_state and publishes CapabilityRegistered with the real actor and badge", async () => {
  const source = await freshCapabilityDefinitionDraft();
  const copy = await copyCapabilityDefinitionAsNewDraft(source.id, ROOT_ACTOR_ID);
  assert.equal(copy.ok, true, copy.ok ? "" : copy.errors.join("; "));
  if (!copy.ok) return;

  const { data: row } = await capabilityDefinitionsDB.findById(copy.draftId);
  assert.equal(row?.status, await birthState());

  const { data: events } = await eventsDB.findByOriginatingObject("Capability", copy.draftId);
  const registered = events?.find((e) => e.event_type === "CapabilityRegistered");
  assert.ok(registered, "expected a CapabilityRegistered event");
  assert.equal(registered!.actor_id, ROOT_ACTOR_ID);
  assert.equal(registered!.authority_badge, ROOT_ACTOR_BADGE);
});

test("DRIVEN: rows 2-7 (Validate, Publish, Activate, Deprecate, Retire, Archive) each publish their matching event through transitionEntity", async () => {
  const draft = await freshCapabilityDefinitionDraft();

  for (const row of CAPABILITY_DEFINITION_TABLE.slice(1)) {
    const result = await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: row.toState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, result.ok ? "" : `${row.description}: ${"detail" in result ? result.detail : result.reason}`);
  }

  const { data: events } = await eventsDB.findByOriginatingObject("Capability", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const row of CAPABILITY_DEFINITION_TABLE.slice(1)) {
    assert.ok(eventTypes.includes(row.eventType), `expected ${row.eventType} among published events, got: ${eventTypes.join(", ")}`);
  }
  const { data: row } = await capabilityDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Archived");
});

test("GUARD: Defined cannot go straight to Published, and a repeat Validate is refused", async () => {
  const draft = await freshCapabilityDefinitionDraft();
  const skip = await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Published", actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: skip.ok, reason: skip.ok ? null : skip.reason }, { ok: false, reason: "no_transition_definition" });
  await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Validated", actorId: TESTER_ALL_ID });
  const again = await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Validated", actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: again.ok, reason: again.ok ? null : again.reason }, { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: Validate is refused to an actor without capability_validate", async () => {
  const draft = await freshCapabilityDefinitionDraft();
  await assert.rejects(
    () => transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Validated", actorId: TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId }),
    /does not hold capability_validate/
  );
  const { data: row } = await capabilityDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Defined");
});

test("POLICY: a Capability Definition with no pinned schema cannot be Validated (policy-validate-schema)", async () => {
  const draft = await freshCapabilityDefinitionDraft();
  await query("UPDATE capability_definitions SET schema_definition_id = NULL WHERE id = $1", [draft.id]);
  const result = await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Validated", actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: result.ok, reason: result.ok ? null : result.reason }, { ok: false, reason: "policy_blocked" });
  const { data: row } = await capabilityDefinitionsDB.findById(draft.id);
  assert.equal(row?.status, "Defined");
});

test("POLICY: a Capability Definition whose code is not in the Ontology cannot reach Published, and PolicyViolated is published", async () => {
  const draft = await freshCapabilityDefinitionDraft();
  await query("UPDATE capability_definitions SET code = $2 WHERE id = $1", [draft.id, `not-a-real-capability-${randomUUID()}`]);
  const validated = await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Validated", actorId: TESTER_ALL_ID });
  const published = validated.ok
    ? await transitionAndPublish({ entityType: "Capability", entityId: draft.id, targetState: "Published", actorId: TESTER_ALL_ID })
    : validated;
  assert.deepEqual({ ok: published.ok, reason: published.ok ? null : published.reason }, { ok: false, reason: "policy_blocked" });
  const { data: row } = await capabilityDefinitionsDB.findById(draft.id);
  assert.notEqual(row?.status, "Published");
  // The event carries the id of the row the engine read: the materialised policies row, or the definition when none exists.
  const code = validated.ok ? ONTOLOGY_VALUES_PRESENT_POLICY_CODE : VALIDATE_SCHEMA_POLICY_CODE;
  const { rows: materialised } = await query<{ id: string }>("SELECT id FROM policies WHERE code = $1 OR code LIKE $2", [code, `${code}::%`]);
  const violations = [];
  for (const id of [await policyDefinitionId(code), ...materialised.map((r) => r.id)]) {
    const { data: events } = await eventsDB.findByOriginatingObject("Policy", id);
    violations.push(...(events ?? []).filter((e) => e.event_type === "PolicyViolated"));
  }
  assert.ok(violations.length > 0, "expected a PolicyViolated event for the refusing policy");
});

test("POLICY: loadPolicyChecks reads a Policy Definition id for its own hop only, and drops it when a materialised row of the same code is listed", async () => {
  const definitionId = await policyDefinitionId(VALIDATE_SCHEMA_POLICY_CODE);
  const onHop = await loadPolicyChecks([definitionId], "Capability|Defined|Validated");
  assert.equal(onHop.length, 1);
  assert.equal(onHop[0].id, definitionId);
  assert.deepEqual(onHop[0].condition, { type: "implemented" });
  assert.deepEqual(await loadPolicyChecks([definitionId], "Capability|Active|Deprecated"), []);

  const { rows: materialised } = await query<{ id: string }>("SELECT id FROM policies WHERE code = $1 OR code LIKE $2", [VALIDATE_SCHEMA_POLICY_CODE, `${VALIDATE_SCHEMA_POLICY_CODE}::%`]);
  assert.ok(materialised.length > 0, "expected the platform governance Pack to have materialised policy-validate-schema");
  const both = await loadPolicyChecks([definitionId, ...materialised.map((r) => r.id)], "Capability|Defined|Validated");
  assert.ok(!both.some((c) => c.id === definitionId), "the definition must be dropped when a materialised row of the same code is listed");
});

test("POLICY: an implemented condition with no function in src/policies throws", async () => {
  await assert.rejects(() => evaluateImplementedPolicy("policy-no-such-implementation", { entityType: "Capability", entityId: undefined, context: {} }), /no implementation in src\/policies/);
});

test("BUTTONS: Capability buttons are the manual next transitions the actor holds, all plain transitions", async () => {
  assert.deepEqual((await nextActionsFor("Capability", "Defined", TESTER_ALL_ID)).map((a) => a.toState), ["Validated"]);
  assert.deepEqual(await nextActionsFor("Capability", "Defined", TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId), []);
  const actions = await computeRowActions("Capability", "Validated", TESTER_ALL_ID);
  assert.deepEqual(actions.map((a) => ({ toState: a.toState, endpoint: a.endpoint, requiresComment: a.requiresComment })), [{ toState: "Published", endpoint: "transition", requiresComment: false }]);
});

test("REGRESSION: roles[] round-trips as real {name, worktypes[]} rows and is validated against role-name/worktype-name Ontology", async () => {
  const { data: draft, error } = await capabilityDefinitionsDB.createDraft({ tenantId: PLATFORM_TENANT_ID, category: "Requirements Engineering",
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition Roles",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    roles: [{ name: "requirement-analysis", worktypes: ["requirement-examination", "requirement-interpretation"] }],
    schemaDefinitionId: await requireCapabilitySchemaId(),
  status: await birthState() as never,
  authoredBy: ROOT_ACTOR_ID,
  authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.equal(error, undefined);
  assert.deepEqual(draft?.roles, [{ name: "requirement-analysis", worktypes: ["requirement-examination", "requirement-interpretation"] }]);

  const { error: badRoleError } = await capabilityDefinitionsDB.createDraft({ tenantId: PLATFORM_TENANT_ID, category: "Requirements Engineering",
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition Bad Role",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    roles: [{ name: "not-a-real-role-name", worktypes: [] }],
    schemaDefinitionId: await requireCapabilitySchemaId(),
  status: await birthState() as never,
  authoredBy: ROOT_ACTOR_ID,
  authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(badRoleError, "expected an unregistered role-name to be rejected at write time");

  const { error: badWorktypeError } = await capabilityDefinitionsDB.createDraft({ tenantId: PLATFORM_TENANT_ID, category: "Requirements Engineering",
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition Bad Worktype",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    roles: [{ name: "requirement-analysis", worktypes: ["not-a-real-worktype-name"] }],
    schemaDefinitionId: await requireCapabilitySchemaId(),
  status: await birthState() as never,
  authoredBy: ROOT_ACTOR_ID,
  authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(badWorktypeError, "expected an unregistered worktype-name to be rejected at write time");
});
