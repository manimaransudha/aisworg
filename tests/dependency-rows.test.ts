// Dependency Definition Engine (src/domain/engine/dependencyDefinitionEngine.ts): how one dependency row is judged for an SEU.
//
//   - The rows are built by hand, because a row's judgement reads only the SEU's own Deliverables, Capabilities, Obligations, Decisions, Evidence
//     and Knowledge Items. The test creates each of those for a plain SEU row, with a Deliverable per case so the cases do not read each other's data.
//   - A row that is judged against a state no entity can have ("zz-unreached") is not satisfied, whatever the entity's own state is.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { knowledgeItemsDB } from "../src/dblayer/knowledgeItemsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { createDecision } from "../src/routes/seu/core/decisions.js";
import { createKnowledgeItem } from "../src/routes/seu/core/knowledge.js";
import { dependencyDefinitionEngine } from "../src/domain/engine/dependencyDefinitionEngine.js";
import type { DependencyDefinitionEntityType, DependencyDefinitionRow, DeliverableRow } from "../src/dblayer/seuTypes.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { createObligationAsRoot, createEvidenceAsRoot, supportingEvidenceReferences, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const UNREACHED = "zz-unreached";
let t: CommissionedSeu;
let other: CommissionedSeu;
let birthState: string;
let service: { code: string; providing_capability_id: string };
let capabilityStatus: string;

before(async () => {
  t = await commissionedSeu("dependency-rows");
  other = await commissionedSeu("dependency-rows-other");
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth, "the Deliverable has a birth row");
  birthState = birth.to_state;
  const { rows } = await pool.query<{ code: string; providing_capability_id: string }>("SELECT code, providing_capability_id FROM services WHERE is_active = true ORDER BY created_at LIMIT 1");
  assert.ok(rows[0], "the database holds an active Service");
  service = rows[0];
  await seuCapabilitiesDB.createMany(t.seu.id, [service.providing_capability_id], t.systemParticipantId, ROOT_ACTOR_BADGE);
  const { data: capabilities } = await seuCapabilitiesDB.findBySeuId(t.seu.id);
  const own = (capabilities ?? []).find((c) => c.capability_id === service.providing_capability_id);
  assert.ok(own, "the SEU requires the Capability of the Service");
  capabilityStatus = own.status;
});

async function createDeliverable(label: string): Promise<DeliverableRow> {
  const { data, error } = await deliverablesDB.create({
    seuId: t.seu.id, name: `dependency-rows ${run} ${label} ${randomUUID()}`, state: birthState, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error?.message);
  return data;
}

function row(fields: Partial<DependencyDefinitionRow>): DependencyDefinitionRow {
  return {
    id: randomUUID(), owning_entity_type: "Template", owning_entity_id: randomUUID(), from_entity_type: "Deliverable", from_name: null, from_state: birthState,
    to_entity_type: "Deliverable", to_name: null, to_state: "In Progress", relationship_kind: "dependency", created_at: new Date().toISOString(), ...fields,
  };
}

const satisfied = (r: DependencyDefinitionRow, seuId = t.seu.id) => dependencyDefinitionEngine.isRowSatisfied(seuId, r);

test("a row that names a source Deliverable is satisfied once that Deliverable has reached the state, and not when it is missing or has not", async () => {
  const source = await createDeliverable("source");
  assert.equal(await satisfied(row({ from_name: source.name, from_state: birthState })), true);
  assert.equal(await satisfied(row({ from_name: source.name, from_state: "Baselined" })), false, "the Deliverable has not reached Baselined");
  assert.equal(await satisfied(row({ from_name: `zz-no-deliverable-${run}`, from_state: birthState })), false);
});

test("a row that names a source Capability is satisfied while the SEU's Capability has exactly that status", async () => {
  assert.equal(await satisfied(row({ from_entity_type: "Capability", from_name: service.code, from_state: capabilityStatus })), true);
  assert.equal(await satisfied(row({ from_entity_type: "Capability", from_name: service.code, from_state: UNREACHED })), false);
  assert.equal(await satisfied(row({ from_entity_type: "Capability", from_name: `zz-no-service-${run}`, from_state: capabilityStatus })), false, "no Service has that code");
  assert.equal(await satisfied(row({ from_entity_type: "Capability", from_name: service.code, from_state: capabilityStatus }), other.seu.id), false, "the other SEU does not require the Capability");
});

test("a row that names no source and no target holds for any SEU, and a target that cannot be found never holds", async () => {
  assert.equal(await satisfied(row({})), true);
  assert.equal(await satisfied(row({ to_name: `zz-no-deliverable-${run}` })), false);
  assert.equal(await satisfied(row({ to_entity_type: "Obligation", to_name: "anything" })), false, "only Deliverables and Capabilities can be named as targets");
});

test("an Obligation source holds when the target has none, and when every Obligation of the target has reached the state", async () => {
  const target = await createDeliverable("obligation-target");
  const base = { from_entity_type: "Obligation" as DependencyDefinitionEntityType, to_name: target.name };
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), true, "no Obligation is attached");

  await createObligationAsRoot({ relatedObjectType: "Deliverable", relatedObjectId: target.id, category: "Operational", title: `dependency-rows obligation ${run}` });
  const { data: obligations } = await obligationsDB.findByRelatedObject("Deliverable", target.id);
  assert.equal(obligations?.length, 1);
  assert.equal(await satisfied(row({ ...base, from_state: obligations![0].status })), true);
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), false);
});

