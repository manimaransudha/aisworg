// Version Feature Plan.md, point 1, CR-128 and Events and Lifecycles.md Ch.15. An executable check of the runtime
// Deliverable's own transition_definitions rows (entity type Deliverable), including the birth row.
//
// Scope note: this file covers the RUNTIME Deliverable (the `deliverables` table), which the Execution Engine moves
// with Commands. The authored Deliverable Definition has its own entity type and its own file.
//
//   - DEFINITION: every row's transition_definitions record matches the table.
//   - BIRTH: the birth row is read for creation and the creation badge is checked.
//   - DRIVEN: commissioning creates the Deliverables through the birth row; each governed hop publishes the hop's own
//     event and then DeliverableTransitioned, which every Deliverable transition publishes. No mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { query } from "../src/utils/db.js";
import {
  ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates, commissionFromFormSync, ensureActorParticipant,
  resolveDispatchRejectionObligations, fulfilCapabilityAsRoot as fulfilCapability, produceDeliverable, transitionDeliverableSync,
  ROOT_ACTOR_ID, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY,
} from "./testFixtures.js";

interface TableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  trigger: string;
  eventType: string;
}

const DELIVERABLE_TABLE: TableRow[] = [
  { row: 1, description: "Define (birth)", fromState: "None", toState: "Defined", verb: "define", trigger: "manual", eventType: "DeliverableCreated" },
  { row: 2, description: "Start", fromState: "Defined", toState: "In Progress", verb: "create", trigger: "governed", eventType: "DeliverableUpdated" },
  { row: 3, description: "Approve", fromState: "In Progress", toState: "Approved", verb: "approve", trigger: "manual", eventType: "DeliverableApproved" },
  { row: 4, description: "Baseline", fromState: "Approved", toState: "Baselined", verb: "baseline", trigger: "manual", eventType: "DeliverableBaselined" },
];

async function commissionAndProduce(prefix: string): Promise<{ seuId: string; deliverableId: string }> {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromFormSync(
    {
      statement: `${prefix}-${randomUUID()}`,
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
    },
    async (seuId) => {
      const detail = await getSeuDetailView(seuId);
      const capability = detail?.capabilities.find((c) => c.code === "requirements-analysis");
      assert.ok(capability);
      await fulfilCapability({ seuId, capabilityId: capability.capabilityId, capabilityCodes: ["requirements-analysis"] });
    }
  );
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = detail?.deliverables.find((d) => d.name === "Requirements Analysis Model");
  assert.ok(deliverable);
  await resolveDispatchRejectionObligations(result.seu.id);
  await ensureActorParticipant(result.seu.id, ROOT_ACTOR_ID);
  await produceDeliverable(deliverable.id, ROOT_ACTOR_ID);
  return { seuId: result.seu.id, deliverableId: deliverable.id };
}

test("DEFINITION: every runtime Deliverable transition_definitions row matches its own verb, trigger and event_type, and there are exactly the table's rows", async () => {
  for (const row of DELIVERABLE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Deliverable", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Deliverable ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.verb, row.verb, `row ${row.row} (${row.description}): verb`);
    assert.equal(def!.trigger, row.trigger, `row ${row.row} (${row.description}): trigger`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, null, `row ${row.row} (${row.description}): a runtime Deliverable is not versioned`);
  }
  const { rows } = await query<{ from_state: string }>("SELECT from_state FROM transition_definitions WHERE entity_type = 'Deliverable'");
  assert.equal(rows.length, DELIVERABLE_TABLE.length);
});

test("BIRTH: the birth row is the only row from None and starts a Deliverable in Defined", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.equal(birth?.to_state, "Defined");
  assert.equal(birth?.event_type, "DeliverableCreated");
});

test("BIRTH: an actor without deliverable_define is refused, and the superuser is not", async () => {
  await assert.rejects(() => transitionEngine.beginBirth({ entityType: "Deliverable", actorId: TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId }), /does not hold deliverable_define/);
  const birth = await transitionEngine.beginBirth({ entityType: "Deliverable", actorId: ROOT_ACTOR_ID });
  assert.equal(birth.initialState, "Defined");
  assert.equal(birth.eventType, "DeliverableCreated");
});

test("DRIVEN: commissioning creates a Deliverable in the birth state, authored by the SEU's system participant", async () => {
  const { deliverableId } = await commissionAndProduce("deliverable-birth");
  const { data: deliverable } = await deliverablesDB.findById(deliverableId);
  assert.ok(deliverable);
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  const { data: events } = await eventsDB.findByOriginatingObject("Deliverable", deliverableId);
  assert.ok((events ?? []).length > 0, "the Deliverable has moved on from its birth state");
  assert.equal(birth?.to_state, "Defined");
});

test("DRIVEN: each governed hop publishes the hop's own event and then DeliverableTransitioned", async () => {
  const { deliverableId } = await commissionAndProduce("deliverable-hops");
  const approved = await transitionDeliverableSync({ deliverableId, targetState: "Approved", actorId: ROOT_ACTOR_ID });
  assert.equal(approved.ok, true, !approved.ok ? JSON.stringify(approved) : "assertion failed");

  const { data: events } = await eventsDB.findByOriginatingObject("Deliverable", deliverableId);
  const types = (events ?? []).map((e) => e.event_type);
  for (const [domainEvent, toState] of [["DeliverableUpdated", "In Progress"], ["DeliverableApproved", "Approved"]] as const) {
    const at = types.indexOf(domainEvent);
    assert.ok(at >= 0, `expected ${domainEvent}, got: ${types.join(", ")}`);
    assert.equal(types[at + 1], "DeliverableTransitioned", `${domainEvent} is followed by DeliverableTransitioned`);
    assert.equal((events![at + 1].payload as { toState?: string }).toState, toState);
  }
});
