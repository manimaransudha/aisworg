// Version Feature Plan.md, point 1: an executable check of Ch.16's own
// Knowledge lifecycle table (§9), same discipline as
// policy-definition-event-lifecycle-table.test.ts (Ch.24) /
// service-definition-event-lifecycle-table.test.ts (Ch.11). KNOWLEDGE_TABLE
// covers the real 6-hop status lifecycle (Observed→...→Archived); the
// birth row None -> Observed (CR-132) is asserted separately below.
// KNOWLEDGE_SCOPE_TABLE covers Acquisition Scope promotion
// separately — owner-confirmed NOT version-significant (promoting scope
// broadens an existing version's reach, it does not mint a new version),
// so every row's versionEvent is null, the same treatment SEU/EBM's runtime
// lifecycle got in Chapter 8's own pass.
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through transitionKnowledgeItem/
//     promoteKnowledgeItemScope and the events it publishes are asserted
//     against eventsDB directly — no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import pool from "../src/utils/db.js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { knowledgeItemsDB } from "../src/dblayer/knowledgeItemsDB.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { createKnowledgeItem, transitionKnowledgeItem, promoteKnowledgeItemScope } from "../src/routes/seu/core/knowledge.js";
import { ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates, commissionFromFormSync, ROOT_ACTOR_ID, ensureActorParticipant, supportingEvidenceReferences } from "./testFixtures.js";
import { TESTER_ALL_ID, TESTER_ACCEPTANCE_JOURNEY } from "./testFixtures.js";
import type { AcquisitionScope, KnowledgeItemRow } from "../src/dblayer/seuTypes.js";

async function commissionTestSeuAndDeliverable(): Promise<{ seuId: string; deliverableId: string }> {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromFormSync({
    statement: `knowledge-lifecycle-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  const detail = await getSeuDetailView(result.seu.id);
  const deliverable = detail?.deliverables[0];
  assert.ok(deliverable, "expected at least one Deliverable on the commissioned SEU");
  return { seuId: result.seu.id, deliverableId: deliverable!.id };
}

interface KnowledgeTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  verb: string;
  eventType: string;
  versionEvent: string | null;
}

const KNOWLEDGE_TABLE: KnowledgeTableRow[] = [
  { row: 1, description: "Propose", fromState: "Observed", toState: "Proposed", verb: "propose", eventType: "KnowledgeProposed", versionEvent: "VersionCreated" },
  { row: 2, description: "Validate", fromState: "Proposed", toState: "Validated", verb: "validate", eventType: "KnowledgeValidated", versionEvent: "VersionValidated" },
  { row: 3, description: "Accept", fromState: "Validated", toState: "Accepted", verb: "accept", eventType: "KnowledgeAccepted", versionEvent: "VersionActivated" },
  { row: 4, description: "Publish", fromState: "Accepted", toState: "Published", verb: "publish", eventType: "KnowledgePublished", versionEvent: "VersionPublished" },
  { row: 5, description: "Deprecate", fromState: "Published", toState: "Deprecated", verb: "deprecate", eventType: "KnowledgeDeprecated", versionEvent: "VersionDeprecated" },
  { row: 6, description: "Archive", fromState: "Deprecated", toState: "Archived", verb: "archive", eventType: "KnowledgeArchived", versionEvent: "VersionArchived" },
];

interface KnowledgeScopeTableRow {
  row: number;
  fromState: AcquisitionScope;
  toState: AcquisitionScope;
  eventType: string;
}

const KNOWLEDGE_SCOPE_TABLE: KnowledgeScopeTableRow[] = [
  { row: 1, fromState: "SEU", toState: "Capability", eventType: "KnowledgeScopePromoted" },
  { row: 2, fromState: "Capability", toState: "Enterprise", eventType: "KnowledgeScopePromoted" },
  { row: 3, fromState: "Enterprise", toState: "Platform", eventType: "KnowledgeScopePromoted" },
];

test("DEFINITION: every Knowledge transition_definitions row matches Ch.16 §9's event_type/version_event", async () => {
  for (const row of KNOWLEDGE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Knowledge", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Knowledge ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step — creation into Observed is ungoverned.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

test("DEFINITION: every KnowledgeScope transition_definitions row has event_type set and version_event null (not version-significant)", async () => {
  for (const row of KNOWLEDGE_SCOPE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("KnowledgeScope", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for KnowledgeScope ${row.fromState} -> ${row.toState} (table row ${row.row})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row}: event_type`);
    assert.equal(def!.version_event, null, `row ${row.row}: version_event should be null — scope promotion broadens an existing version's reach, it does not mint a new version`);
  }
});

