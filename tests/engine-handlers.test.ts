// Event handlers of the engine (src/domain/engine): ebmActivated, conceptCreated, commandGenerated, workItemGenerated and executionEngineKickoff.
// The handlers that act on a good event are covered by the pipeline tests. This file calls each handler with the events its guards refuse:
// a row that does not exist, a payload that is incomplete, and a commissioning that fails.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { createObligation } from "../src/routes/seu/core/obligations.js";
import { raiseAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { ebmActivatedHandler } from "../src/domain/engine/ebmActivated.js";
import { conceptCreatedHandler } from "../src/domain/engine/conceptCreated.js";
import { commandGeneratedHandler } from "../src/domain/engine/commandGenerated.js";
import { workItemGeneratedHandler } from "../src/domain/engine/workItemGenerated.js";
import { executionEngineKickoffHandler } from "../src/domain/engine/executionEngineKickoff.js";
import { publishTestEvent } from "./engineFixtures.js";
import { initiatedSeu, ebmFromComposition, commissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

const eventTypesOf = async (type: string, id: string) => ((await eventsDB.findByOriginatingObject(type, id)).data ?? []).map((e) => e.event_type);

// ── ebmActivated ──────────────────────────────────────────────────────────────────────────────────────────────────

test("the EBM activation handler does nothing for an EBM that does not exist", async () => {
  const ebmId = randomUUID();
  await ebmActivatedHandler(await publishTestEvent({ eventType: "EBMActivated", originatingObjectType: "EBM", originatingObjectId: ebmId }));
  assert.deepEqual(await eventTypesOf("EBM", ebmId), ["EBMActivated"], "nothing else is published");
});

test("the EBM activation handler fails the SEU when the EBM records no settled result", async () => {
  const { seu } = await initiatedSeu("ebm-activated-unsettled");
  const ebm = await ebmFromComposition(seu.id, { composedPacks: [], settled: {}, recordedConflicts: [] });
  await ebmActivatedHandler(await publishTestEvent({ eventType: "EBMActivated", originatingObjectType: "EBM", originatingObjectId: ebm.id, seuId: seu.id }));
  assert.equal((await seusDB.findById(seu.id)).data?.lifecycle_state, "Failed");
});

test("the EBM activation handler fails the SEU when the commissioning steps are refused", async () => {
  // The SEU is still Initiated, so the first commissioning hop (to Configured) has no Transition Definition.
  const { seu } = await initiatedSeu("ebm-activated-refused");
  const ebm = await ebmFromComposition(seu.id, { composedPacks: [], settled: { capabilities: { result: [] }, services: { result: [] } }, recordedConflicts: [] });
  await ebmActivatedHandler(await publishTestEvent({ eventType: "EBMActivated", originatingObjectType: "EBM", originatingObjectId: ebm.id, seuId: seu.id }));
  assert.equal((await seusDB.findById(seu.id)).data?.lifecycle_state, "Failed");
});

// ── commandGenerated and workItemGenerated ────────────────────────────────────────────────────────────────────────

test("the Command and Work Item handlers do nothing for a row that does not exist", async () => {
  const commandId = randomUUID();
  await commandGeneratedHandler(await publishTestEvent({ eventType: "CommandGenerated", originatingObjectType: "Command", originatingObjectId: commandId }));
  assert.deepEqual((await workItemsDB.findByCommandIds([commandId])).data, [], "no Work Item is generated");

  const workItemId = randomUUID();
  await workItemGeneratedHandler(await publishTestEvent({ eventType: "WorkItemGenerated", originatingObjectType: "WorkItem", originatingObjectId: workItemId }));
  assert.deepEqual(await eventTypesOf("WorkItem", workItemId), ["WorkItemGenerated"], "nothing is dispatched");
});

// ── conceptCreated ────────────────────────────────────────────────────────────────────────────────────────────────

test("the concept handler ignores an event that carries a version, a payload that is incomplete, an event with no actor and a concept that exists", async () => {
  const code = `zz-concept-${randomUUID().slice(0, 8)}`;
  const emit = (payload: Record<string, unknown>) => publishTestEvent({ eventType: "ConceptCreated", originatingObjectType: "Ontology", originatingObjectId: randomUUID(), payload });
  const draftExists = async (conceptType: string, tenantId: string) => (await ontologyDB.findLatestVersion(conceptType, code, tenantId)).data;

  await conceptCreatedHandler(await emit({ code, conceptType: "template-categories", tenantId: PLATFORM_TENANT_ID, version: "1.0.0" }));
  await conceptCreatedHandler(await emit({ conceptType: "template-categories", tenantId: PLATFORM_TENANT_ID }));
  await conceptCreatedHandler({ ...(await emit({ code, conceptType: "template-categories", tenantId: PLATFORM_TENANT_ID })), actor_id: "" });
  assert.equal(await draftExists("template-categories", PLATFORM_TENANT_ID), null, "none of these inserted a concept");

  const { rows } = await pool.query<{ concept_type: string; code: string; tenant_id: string }>("SELECT concept_type, code, tenant_id FROM ontology_concepts LIMIT 1");
  assert.ok(rows[0], "the Ontology holds a concept");
  const event = await publishTestEvent({ eventType: "ConceptCreated", originatingObjectType: "Ontology", originatingObjectId: randomUUID(), payload: { code: rows[0].code, conceptType: rows[0].concept_type, tenantId: rows[0].tenant_id } });
  await conceptCreatedHandler(event);
  assert.deepEqual(await eventTypesOf("Ontology", event.originating_object_id), ["ConceptCreated"], "an existing concept publishes nothing");
});

test("the concept handler inserts nothing when the Draft concept cannot be written", async () => {
  const code = `zz-concept-${randomUUID().slice(0, 8)}`;
  const tenantId = randomUUID();
  const event = await publishTestEvent({ eventType: "ConceptCreated", originatingObjectType: "Ontology", originatingObjectId: randomUUID(), payload: { code, conceptType: "template-categories", tenantId } });
  await conceptCreatedHandler(event);
  assert.equal((await ontologyDB.findLatestVersion("template-categories", code, tenantId)).data, null, "a tenant that does not exist cannot own a concept");
  assert.deepEqual(await eventTypesOf("Ontology", event.originating_object_id), ["ConceptCreated"]);
});

// ── executionEngineKickoff ────────────────────────────────────────────────────────────────────────────────────────

test("the kickoff handler ignores an event type it does not handle and a transition that does not resolve anything", async () => {
  const id = randomUUID();
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "SomethingElse", originatingObjectType: "SEU", originatingObjectId: id }));
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "ObligationTransitioned", originatingObjectType: "Obligation", originatingObjectId: id, payload: {} }));
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "ObligationTransitioned", originatingObjectType: "Obligation", originatingObjectId: id, payload: { toState: "Open" } }));
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "AttentionItemTransitioned", originatingObjectType: "AttentionItem", originatingObjectId: id, payload: {} }));
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "AttentionItemTransitioned", originatingObjectType: "AttentionItem", originatingObjectId: id, payload: { toState: "Open" } }));
});

