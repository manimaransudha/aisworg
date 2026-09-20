// Version Feature Plan.md, point 1: an executable check of Ch.16's own
// Knowledge lifecycle table (§9), same discipline as
// policy-definition-event-lifecycle-table.test.ts (Ch.24) /
// service-definition-event-lifecycle-table.test.ts (Ch.11). KNOWLEDGE_TABLE
// covers the real 6-hop status lifecycle (Observed→...→Archived); no
// submit/queue row (creation into Observed is ungoverned, same "creation
// authority is not a transition" discipline as Objective/Ontology's own row
// 1 — no transition_definitions row exists for it, so it is not in this
// table). KNOWLEDGE_SCOPE_TABLE covers Acquisition Scope promotion
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
import { createKnowledgeItem, transitionKnowledgeItem, promoteKnowledgeItemScope } from "../src/routes/seu/core/knowledge.js";
import { ensureWebAppTemplateFixture, ensureCoreEngineeringQualityGates, commissionFromFormSync } from "./testFixtures.js";
import type { AcquisitionScope, KnowledgeItemRow } from "../src/dblayer/seuTypes.js";

async function commissionTestSeuAndDeliverable(): Promise<{ seuId: string; deliverableId: string }> {
  await ensureWebAppTemplateFixture();
  await ensureCoreEngineeringQualityGates();
  const result = await commissionFromFormSync({
    statement: `knowledge-lifecycle-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
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
  const knowledgeItem = await createKnowledgeItem({ seuId, deliverableId, category: "Technical Knowledge", title: "Knowledge lifecycle-table test item" });
  assert.equal(knowledgeItem.version, "1.0.0");
  assert.equal(knowledgeItem.authority_badge, null, "creation is ungoverned — no badge yet");

  let last: KnowledgeItemRow = knowledgeItem;
  for (const row of KNOWLEDGE_TABLE) {
    const result = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: row.toState, actorRole: "super", actorId: "1001", userId: 1001 });
    assert.equal(result.ok, true, result.ok ? undefined : `row ${row.row} (${row.description}): ${result.reason}: ${JSON.stringify(result)}`);
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
  const eventTypes = (events ?? []).filter((e) => e.event_type !== "KnowledgeObserved").map((e) => e.event_type);
  assert.deepEqual(eventTypes, KNOWLEDGE_TABLE.map((row) => row.eventType));
});

test("DRIVEN: every KnowledgeScope promotion hop publishes KnowledgeScopePromoted, in order", async () => {
  const { seuId, deliverableId } = await commissionTestSeuAndDeliverable();
  const knowledgeItem = await createKnowledgeItem({ seuId, deliverableId, category: "Technical Knowledge", title: "Knowledge scope lifecycle-table test item" });

  // Scope promotion requires "Published" (Ch.16 §9) — walk only as far as
  // row 4 (Publish), not the whole table through to Archived, or every
  // promoteKnowledgeItemScope call below fails not_published.
  const toPublished = KNOWLEDGE_TABLE.filter((row) => row.row <= 4);
  for (const row of toPublished) {
    const step = await transitionKnowledgeItem({ knowledgeItemId: knowledgeItem.id, targetState: row.toState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, step.ok ? undefined : JSON.stringify(step));
  }

  for (const row of KNOWLEDGE_SCOPE_TABLE) {
    const result = await promoteKnowledgeItemScope({ knowledgeItemId: knowledgeItem.id, targetScope: row.toState, actorRole: "super", actorId: "1001" });
    assert.equal(result.ok, true, result.ok ? undefined : `row ${row.row}: ${result.reason}: ${JSON.stringify(result)}`);
  }

  const { data: events } = await eventsDB.findByOriginatingObject("Knowledge", knowledgeItem.id);
  const scopeEventTypes = (events ?? []).filter((e) => e.event_type === "KnowledgeScopePromoted").map((e) => e.event_type);
  assert.deepEqual(scopeEventTypes, KNOWLEDGE_SCOPE_TABLE.map((row) => row.eventType));
});
