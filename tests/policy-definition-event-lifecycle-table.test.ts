// Version Feature Plan.md, point 1: an executable check of Ch.24's own
// Policy Definition table, same discipline as
// profile-event-lifecycle-table.test.ts (Ch.7) / template-event-lifecycle-table.test.ts
// (Ch.6) / pack-event-lifecycle-table.test.ts (Ch.5). POLICY_DEFINITION_TABLE
// mirrors Template's/Profile's own shape — seven-state lifecycle (Ch.24 §13),
// no Reject/submit row, Deprecated+Retired as two distinct hops.
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through transitionPolicyDefinition
//     and the events it publishes are asserted against eventsDB directly —
//     no mocking. Unlike Pack/Template/Profile, Policy Definition has no
//     bespoke one-shot publish function (creation goes through the generic
//     SDK authoring path, policyDefinitionsDB.createDraft) — every DRIVEN
//     test here starts from a bare Draft, the same fixture shape Profile's
//     own row 3+ tests already use.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionPolicyDefinition } from "../src/routes/seu/core/policyDefinitions.js";
import type { PolicyDefinitionRow } from "../src/dblayer/seuTypes.js";
import { randomUUID } from "node:crypto";

async function freshPolicyDefinitionDraft(): Promise<{ id: string }> {
  // CR-114 follow-on — policyDefinitionsDB.createDraft's schemaDefinitionId
  // is now mandatory.
  const { data: policySchema } = await schemaDefinitionsDB.findLatest("Policy");
  if (!policySchema) throw new Error("no schema_definitions grammar for Policy");
  const { data: draft, error } = await policyDefinitionsDB.createDraft({
    code: `test-policy-lifecycle-${randomUUID()}`,
    name: "Test Policy Definition",
    category: "Engineering",
    version: "1.0.0",
    schemaDefinitionId: policySchema.id,
  });
  if (error || !draft) throw error ?? new Error("failed to create Policy Definition draft");
  return { id: draft.id };
}

interface PolicyDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const POLICY_DEFINITION_TABLE: PolicyDefinitionTableRow[] = [
  { row: 1, description: "Validate", fromState: "Draft", toState: "Validated", eventType: "PolicyDefinitionValidated", versionEvent: "VersionValidated" },
  { row: 2, description: "Publish", fromState: "Validated", toState: "Published", eventType: "PolicyDefinitionPublished", versionEvent: "VersionPublished" },
  { row: 3, description: "Activate", fromState: "Published", toState: "Active", eventType: "PolicyDefinitionActivated", versionEvent: "VersionActivated" },
  { row: 4, description: "Deprecate", fromState: "Active", toState: "Deprecated", eventType: "PolicyDefinitionDeprecated", versionEvent: "VersionDeprecated" },
  { row: 5, description: "Retire", fromState: "Deprecated", toState: "Retired", eventType: "PolicyDefinitionRetired", versionEvent: "VersionSuperseded" },
  { row: 6, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "PolicyDefinitionArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: every Policy transition_definitions row matches Ch.24 §13's event_type/version_event", async () => {
  for (const row of POLICY_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Policy", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Policy ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step for Policy Definition — Ch.24 §13 has no
    // intermediate state between Draft and Validated.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

test("DRIVEN: every hop publishes its matching event, in order", async () => {
  const draft = await freshPolicyDefinitionDraft();

  for (const row of POLICY_DEFINITION_TABLE) {
    const result = await transitionPolicyDefinition({ policyDefinitionId: draft.id, targetState: row.toState as PolicyDefinitionRow["status"], actorRole: "power", actorId: "1001" });
    assert.equal(result.ok, true, result.ok ? undefined : `row ${row.row} (${row.description}): ${result.reason}: ${result.detail}`);
  }

  const { data: events } = await eventsDB.findByOriginatingObject("PolicyDefinition", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, POLICY_DEFINITION_TABLE.map((row) => row.eventType));
});