test("the kickoff handler ignores a resolved Obligation or Attention Item that does not exist", async () => {
  const id = randomUUID();
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "ObligationTransitioned", originatingObjectType: "Obligation", originatingObjectId: id, payload: { toState: "Verified" } }));
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "AttentionItemTransitioned", originatingObjectType: "AttentionItem", originatingObjectId: id, payload: { toState: "Resolved" } }));
});

test("the kickoff handler leaves the SEU alone when the resolved Obligation did not block it, or the Obligation or Attention Item belongs to another object", async () => {
  const { seu, systemParticipantId } = await commissionedSeu("kickoff-unrelated");
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth, "the Deliverable has a birth row");
  const { data: deliverable } = await deliverablesDB.create({ seuId: seu.id, name: `kickoff-unrelated ${randomUUID()}`, state: birth.to_state, authorId: systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(deliverable, "the Deliverable is created");
  const { data: before } = await seusDB.findById(seu.id);

  const unblocking = await createObligation({ relatedObjectType: "SEU", relatedObjectId: seu.id, category: "Operational", title: "Obligation that blocks nothing", actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "ObligationTransitioned", originatingObjectType: "Obligation", originatingObjectId: unblocking.id, seuId: seu.id, payload: { toState: "Verified" } }));

  const blockingOther = await createObligation({
    relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Operational", title: "Obligation on a Deliverable", blockedFromState: "Defined", blockedToState: "In Progress",
    actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "ObligationTransitioned", originatingObjectType: "Obligation", originatingObjectId: blockingOther.id, seuId: seu.id, payload: { toState: "Closed" } }));

  const { attentionItem } = await raiseAttentionItem({
    seuId: seu.id, category: "Action Required", title: "Attention Item on a Deliverable", relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  await executionEngineKickoffHandler(await publishTestEvent({ eventType: "AttentionItemTransitioned", originatingObjectType: "AttentionItem", originatingObjectId: attentionItem.id, seuId: seu.id, payload: { toState: "Resolved" } }));

  assert.equal((await seusDB.findById(seu.id)).data?.lifecycle_state, before?.lifecycle_state, "the SEU did not move");
});
