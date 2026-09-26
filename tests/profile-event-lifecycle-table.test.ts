// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Profile table (Ch.7), same discipline as
// template-event-lifecycle-table.test.ts (Ch.6) / pack-event-lifecycle-table.test.ts
// (Ch.5) / objective-event-lifecycle-table.test.ts (Ch.1). PROFILE_TABLE
// below mirrors Template's table exactly — same seven-state lifecycle, no
// Reject/submit row, same Deprecated+Retired-as-two-distinct-hops shape.
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through the real functions
//     (publishProfile/transitionProfile) and the events they publish are
//     asserted against eventsDB directly — no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";

import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { publishProfile, transitionProfile, type ProfileSeedInput } from "../src/routes/seu/core/profiles.js";
import { uniqueTestPackVersion } from "./testFixtures.js";
import { randomUUID } from "node:crypto";

// A Profile always needs a real base Template to point at — created here via
// the raw, status-agnostic templatesDB.upsert() (Active immediately, no
// Ontology-code validation), the same low-level fixture pattern every other
// unrelated test (pack-sdk.test.ts, governance-ebm-sharpening.test.ts, etc.)
// already uses for this exact purpose.
async function freshBaseTemplateCode(): Promise<string> {
  const code = `test-profile-lifecycle-template-${randomUUID()}`;
  const { data: template, error } = await templatesDB.upsert({ code, name: "Profile Lifecycle Test Template", deliverableCatalogue: [] });
  if (error || !template) throw error ?? new Error("failed to create base Template fixture");
  return template.code;
}

// developmentMethodology/primaryProgrammingLanguage/sourceControlProvider are
// mandatory Configuration Parameters on the Platform tenant (CR-091 Part 2);
// publishProfile runs validateProfileSeed, so these need real values or every
// publish is rejected before ever reaching the lifecycle.
async function freshProfileSeed(overrides: Partial<ProfileSeedInput> = {}): Promise<ProfileSeedInput> {
  return {
    code: `test-profile-lifecycle-${randomUUID()}`,
    name: "Test Profile",
    baseTemplateCode: await freshBaseTemplateCode(),
    environment: "development",
    profileVersion: uniqueTestPackVersion(),
    developmentMethodology: "scrum",
    primaryProgrammingLanguage: "typescript",
    sourceControlProvider: "github",
    ...overrides,
  };
}

// Rows 3-8 need to observe ONE hop at a time, so they start from a bare
// Draft directly (profilesDB.createDraft — the same row the interactive SDK
// authoring path produces) rather than going through publishProfile, which
// walks a fresh Draft all the way to Active in one call (see the row 1 test
// below) — same reasoning as Template's own freshTemplateDraft.
async function freshProfileDraft(): Promise<{ id: string }> {
  const baseTemplateCode = await freshBaseTemplateCode();
  const { data: template } = await templatesDB.findByCode(baseTemplateCode);
  // CR-114 follow-on — profilesDB.createDraft's schemaDefinitionId is now
  // mandatory.
  const { data: profileSchema } = await schemaDefinitionsDB.findLatest("Profile");
  if (!profileSchema) throw new Error("no schema_definitions grammar for Profile");
  const { data: draft, error } = await profilesDB.createDraft({
    code: `test-profile-lifecycle-draft-${randomUUID()}`,
    name: "Test Profile Draft",
    baseTemplateId: template!.id,
    profileVersion: uniqueTestPackVersion(),
    draftContent: { baseTemplateCode },
    schemaDefinitionId: profileSchema.id,
  });
  if (error || !draft) throw error ?? new Error("failed to create Profile draft");
  return { id: draft.id };
}

interface ProfileTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const PROFILE_TABLE: ProfileTableRow[] = [
  { row: 3, description: "Validate", fromState: "Draft", toState: "Validated", eventType: "ProfileValidated", versionEvent: "VersionValidated" },
  { row: 4, description: "Publish", fromState: "Validated", toState: "Published", eventType: "ProfilePublished", versionEvent: "VersionPublished" },
  { row: 5, description: "Activate", fromState: "Published", toState: "Active", eventType: "ProfileActivated", versionEvent: "VersionActivated" },
  { row: 6, description: "Deprecate", fromState: "Active", toState: "Deprecated", eventType: "ProfileDeprecated", versionEvent: "VersionDeprecated" },
  { row: 7, description: "Retire", fromState: "Deprecated", toState: "Retired", eventType: "ProfileRetired", versionEvent: "VersionSuperseded" },
  { row: 8, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "ProfileArchived", versionEvent: "VersionArchived" },
];