test("a Decision source needs a Decision on the target that has reached the state", async () => {
  const target = await createDeliverable("decision-target");
  const supporting = await createDeliverable("decision-support");
  const base = { from_entity_type: "Decision" as DependencyDefinitionEntityType, to_name: target.name };
  assert.equal(await satisfied(row({ ...base, from_state: "Identified" })), false, "no Decision is attached");

  const evidence = await createEvidenceAsRoot({ seuId: t.seu.id, relatedObjectType: "Deliverable", relatedObjectId: supporting.id, category: "Analytical Evidence", title: `decision support ${run}` });
  const decision = await createDecision({
    actorId: ROOT_ACTOR_ID, seuId: t.seu.id, evidenceIds: [evidence.id], relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [target.id] }],
    category: "Engineering Decisions", title: `dependency-rows decision ${run}`,
  });
  assert.equal(await satisfied(row({ ...base, from_state: decision.status })), true);
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), false);
});

test("an Evidence source needs Evidence on the target that has reached the state", async () => {
  const target = await createDeliverable("evidence-target");
  const base = { from_entity_type: "Evidence" as DependencyDefinitionEntityType, to_name: target.name };
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), false, "no Evidence is attached");

  await createEvidenceAsRoot({ seuId: t.seu.id, relatedObjectType: "Deliverable", relatedObjectId: target.id, category: "Analytical Evidence", title: `dependency-rows evidence ${run}` });
  const { data: evidence } = await evidenceDB.findByRelatedObject("Deliverable", target.id);
  assert.equal(await satisfied(row({ ...base, from_state: evidence![0].status })), true);
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), false);
});

test("a Knowledge source needs a Knowledge Item of the target Deliverable that has reached the state, and never holds for a Capability target", async () => {
  const target = await createDeliverable("knowledge-target");
  const base = { from_entity_type: "Knowledge" as DependencyDefinitionEntityType, to_name: target.name };
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), false, "no Knowledge Item is attached");

  await createKnowledgeItem({
    actorId: ROOT_ACTOR_ID, seuId: t.seu.id, deliverableId: target.id, category: "Technical Knowledge", title: `dependency-rows knowledge ${run}`,
    evidenceReferences: await supportingEvidenceReferences(t.seu.id, target.id),
  });
  const { data: items } = await knowledgeItemsDB.findByDeliverableId(target.id);
  assert.equal(await satisfied(row({ ...base, from_state: items![0].status })), true);
  assert.equal(await satisfied(row({ ...base, from_state: UNREACHED })), false);
  assert.equal(await satisfied(row({ from_entity_type: "Knowledge", to_entity_type: "Capability", to_name: service.code, from_state: items![0].status })), false, "a Capability has no Knowledge Items");
});

test("a source of any other kind never holds for a named target", async () => {
  const target = await createDeliverable("other-source-target");
  assert.equal(await satisfied(row({ from_entity_type: "AttentionItem", to_name: target.name, from_state: "Created" })), false);
});

test("an SEU that does not exist has every target ready and publishes nothing", async () => {
  const missing = randomUUID();
  assert.deepEqual(await dependencyDefinitionEngine.isTargetReady(missing, "Deliverable", "anything", "In Progress"), { ready: true, rows: [] });
  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({ seuId: missing, entityType: "Deliverable", name: "anything", newState: "In Progress" });
});
