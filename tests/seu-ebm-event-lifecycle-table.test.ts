// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's SEU (Ch.2) and EBM (Ch.3) tables — reached via Chapter 8
// (SEU Commissioning), which has no entity of its own (confirmed) but
// drives both of these real, governed ones.
//
// Unlike every other lifecycle-table test file, NEITHER entity gets a
// version_event anywhere (confirmed with the owner, 2026-09-11):
//   - SEU's lifecycle_state is a runtime EXECUTION lifecycle (a single
//     instance moving through states), not the definition/authoring
//     lifecycle (Draft -> Validated -> Published -> Active, a reusable
//     versioned catalog entry) this plan's Revision-vs-Version distinction
//     is about.
//   - EBM's Validate/Activate hops are explicitly not version-significant
//     either (CR-092 Part 9, owner: "did i not say version is not part of
//     validation" — EBMVersioned is its own separate, not-yet-built
//     re-composition concern).
//
// Also unlike every other entity so far, SEU's own transition_definitions
// table has TWO chains: the one the code actually runs (below), and a
// second, deliberately dormant vocabulary-only chain CR-092 Part 4 added on
// purpose ("No code wiring yet") and Part 9 re-deferred. This file only
// covers the real, exercised chain.
//
//   - DEFINITION: every row's transition_definitions record (event_type,
//     always-null version_event) matches the table.
//   - DRIVEN: a real commissionFromFormSync run all the way to Operational,
//     asserting the SEU/EBM events actually published match
//     transition_definitions.event_type.
import "dotenv/config";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { commissionFromFormSync, ensureEventSubscriptionsLoaded } from "./testFixtures.js";

before(async () => {
  // Must run before this file's own first commissionFromFormSync call — see
  // ensureEventSubscriptionsLoaded's own header comment (testFixtures.ts).
  await ensureEventSubscriptionsLoaded();
});

after(async () => {
  await pool.end();
});

interface RealHop {
  entityType: "SEU" | "EBM";
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
}

const REAL_HOPS: RealHop[] = [
  { entityType: "SEU", description: "Configure", fromState: "Pending", toState: "Configured", eventType: "SEUConfigured" },
  { entityType: "SEU", description: "Commission", fromState: "Configured", toState: "Commissioned", eventType: "SEUCommissioned" },
  { entityType: "SEU", description: "Activate", fromState: "Commissioned", toState: "Activated", eventType: "SEUActivated" },
  { entityType: "SEU", description: "Operationalise", fromState: "Activated", toState: "Operational", eventType: "SEUOperational" },
  { entityType: "EBM", description: "Validate", fromState: "Composed", toState: "Validated", eventType: "EBMValidated" },
  { entityType: "EBM", description: "Activate", fromState: "Validated", toState: "Active", eventType: "EBMActivated" },
];

// Rows CR-092 Part 4 added as vocabulary only, no code ever calls
// transitionEngine.evaluate for any of them — checked directly, matching
// migration 189's own reasoning, so a future accidental UPDATE against one
// of these doesn't go unnoticed.
const DORMANT_SEU_HOPS: Array<{ fromState: string; toState: string }> = [
  { fromState: "Pending", toState: "Validated" },
  { fromState: "Validated", toState: "Composed" },
  { fromState: "Composed", toState: "RuntimeAllocated" },
  { fromState: "RuntimeAllocated", toState: "KnowledgeInitialised" },
  { fromState: "KnowledgeInitialised", toState: "ParticipantsRecruited" },
  { fromState: "ParticipantsRecruited", toState: "Commissioned" },
];

// Gate-only rows: really evaluated, but no event is ever published off their
// own outcome (checked directly against the code) — so nothing would ever
// read an event_type set here either.
const GATE_ONLY_HOPS: Array<{ entityType: "SEU" | "EBM"; fromState: string; toState: string }> = [
  { entityType: "SEU", fromState: "Pending", toState: "Commissioned" },
  { entityType: "EBM", fromState: "Composed", toState: "Retired" },
];

test("DEFINITION: every real SEU/EBM transition_definitions row matches Events and Lifecycles.md — event_type real, version_event always null", async () => {
  for (const row of REAL_HOPS) {
    const { data: def } = await transitionDefinitionsDB.find(row.entityType, row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for ${row.entityType} ${row.fromState} -> ${row.toState} (${row.description})`);
    assert.equal(def!.event_type, row.eventType, `${row.entityType} ${row.description}: event_type`);
    assert.equal(def!.version_event, null, `${row.entityType} ${row.description}: version_event must be null — execution lifecycle, not a versioned definition`);
  }

  for (const row of DORMANT_SEU_HOPS) {
    const { data: def } = await transitionDefinitionsDB.find("SEU", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for SEU ${row.fromState} -> ${row.toState} (dormant vocabulary)`);
    assert.equal(def!.event_type, null, `SEU ${row.fromState} -> ${row.toState}: dormant row, event_type should stay null`);
  }

  for (const row of GATE_ONLY_HOPS) {
    const { data: def } = await transitionDefinitionsDB.find(row.entityType, row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for ${row.entityType} ${row.fromState} -> ${row.toState} (gate-only)`);
    assert.equal(def!.event_type, null, `${row.entityType} ${row.fromState} -> ${row.toState}: gate-only, no event published off it, event_type should stay null`);
  }
});

test("DRIVEN: a real commissioning run publishes every real SEU/EBM event, matching transition_definitions.event_type", async () => {
  const result = await commissionFromFormSync({
    statement: `seu-ebm-lifecycle-table-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super",
    actorId: "1001",
    requestedBy: 1001,
  });
  assert.equal(result.ok, true, result.ok ? undefined : `${result.stage}: ${result.reason}`);
  if (!result.ok) return;

  const { data: seuEvents } = await eventsDB.findByOriginatingObject("SEU", result.seu.id);
  const seuEventTypes = (seuEvents ?? []).map((e) => e.event_type);
  for (const hop of REAL_HOPS.filter((h) => h.entityType === "SEU")) {
    assert.ok(seuEventTypes.includes(hop.eventType), `expected ${hop.eventType} among SEU's published events, got: ${seuEventTypes.join(", ")}`);
  }

  const { data: seu } = await seusDB.findById(result.seu.id);
  assert.ok(seu?.active_ebm_id, "expected the SEU to carry a real active_ebm_id after Activate");
  const { data: ebmEvents } = await eventsDB.findByOriginatingObject("EBM", seu!.active_ebm_id!);
  const ebmEventTypes = (ebmEvents ?? []).map((e) => e.event_type);
  for (const hop of REAL_HOPS.filter((h) => h.entityType === "EBM")) {
    assert.ok(ebmEventTypes.includes(hop.eventType), `expected ${hop.eventType} among EBM's published events, got: ${ebmEventTypes.join(", ")}`);
  }
});