// The three reactivation gate rows (§19.1/§19.2) carry no event_type/
// version_event of their own — reactivateAsNewVersion never runs
// updateStatus for these, it walks a brand-new Draft through rows 3-5
// instead. Checked directly, same as Template's identical rows.
const REACTIVATION_ROWS: Array<{ fromState: string; toState: string }> = [
  { fromState: "Deprecated", toState: "Active" },
  { fromState: "Retired", toState: "Active" },
  { fromState: "Archived", toState: "Active" },
];

test("DEFINITION: every Profile transition_definitions row matches Events and Lifecycles.md's event_type/version_event", async () => {
  for (const row of PROFILE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Profile", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Profile ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step for Profile — see this file's own header.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }

  for (const row of REACTIVATION_ROWS) {
    const { data: def } = await transitionDefinitionsDB.find("Profile", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Profile ${row.fromState} -> ${row.toState} (reactivation gate)`);
    assert.equal(def!.event_type, null, `reactivation gate ${row.fromState} -> ${row.toState}: event_type should be null`);
    assert.equal(def!.version_event, null, `reactivation gate ${row.fromState} -> ${row.toState}: version_event should be null`);
  }
});

// publishProfile used to create an already-Active row directly (relying on
// profiles.status's own — since-fixed — 'Active' default), firing only
// ProfileCreated. Fixed alongside Template's identical gap (owner:
// "templates.status defaults to 'Active' - this should be draft; similar to
// pack" — extended to Profile the same day since both share one authoring
// pipeline): publishProfile now creates a real Draft and walks it through the
// full governed lifecycle for real (mirroring publishPack/publishTemplate),
// so a fresh publish fires all four events in order, not just the first one.
test("DRIVEN: row 1 (New) creates a real Draft and walks it to Active, firing ProfileCreated then the real governed events", async () => {
  const created = await publishProfile({ seed: await freshProfileSeed(), actorRole: "power", actorId: "1001" });
  assert.equal(created.ok, true, created.ok ? undefined : created.errors.join("; "));
  if (!created.ok) return;

  const { data: events } = await eventsDB.findByOriginatingObject("Profile", created.profileId);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["ProfileCreated", "ProfileValidated", "ProfilePublished", "ProfileActivated"]);

  const { data: profile } = await profilesDB.findById(created.profileId);
  assert.equal(profile?.status, "Active");
});

test("DRIVEN: row 3 (Validate) publishes ProfileValidated, matching transition_definitions.event_type", async () => {
  const draft = await freshProfileDraft();

  const result = await transitionProfile({ profileId: draft.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, true, result.ok ? undefined : `${result.reason}: ${result.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("Profile", draft.id);
  const validated = events?.find((e) => e.event_type === "ProfileValidated");
  assert.ok(validated, "expected a ProfileValidated event");

  const { data: def } = await transitionDefinitionsDB.find("Profile", "Draft", "Validated");
  assert.equal(validated!.event_type, def!.event_type);
});

test("DRIVEN: rows 4-8 (Publish/Activate/Deprecate/Retire/Archive) each publish their matching event", async () => {
  const draft = await freshProfileDraft();

  await transitionProfile({ profileId: draft.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  await transitionProfile({ profileId: draft.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  await transitionProfile({ profileId: draft.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  await transitionProfile({ profileId: draft.id, targetState: "Deprecated", actorRole: "power", actorId: "1001" });
  await transitionProfile({ profileId: draft.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  const archived = await transitionProfile({ profileId: draft.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(archived.ok, true, archived.ok ? undefined : `${archived.reason}: ${archived.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("Profile", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["ProfilePublished", "ProfileActivated", "ProfileDeprecated", "ProfileRetired", "ProfileArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});
