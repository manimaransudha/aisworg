// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.18. An executable check of the Ontology
// Model's transition_definitions rows, including the birth row and the Reject comment policy.
//
// Every concept is born Draft and publishes ConceptCreated from the birth row (None -> Draft), whether it is added on
// the Ontology page, composed, or proposed by a Pack through conceptCreatedHandler. A human holding ontology_approve
// takes Draft -> Active (ConceptApproved) or Draft -> Draft (ConceptRejected, with a comment). The seeds insert Active
// rows in bulk and are outside the birth row.
//
//   - DEFINITION: the six Ontology rows match the table.
//   - DRIVEN: every action runs through the real functions and the events they publish are asserted against eventsDB
//     directly. No mocking.
//   - REJECT: the comment policy refuses a reject without a comment, and the comment is kept.
//   - PROPOSAL: a ConceptCreated event with no version creates a Draft through the birth row.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { BIRTH_STATE } from "../src/dblayer/constants.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
const PLATFORM_TENANT_ID = await getPlatformTenantId();
import { addConcept, approveConcept, rejectConcept, updateConceptMeta, composeConcept, deprecateConcept, retireConcept, archiveConcept, emitConceptCreated, syncConceptFromEntity, type OntologyActor } from "../src/routes/seu/core/ontology.js";
import { TESTER_ALL_ID, ensureEventSubscriptionsLoaded, waitUntilAsync } from "./testFixtures.js";

// TESTER_ALL_ID (seedIdentityBaseline.ts) — "holds every active
// noun_verb (any authorised transition)" — the same standing test-fixture
// actor every other lifecycle-table test file already uses for its governed
// transitions (ontology_deprecate/ontology_retire/ontology_archive here).
const ACTOR: OntologyActor = { isRoot: true, tenantId: null, actorId: TESTER_ALL_ID, actorBadge: "root" };
const CONCEPT_TYPE_PREFIX = "test-ontology-lifecycle";

function freshConceptType(): string {
  return `${CONCEPT_TYPE_PREFIX}-${randomUUID()}`;
}

interface OntologyTableRow {
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  trigger: string;
  eventType: string;
  versionEvent: string | null;
  policyCodes: string[];
}

const ONTOLOGY_TABLE: OntologyTableRow[] = [
  { description: "Define (birth)", fromState: BIRTH_STATE, toState: "Draft", verb: "define", trigger: "governed", eventType: "ConceptCreated", versionEvent: null, policyCodes: [] },
  { description: "Approve", fromState: "Draft", toState: "Active", verb: "approve", trigger: "manual", eventType: "ConceptApproved", versionEvent: "VersionActivated", policyCodes: [] },
  { description: "Reject", fromState: "Draft", toState: "Draft", verb: "approve", trigger: "manual", eventType: "ConceptRejected", versionEvent: null, policyCodes: ["policy-comment-required"] },
  { description: "Deprecate", fromState: "Active", toState: "Deprecated", verb: "deprecate", trigger: "manual", eventType: "ConceptDeprecated", versionEvent: "VersionDeprecated", policyCodes: [] },
  { description: "Retire", fromState: "Deprecated", toState: "Retired", verb: "retire", trigger: "manual", eventType: "OntologyConceptRetired", versionEvent: "VersionSuperseded", policyCodes: [] },
  { description: "Archive", fromState: "Retired", toState: "Archived", verb: "archive", trigger: "manual", eventType: "OntologyConceptArchived", versionEvent: "VersionArchived", policyCodes: [] },
];

