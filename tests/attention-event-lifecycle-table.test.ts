// CR-128 Entity 14: the AttentionItem birth row and the governed hops.
//
//   - DEFINITION: the birth row None -> Created (verb raise, trigger governed, event AttentionCreated, no version event)
//     and the five hop rows with the Chapter 34 events (AttentionStarted is the one name the chapter does not give).
//   - DRIVEN: createAttentionItem writes the birth state and publishes the birth event; every hop publishes the row's
//     event and then AttentionItemTransitioned with one correlation id; a refused hop writes and publishes nothing; an
//     actor with no participant row in the SEU is refused.
//   - GUARD: only the AttentionItem adapter writes the status and no code names the birth event as a literal.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { createAttentionItem, transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { commissionFromFormSync, ensureEventSubscriptionsLoaded, resolveDispatchRejectionObligations, TESTER_ALL_ID, TESTER_ACCEPTANCE_JOURNEY, ROOT_ACTOR_BADGE } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

const HOPS = [
  { fromState: "Created", toState: "Delivered", verb: "deliver", eventType: "AttentionDelivered" },
  { fromState: "Delivered", toState: "Acknowledged", verb: "acknowledge", eventType: "AttentionAcknowledged" },
  { fromState: "Acknowledged", toState: "In Progress", verb: "start", eventType: "AttentionStarted" },
  { fromState: "In Progress", toState: "Resolved", verb: "resolve", eventType: "AttentionResolved" },
  { fromState: "Resolved", toState: "Closed", verb: "close", eventType: "AttentionClosed" },
];

test("DEFINITION: the birth row and the five hop rows", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("AttentionItem");
  assert.ok(birth, "the AttentionItem birth row exists");
  assert.equal(birth!.to_state, "Created");
  assert.equal(birth!.verb, "raise");
  assert.equal(birth!.trigger, "governed");
  assert.equal(birth!.event_type, "AttentionCreated");
  assert.equal(birth!.version_event, null);

  for (const hop of HOPS) {
    const { data: def } = await transitionDefinitionsDB.find("AttentionItem", hop.fromState, hop.toState);
    assert.ok(def, `no row for AttentionItem ${hop.fromState} -> ${hop.toState}`);
    assert.equal(def!.verb, hop.verb);
    assert.equal(def!.event_type, hop.eventType, `${hop.fromState} -> ${hop.toState}: event_type`);
    assert.equal(def!.version_event, null, `${hop.fromState} -> ${hop.toState}: version_event`);
  }
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = 'AttentionItem'");
  assert.equal(Number(rows[0].count), HOPS.length + 1, "unexpected extra/missing AttentionItem rows (the hops plus the birth row)");
});

let seuId: string;

async function freshItem(title: string) {
  return createAttentionItem({ seuId, category: "Action Required", title: `${title} ${randomUUID()}`, actorId: TESTER_ALL_ID, authorBadge: ROOT_ACTOR_BADGE });
}

async function eventTypesFor(id: string): Promise<string[]> {
  const { data: events } = await eventsDB.findByOriginatingObject("AttentionItem", id);
  return (events ?? []).map((e) => e.event_type);
}

test("DRIVEN setup: a real SEU to hang Attention Items off", async () => {
  const result = await commissionFromFormSync({
    statement: `attention-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID,
    requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, result.ok ? "" : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;
  seuId = result.seu.id;
  await resolveDispatchRejectionObligations(seuId);
});

test("DRIVEN: createAttentionItem writes the birth state and publishes the birth event; a governed birth row offers no button", async () => {
  const item = await freshItem("birth");
  assert.equal(item.status, "Created");
  assert.deepEqual(await eventTypesFor(item.id), ["AttentionCreated"]);
  const actions = await nextActionsFor("AttentionItem", "Created", TESTER_ALL_ID);
  assert.deepEqual(actions.map((a) => a.verb), ["deliver"]);
});

test("DRIVEN: every hop publishes the row's event and then AttentionItemTransitioned with one correlation id", async () => {
  const item = await freshItem("main chain");
  for (const hop of HOPS) {
    const result = await transitionAttentionItem({ attentionItemId: item.id, targetState: hop.toState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, !result.ok ? `-> ${hop.toState} failed: ${JSON.stringify(result)}` : "assertion failed");
  }
  const { data: events } = await eventsDB.findByOriginatingObject("AttentionItem", item.id);
  const types = (events ?? []).map((e) => e.event_type);
  for (const hop of HOPS) assert.ok(types.includes(hop.eventType), `missing ${hop.eventType}`);
  assert.equal(types.filter((t) => t === "AttentionItemTransitioned").length, HOPS.length, "AttentionItemTransitioned fires once per hop");

  const resolved = (events ?? []).find((e) => e.event_type === "AttentionResolved")!;
  const genericForResolve = (events ?? []).find((e) => e.event_type === "AttentionItemTransitioned" && (e.payload as { toState?: string }).toState === "Resolved")!;
  assert.equal(resolved.correlation_id, genericForResolve.correlation_id);
  assert.deepEqual(resolved.payload, genericForResolve.payload);
});

test("DRIVEN: a hop with no Transition Definition is refused and writes and publishes nothing", async () => {
  const item = await freshItem("refused hop");
  const before = await eventTypesFor(item.id);
  const result = await transitionAttentionItem({ attentionItemId: item.id, targetState: "Resolved", actorId: TESTER_ALL_ID });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "no_transition_definition");
  assert.deepEqual(await eventTypesFor(item.id), before);
  const { data: after } = await attentionItemsDB.findById(item.id);
  assert.equal(after!.status, "Created");
});

test("DRIVEN: a hop by an actor with no participant row in the SEU is refused and writes nothing", async () => {
  const item = await freshItem("no participant");
  // Holds every badge and has no participants row in this SEU, so only the SEU participant check can refuse it.
  await assert.rejects(
    transitionAttentionItem({ attentionItemId: item.id, targetState: "Delivered", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  const { data: after } = await attentionItemsDB.findById(item.id);
  assert.equal(after!.status, "Created");
});

test("GUARD: only the AttentionItem adapter writes the status and no code names the birth event as a literal", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  const statusWriters = files.filter((f) => /attentionItemsDB\.updateStatus\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(statusWriters.map((f) => f.slice(process.cwd().length + 1)), ["src/domain/engine/entityAdapters.ts"]);
  const birthLiterals = files.filter((f) => /["']AttentionCreated["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(birthLiterals, []);
});
