// Dependency rows of an SEU in flight: how a Template's dependency graph becomes rows (materialiseDependencyGraph.ts), what a Deliverable's transition
// announces to the Deliverables it gates (dependencyDefinitionEngine.evaluateAndPublishFromTransition), and what the Execution Engine says to a
// Deliverable whose gate is not open.
//
//   - The SEU is commissioned on the fixture Profile in a tenant of its own, so the dependency rows its source owns are the test's own.
//   - Deliverable names carry the run tag. Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { dependencyDefinitionsDB } from "../src/dblayer/dependencyDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { materialiseDependencyGraph, DEFAULT_DELIVERABLE_REQUIRED_STATE } from "../src/domain/engine/materialiseDependencyGraph.js";
import { dependencyDefinitionEngine } from "../src/domain/engine/dependencyDefinitionEngine.js";
import { executionEngine } from "../src/domain/engine/executionEngine.js";
import type { DeliverableRow } from "../src/dblayer/seuTypes.js";
import { commissionFixtureSeu, type FixtureSeu } from "./webScenarios.js";
import { createObligationAsRoot, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const code = (name: string) => `zz-${name}-${run}`;
let t: FixtureSeu;
// The object the SEU's EBM recorded as the source of its Deliverables and dependency rows: the fixture Profile, which carries its own catalogue.
let owner: { type: "Template" | "Profile"; id: string };
let birthState: string;

before(async () => {
  t = await commissionFixtureSeu("dependency-flow");
  const { data: ebm } = await ebmsDB.findById(t.seu.active_ebm_id!);
  const source = (ebm!.composition_report as { deliverableSource: { type: "Template" | "Profile"; id: string } }).deliverableSource;
  owner = { type: source.type, id: source.id };
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth);
  birthState = birth.to_state;
});

const materialise = (graph: Parameters<typeof materialiseDependencyGraph>[0]["dependencyGraph"], codes: string[]) =>
  materialiseDependencyGraph({
    owningEntityType: owner.type, owningEntityId: owner.id, deliverableCatalogue: codes.map((c) => ({ code: c })), dependencyGraph: graph,
    tenantId: t.tenantId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });

test("a dependency graph becomes one row for each entry that names Deliverables of the catalogue, and a new graph replaces the old rows", async () => {
  const [a, b, c] = [code("a"), code("b"), code("c")];
  const first = await materialise([
    { fromType: "Deliverable", fromCode: a, toCode: b },
    { fromType: "Deliverable", fromCode: b, toCode: c, requiredState: "Baselined", relationshipKind: "derivation" },
    { fromType: "Deliverable", fromCode: c },
    { fromType: "Deliverable", fromCode: code("not-in-catalogue"), toCode: a },
    { fromType: "Deliverable", fromCode: a, toCode: code("not-in-catalogue") },
    { fromType: "Deliverable", toCode: a },
    { fromType: "Capability", fromCapabilityCode: "anything", toCode: a },
  ], [a, b, c]);
  assert.ok(first.data);
  assert.equal(first.data.length, 3, "only the three entries that name catalogue Deliverables become rows");

  const byFrom = new Map(first.data.map((r) => [r.from_name, r]));
  const rowA = byFrom.get(a)!;
  assert.deepEqual([rowA.to_name, rowA.to_state, rowA.from_state, rowA.relationship_kind], [b, "In Progress", DEFAULT_DELIVERABLE_REQUIRED_STATE, "dependency"], "the default state and kind");
  const rowB = byFrom.get(b)!;
  assert.deepEqual([rowB.from_state, rowB.relationship_kind], ["Baselined", "derivation"], "the state and kind the entry gave");
  const rowC = byFrom.get(c)!;
  assert.deepEqual([rowC.to_name, rowC.to_state], [null, null], "a standalone node gates nothing");

  const second = await materialise([{ fromType: "Deliverable", fromCode: a, toCode: b }], [a, b]);
  assert.equal(second.data?.length, 1);
  assert.equal((await dependencyDefinitionsDB.findByOwner(owner.type, owner.id)).data?.length, 1, "the old rows are gone");
});

async function createDeliverable(name: string, state: string = birthState): Promise<DeliverableRow> {
  const { data, error } = await deliverablesDB.create({ seuId: t.seu.id, name, state, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(data && !error, error?.message);
  return data;
}

test("a Deliverable reaching a state announces only the gated Deliverables whose every dependency now holds", async () => {
  const [source, other, gated, open, ghost] = [code("source"), code("other"), code("gated"), code("open"), code("ghost")];
  const row = (fromName: string, toName: string | null) => dependencyDefinitionsDB.create({
    owningEntityType: owner.type, owningEntityId: owner.id, fromEntityType: "Deliverable", fromName, fromState: "Approved", toEntityType: "Deliverable", toName,
    toState: toName ? "In Progress" : null, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  await dependencyDefinitionsDB.deleteByOwner(owner.type, owner.id);
  for (const [from, to] of [[source, null], [source, gated], [other, gated], [source, ghost], [source, open]] as Array<[string, string | null]>) {
    const { error } = await row(from, to);
    assert.ok(!error, error?.message);
  }
  await createDeliverable(source, "Approved");
  await createDeliverable(other);
  await createDeliverable(gated);
  const openDeliverable = await createDeliverable(open);

  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({ seuId: t.seu.id, entityType: "Deliverable", name: source, newState: "Approved" });

  const ready = async (deliverableId: string) => ((await eventsDB.findByOriginatingObject("Deliverable", deliverableId)).data ?? []).filter((e) => e.event_type === "DeliverableReady");
  assert.equal((await ready(openDeliverable.id)).length, 1, "every dependency of the open Deliverable holds");
  const { data: all } = await deliverablesDB.findBySeuId(t.seu.id);
  const gatedDeliverable = all!.find((d) => d.name === gated)!;
  assert.equal((await ready(gatedDeliverable.id)).length, 0, "the other source has not reached Approved, so the gated Deliverable is not announced");
});

test("the Execution Engine refuses a Deliverable whose dependency rows are not satisfied, and says which, by name or by kind", async () => {
  const [source, target] = [code("req-source"), code("req-target")];
  await dependencyDefinitionsDB.deleteByOwner(owner.type, owner.id);
  await dependencyDefinitionsDB.create({
    owningEntityType: owner.type, owningEntityId: owner.id, fromEntityType: "Deliverable", fromName: source, fromState: "Approved", toEntityType: "Deliverable", toName: target,
    toState: "In Progress", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  await dependencyDefinitionsDB.create({
    owningEntityType: owner.type, owningEntityId: owner.id, fromEntityType: "Obligation", fromName: null, fromState: "Verified", toEntityType: "Deliverable", toName: target,
    toState: "In Progress", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  await createDeliverable(source);
  const gatedDeliverable = await createDeliverable(target);
  await createObligationAsRoot({ relatedObjectType: "Deliverable", relatedObjectId: gatedDeliverable.id, category: "Operational", title: `Open obligation ${run}` });

  const result = await executionEngine.evaluateDeliverableTransition({ deliverable: gatedDeliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "dependency_not_satisfied");
  const { data: events } = await eventsDB.findByOriginatingObject("Deliverable", gatedDeliverable.id);
  const blocked = (events ?? []).find((e) => e.event_type === "DeliverableBlocked");
  const reason = (blocked?.payload as { reason?: string } | undefined)?.reason ?? "";
  assert.ok(reason.includes(`Deliverable "${source}" -> Approved`) && reason.includes("Obligation -> Verified"), reason);
});