test("DEFINITION: the six Ontology rows match the table", async () => {
  const { data: all } = await transitionDefinitionsDB.listAll();
  const ontologyRows = (all ?? []).filter((r) => r.entity_type === "Ontology");
  assert.equal(ontologyRows.length, ONTOLOGY_TABLE.length, `expected exactly ${ONTOLOGY_TABLE.length} rows, got: ${JSON.stringify(ontologyRows.map((r) => `${r.from_state}->${r.to_state}`))}`);
  for (const row of ONTOLOGY_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Ontology", row.fromState, row.toState);
    assert.ok(def, `no row for Ontology ${row.fromState} -> ${row.toState} (${row.description})`);
    assert.equal(def!.verb, row.verb, `${row.description}: verb`);
    assert.equal(def!.trigger, row.trigger, `${row.description}: trigger`);
    assert.equal(def!.event_type, row.eventType, `${row.description}: event_type`);
    assert.equal(def!.version_event, row.versionEvent, `${row.description}: version_event`);
    assert.equal(def!.submit_verb, null, `${row.description}: submit_verb`);
    const { data: policies } = def!.required_policy_ids.length > 0 ? await policyDefinitionsDB.findByIds(def!.required_policy_ids) : { data: [] };
    assert.deepEqual((policies ?? []).map((p) => p.code.split("::")[0]).sort(), [...row.policyCodes].sort(), `${row.description}: policies`);
  }
});

test("BIRTH: a new code lands in the birth row's state and publishes ConceptCreated with the real actor and badge", async () => {
  const conceptType = freshConceptType();
  const code = "first-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "First Code" }, ACTOR);
  assert.equal(created.version, "1.0.0");
  const { data: birth } = await transitionDefinitionsDB.findBirth("Ontology");
  assert.equal(created.status, birth!.to_state, "state from the birth row");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["ConceptCreated"], "exactly one ConceptCreated");
  assert.equal(events![0].actor_id, TESTER_ALL_ID, "a real actor");
  assert.ok(events![0].authority_badge, "a real badge");
});

test("DRIVEN: a new Version of an existing code is born Draft; its approval deprecates the previous Active Version", async () => {
  const conceptType = freshConceptType();
  const code = "second-code";
  const v1 = await addConcept({ conceptType, code, defaultLabel: "V1 Label" }, ACTOR);
  // v1 lands in Draft (row 1/New); it must be Active before it can be the
  // "already Active" thing row 2/Edit supersedes — same as a real
  // ontology_approve holder approving it first.
  await approveConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  const v2 = await addConcept({ conceptType, code, defaultLabel: "V2 Label" }, ACTOR);
  assert.equal(v2.version, "1.0.1", "editing an existing code bumps the patch version");
  assert.equal(v2.status, "Draft", "a new Version waits for approval, like a new code");
  assert.equal((await ontologyDB.findConceptById(v1.id)).data?.status, "Active", "the previous Version stays Active until the new one is approved");

  const { data: v2Events } = await eventsDB.findByOriginatingObject("Ontology", v2.id);
  assert.deepEqual((v2Events ?? []).map((e) => e.event_type), ["ConceptCreated"]);

  await approveConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  assert.equal((await ontologyDB.findConceptById(v2.id)).data?.status, "Active");
  assert.equal((await ontologyDB.findConceptById(v1.id)).data?.status, "Deprecated");
  const { data: v1Events } = await eventsDB.findByOriginatingObject("Ontology", v1.id);
  assert.deepEqual((v1Events ?? []).map((e) => e.event_type), ["ConceptCreated", "ConceptApproved", "ConceptDeprecated"]);
});

test("DRIVEN: row 3 (Edit metadata — text_type/ui_grouping) publishes ConceptUpdated in place, no new Version", async () => {
  const conceptType = freshConceptType();
  const code = "third-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "Third Code" }, ACTOR);
  // updateConceptMeta only edits the Active row (ontologyDB.findActiveConcept)
  // — approve the freshly-added Draft first.
  await approveConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);

  const updated = await updateConceptMeta(conceptType, code, PLATFORM_TENANT_ID, { textType: "text" }, ACTOR);
  assert.equal(updated.id, created.id, "same row, no new Version");
  assert.equal(updated.version, "1.0.0");
  assert.equal(updated.text_type, "text");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["ConceptCreated", "ConceptApproved", "ConceptUpdated"]);
});