test("DRIVEN: every Knowledge lifecycle hop publishes its matching event, in order, and authority_badge tracks the most recent hop (version stays unbumped — no Edit path yet)", async () => {
  const { seuId, deliverableId } = await commissionTestSeuAndDeliverable();
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const knowledgeItem = await createKnowledgeItem({ actorId: ROOT_ACTOR_ID, seuId, deliverableId, category: "Technical Knowledge", title: "Knowledge lifecycle-table test item", evidenceReferences: await supportingEvidenceReferences(seuId, deliverableId) });
  assert.equal(knowledgeItem.version, "1.0.0");
  assert.equal(knowledgeItem.authority_badge, "root", "creation records the badge the author acted under");

  let last: KnowledgeItemRow = knowledgeItem;
  await ensureActorParticipant(seuId, TESTER_ACCEPTANCE_JOURNEY.participantId);
  // TESTER_ALL_ID resolves to root, which records "root". A non-root holder of every noun_verb badge records the hop's own badge.
  for (const row of KNOWLEDGE_TABLE) {
    const result = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: row.toState, actorId: TESTER_ACCEPTANCE_JOURNEY.participantId });
    assert.equal(result.ok, true, result.ok ? "" : `row ${row.row} (${row.description}): ${result.reason}: ${JSON.stringify(result)}`);
    if (result.ok) {
      // Ch.5 §19.13's own noun_verb badge convention: entityType_verb.
      assert.equal(result.knowledgeItem.authority_badge, `knowledge_${row.verb}`, `row ${row.row} (${row.description}): authority_badge should track this hop`);
      last = result.knowledgeItem;
    }
  }
  // No Edit path exists yet (deferred) — version never bumps from lifecycle
  // transitions alone.
  assert.equal(last.version, "1.0.0");

  const { data: events } = await eventsDB.findByOriginatingObject("Knowledge", knowledgeItem.id);
  const eventTypes = (events ?? []).filter((e) => e.event_type !== "KnowledgeObserved" && e.event_type !== "KnowledgeTransitioned").map((e) => e.event_type);
  assert.deepEqual(eventTypes, KNOWLEDGE_TABLE.map((row) => row.eventType));
  assert.equal((events ?? []).filter((e) => e.event_type === "KnowledgeTransitioned").length, KNOWLEDGE_TABLE.length, "KnowledgeTransitioned fires once per hop");
});

test("DRIVEN: every KnowledgeScope promotion hop publishes KnowledgeScopePromoted, in order", async () => {
  const { seuId, deliverableId } = await commissionTestSeuAndDeliverable();
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const knowledgeItem = await createKnowledgeItem({ actorId: ROOT_ACTOR_ID, seuId, deliverableId, category: "Technical Knowledge", title: "Knowledge scope lifecycle-table test item", evidenceReferences: await supportingEvidenceReferences(seuId, deliverableId) });

  // Scope promotion requires "Published" (Ch.16 §9) — walk only as far as
  // row 4 (Publish), not the whole table through to Archived, or every
  // promoteKnowledgeItemScope call below fails not_published.
  const toPublished = KNOWLEDGE_TABLE.filter((row) => row.row <= 4);
  for (const row of toPublished) {
    const step = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: row.toState, actorId: TESTER_ALL_ID });
    assert.equal(step.ok, true, step.ok ? "" : JSON.stringify(step));
  }

  for (const row of KNOWLEDGE_SCOPE_TABLE) {
    const result = await promoteKnowledgeItemScope({ knowledgeItemId: knowledgeItem.id, targetScope: row.toState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, result.ok ? "" : `row ${row.row}: ${result.reason}: ${JSON.stringify(result)}`);
  }

  const { data: events } = await eventsDB.findByOriginatingObject("Knowledge", knowledgeItem.id);
  const scopeEventTypes = (events ?? []).filter((e) => e.event_type === "KnowledgeScopePromoted").map((e) => e.event_type);
  assert.deepEqual(scopeEventTypes, KNOWLEDGE_SCOPE_TABLE.map((row) => row.eventType));
});

test("CR-132 DEFINITION: the Knowledge birth row None -> Observed", async () => {
  const { data: birth } = await transitionDefinitionsDB.findBirth("Knowledge");
  assert.ok(birth, "the Knowledge birth row exists");
  assert.equal(birth!.to_state, "Observed");
  assert.equal(birth!.verb, "observe");
  assert.equal(birth!.trigger, "governed");
  assert.equal(birth!.event_type, "KnowledgeObserved");
  assert.equal(birth!.version_event, null);
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM transition_definitions WHERE entity_type = 'Knowledge' AND to_state NOT LIKE 'qg-%'");
  assert.equal(Number(rows[0].count), KNOWLEDGE_TABLE.length + 1, "the six hops plus the birth row");
});

test("CR-132 DRIVEN: creation writes the birth state and publishes the birth event; Evidence is required on save", async () => {
  const { seuId, deliverableId } = await commissionTestSeuAndDeliverable();
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const base = { actorId: ROOT_ACTOR_ID, seuId, deliverableId, category: "Technical Knowledge" };
  await assert.rejects(createKnowledgeItem({ ...base, title: `no evidence ${randomUUID()}` }), /at least one supporting Evidence/);
  await assert.rejects(createKnowledgeItem({ ...base, title: `empty evidence ${randomUUID()}`, evidenceReferences: { supports: [] } }), /at least one supporting Evidence/);

  const item = await createKnowledgeItem({ ...base, title: `birth ${randomUUID()}`, evidenceReferences: await supportingEvidenceReferences(seuId, deliverableId) });
  assert.equal(item.status, "Observed");
  const { data: events } = await eventsDB.findByOriginatingObject("Knowledge", item.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["KnowledgeObserved"]);
  assert.deepEqual((await nextActionsFor("Knowledge", "Observed", TESTER_ALL_ID)).map((a) => a.verb), ["propose"]);
  assert.deepEqual((await nextActionsFor("Knowledge", "Accepted", TESTER_ALL_ID)).map((a) => a.verb), ["publish"]);
});

test("CR-132 DRIVEN: every hop publishes the row's event and then KnowledgeTransitioned with one correlation id; versioned hops write version events with the SEU's tenant", async () => {
  const { seuId, deliverableId } = await commissionTestSeuAndDeliverable();
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const item = await createKnowledgeItem({ actorId: ROOT_ACTOR_ID, seuId, deliverableId, category: "Technical Knowledge", title: `pairs ${randomUUID()}`, evidenceReferences: await supportingEvidenceReferences(seuId, deliverableId) });
  for (const row of KNOWLEDGE_TABLE) {
    const result = await transitionKnowledgeItem({ knowledgeItemId: item.id, targetState: row.toState, actorId: TESTER_ALL_ID });
    assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result));
  }
  const { data: events } = await eventsDB.findByOriginatingObject("Knowledge", item.id);
  const accepted = (events ?? []).find((e) => e.event_type === "KnowledgeAccepted")!;
  const generic = (events ?? []).find((e) => e.event_type === "KnowledgeTransitioned" && (e.payload as { toState?: string }).toState === "Accepted")!;
  assert.equal(accepted.correlation_id, generic.correlation_id);
  assert.deepEqual(accepted.payload, generic.payload);

  const { rows } = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM version_events WHERE entity_type = 'Knowledge' AND entity_id = $1", [item.id]);
  assert.equal(rows.length, KNOWLEDGE_TABLE.length, "one version event per hop");
  const { rows: seuRows } = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM seus WHERE id = $1", [seuId]);
  for (const r of rows) assert.equal(r.tenant_id, seuRows[0].tenant_id);
});

test("CR-132 DRIVEN: a refused hop writes and publishes nothing; an actor with no participant row in the SEU is refused", async () => {
  const { seuId, deliverableId } = await commissionTestSeuAndDeliverable();
  await ensureActorParticipant(seuId, ROOT_ACTOR_ID);
  const item = await createKnowledgeItem({ actorId: ROOT_ACTOR_ID, seuId, deliverableId, category: "Technical Knowledge", title: `refused ${randomUUID()}`, evidenceReferences: await supportingEvidenceReferences(seuId, deliverableId) });
  const before = ((await eventsDB.findByOriginatingObject("Knowledge", item.id)).data ?? []).length;

  const skip = await transitionKnowledgeItem({ knowledgeItemId: item.id, targetState: "Published", actorId: TESTER_ALL_ID });
  assert.equal(skip.ok, false);
  if (!skip.ok) assert.equal(skip.reason, "no_transition_definition");
  assert.equal(((await eventsDB.findByOriginatingObject("Knowledge", item.id)).data ?? []).length, before);

  await assert.rejects(
    transitionKnowledgeItem({ knowledgeItemId: item.id, targetState: "Proposed", actorId: TESTER_ACCEPTANCE_JOURNEY.participantId }),
    /No participants row/
  );
  assert.equal((await knowledgeItemsDB.findById(item.id)).data!.status, "Observed");
});

test("CR-132 GUARD: only the Knowledge adapter writes the status and no code names the birth event as a literal", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  const statusWriters = files.filter((f) => /knowledgeItemsDB\.updateStatus\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(statusWriters.map((f) => f.slice(process.cwd().length + 1)), ["src/domain/engine/entityAdapters.ts"]);
  const birthLiterals = files.filter((f) => /["']KnowledgeObserved["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(birthLiterals, []);
});