test("DRIVEN: Compose (Specialization) is born Draft and publishes OntologyComposed after ConceptCreated", async () => {
  const sourceType = freshConceptType();
  const source = await addConcept({ conceptType: sourceType, code: "source-code", defaultLabel: "Source Label", description: "Source description" }, ACTOR);
  // composeConcept requires the source to be Active — approve the
  // freshly-added Draft first.
  await approveConcept(sourceType, "source-code", PLATFORM_TENANT_ID, ACTOR);

  const targetType = freshConceptType();
  const composed = await composeConcept({ conceptType: targetType, code: "composed-code", strategy: "specialization", sourceConceptId: source.id }, ACTOR);
  assert.equal(composed.composition_strategy, "specialization");
  assert.equal(composed.status, "Draft", "a composed concept waits for approval");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", composed.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.ok(eventTypes.includes("ConceptCreated"), `expected ConceptCreated among: ${eventTypes.join(", ")}`);
  assert.ok(eventTypes.includes("OntologyComposed"), `expected OntologyComposed among: ${eventTypes.join(", ")}`);
  assert.ok(eventTypes.indexOf("ConceptCreated") < eventTypes.indexOf("OntologyComposed"), "ConceptCreated comes first");
});

test("REJECT: refused without a comment, keeps the trimmed comment with actor and badge, leaves the concept Draft", async () => {
  const conceptType = freshConceptType();
  const code = "reject-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "Reject Code" }, ACTOR);
  await assert.rejects(() => rejectConcept(conceptType, code, PLATFORM_TENANT_ID, "   ", ACTOR), /policy-comment-required/);
  assert.equal((await ontologyDB.getConceptComments(created.id)).data?.length, 0, "a refused reject stores no comment");

  const rejected = await rejectConcept(conceptType, code, PLATFORM_TENANT_ID, "  needs a clearer label  ", ACTOR);
  assert.equal(rejected.status, "Draft");
  const { data: comments } = await ontologyDB.getConceptComments(created.id);
  assert.equal(comments!.length, 1);
  assert.equal(comments![0].comment_text, "needs a clearer label");
  assert.equal(comments![0].actor_id, TESTER_ALL_ID);
  assert.equal(comments![0].authority_badge, "root");
  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  assert.ok((events ?? []).some((e) => e.event_type === "ConceptRejected"), "ConceptRejected published");
});

test("PROPOSAL: a ConceptCreated event with no version creates a Draft through the birth row", async () => {
  await ensureEventSubscriptionsLoaded();
  const conceptType = freshConceptType();
  const code = "proposed-code";
  await emitConceptCreated({ originatingObjectType: "Pack", originatingObjectId: randomUUID(), code, conceptType, actorId: TESTER_ALL_ID, badge: "root" });
  await waitUntilAsync(async () => !!(await ontologyDB.findLatestVersion(conceptType, code, PLATFORM_TENANT_ID)).data);
  const { data: concept } = await ontologyDB.findLatestVersion(conceptType, code, PLATFORM_TENANT_ID);
  assert.ok(concept, "the subscriber created the concept");
  assert.equal(concept!.status, "Draft");
  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", concept!.id);
  const created = (events ?? []).filter((e) => e.event_type === "ConceptCreated");
  assert.equal(created.length, 1, "the birth event is published once");
  assert.equal(created[0].payload.version, "1.0.0", "the birth event carries a version, so the handler ignores it");
});

test("SYNC: syncConceptFromEntity returns an Active concept", async () => {
  const conceptType = freshConceptType();
  const synced = await syncConceptFromEntity(conceptType, "synced-code", "Synced", null, PLATFORM_TENANT_ID, TESTER_ALL_ID);
  assert.equal(synced.status, "Active");
  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", synced.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["ConceptCreated", "ConceptApproved"]);
});

test("DRIVEN: rows 5-7 (Deprecate/Retire/Archive) each publish their matching event", async () => {
  const conceptType = freshConceptType();
  const code = "lifecycle-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "Lifecycle Code" }, ACTOR);
  // deprecateConcept only accepts an Active row — approve the freshly-added
  // Draft first.
  await approveConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);

  await deprecateConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  await retireConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  const archived = await archiveConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  assert.equal(archived.status, "Archived");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["ConceptDeprecated", "OntologyConceptRetired", "OntologyConceptArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});
