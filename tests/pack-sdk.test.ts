// Post-MVP Phase 9 (Pack Platform maturity: Ch.5, Ch.38, Ch.39, Ch.41) —
// automated coverage for the Pack SDK (core/packs.ts): schema/dependency
// validation, the real publish pipeline (Draft -> Validated -> Published ->
// optionally Active, each hop a real transitionEngine evaluation), Version
// immutability (Ch.41 VM-002 — republishing an existing (code, version) is a
// no-op, a new version is a new immutable row, activating it supersedes the
// previously-Active version rather than mutating it), and
// compositionEngine's multi-Pack override-conflict path exercised with real,
// versioned data for the first time. Run against the real dev database, no
// mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { compositionEngine } from "../src/domain/engine/compositionEngine.js";
import { validatePackSeed, publishPack, transitionPack, createPackDraft, listPacksWithNextStates, type PackSeedInput } from "../src/routes/seu/core/packs.js";

after(async () => {
  await pool.end();
});

function freshPackSeed(overrides: Partial<PackSeedInput> = {}): PackSeedInput {
  const code = `test-pack-${randomUUID()}`;
  return {
    code,
    name: "Test Pack",
    category: "Technology",
    packVersion: "1.0.0",
    installationClassification: "Optional",
    contributions: {
      capabilities: [{ code: `${code}-cap`, name: "Test Capability" }],
    },
    ...overrides,
  };
}

test("validatePackSeed rejects a non-semver packVersion, duplicate contribution codes, an unresolved service->capability reference, and an unresolved dependency", async () => {
  const seed = freshPackSeed({
    packVersion: "not-semver",
    dependencies: [{ packCode: `nonexistent-${randomUUID()}`, version: "1.0.0", type: "required" }],
    contributions: {
      capabilities: [{ code: "dup", name: "A" }, { code: "dup", name: "B" }],
      services: [{ code: "svc-1", capabilityCode: "totally-unknown-capability", name: "Bad Service", contractDescription: "x" }],
    },
  });

  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.ok(result.errors.some((e) => e.includes("semver")));
  assert.ok(result.errors.some((e) => e.includes("duplicate capability code")));
  assert.ok(result.errors.some((e) => e.includes("references unknown capability")));
  assert.ok(result.errors.some((e) => e.includes("dependency not resolved")));
});

test("validatePackSeed accepts a well-formed Pack and resolves a real dependency", async () => {
  const seed = freshPackSeed({
    dependencies: [{ packCode: "platform-core-engineering", version: "1.0.0", type: "required" }],
  });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
});

test("publishPack without activate: true walks the Pack to Published but not Active", async () => {
  const seed = freshPackSeed();
  const result = await publishPack({ seed, actorRole: "general" });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
  assert.equal(result.pack!.status, "Published");
  assert.equal(result.alreadyPublished, false);

  const { data: capability } = await capabilitiesDB.findByCodes([`${seed.code}-cap`]);
  assert.equal(capability?.[0]?.originating_pack_id, result.pack!.id, "contributed Capability must be traceable to the Pack that declared it (PM-005)");
});

test("publishPack with activate: true requires 'power' — a 'general' actor is denied Published -> Active", async () => {
  const seed = freshPackSeed();
  const result = await publishPack({ seed, actorRole: "general", activate: true });
  assert.equal(result.ok, false);
  assert.match(result.errors!.join(";"), /requires role power/);
  assert.equal(result.pack!.status, "Published", "the Pack stays at the last successful hop, not silently marked Active");
});

test("publishPack with activate: true and a 'power' actor reaches Active", async () => {
  const seed = freshPackSeed();
  const result = await publishPack({ seed, actorRole: "power", activate: true });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
  assert.equal(result.pack!.status, "Active");
});

test("republishing the exact same (code, packVersion) is idempotent — a no-op that returns the existing immutable row (VM-002)", async () => {
  const seed = freshPackSeed();
  const first = await publishPack({ seed, actorRole: "power", activate: true });
  assert.equal(first.ok, true);

  const second = await publishPack({ seed, actorRole: "power", activate: true });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyPublished, true);
  assert.equal(second.pack!.id, first.pack!.id, "must be the same row, not a new one");
});

test("publishing a new version of an existing Pack code creates a new immutable row and, when activated, supersedes the previously-Active version", async () => {
  const code = `test-pack-${randomUUID()}`;
  const seedV1 = freshPackSeed({ code, packVersion: "1.0.0" });
  const v1 = await publishPack({ seed: seedV1, actorRole: "power", activate: true });
  assert.equal(v1.ok, true);
  assert.equal(v1.pack!.status, "Active");

  const seedV2 = freshPackSeed({ code, packVersion: "1.1.0" });
  const v2 = await publishPack({ seed: seedV2, actorRole: "power", activate: true });
  assert.equal(v2.ok, true, !v2.ok ? JSON.stringify(v2.errors) : undefined);
  assert.notEqual(v2.pack!.id, v1.pack!.id, "a new version must be a new row, not a mutation of the old one");
  assert.equal(v2.pack!.status, "Active");
  assert.equal(v2.supersededPack?.id, v1.pack!.id);
  assert.equal(v2.supersededPack?.status, "Deprecated");

  // The old row's own content is untouched — immutability, not just a status flip.
  const { data: v1Reloaded } = await packsDB.findById(v1.pack!.id);
  assert.equal(v1Reloaded?.pack_version, "1.0.0");
  assert.equal(v1Reloaded?.status, "Deprecated");

  const { data: versions } = await packsDB.findVersionsByCode(code);
  assert.equal(versions?.length, 2);
});

test("transitionPack rejects an undefined transition (Draft -> Active, skipping Validated/Published)", async () => {
  const { data: rawDraftPack } = await packsDB.create(freshPackSeed());
  assert.ok(rawDraftPack);
  const result = await transitionPack({ packId: rawDraftPack!.id, targetState: "Active", actorRole: "power" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.reason, "no_transition_definition");
});

test("Pack Registry (listPacksWithNextStates) reports the correct possibleNextStates per lifecycle state", async () => {
  const seed = freshPackSeed();
  const published = await publishPack({ seed, actorRole: "general" });
  assert.equal(published.ok, true);

  const registry = await listPacksWithNextStates();
  const entry = registry.find((r) => r.pack.id === published.pack!.id);
  assert.ok(entry);
  assert.deepEqual(entry!.possibleNextStates, ["Active"]);
});

// Previously-untested path (compositionEngine's own code comment noted this
// "never actually triggers" with MVP's single-Pack seed data): two distinct
// Pack rows sharing the same code, one wired as a Template's mandatory Pack,
// the other as a Profile's optional Pack — the Override strategy should
// dedupe them and warn, not silently double-count or error.
//
// Both rows must be Active for this to isolate the override/dedup path from
// the separate Active-only filter (see the "excludes a non-Active Pack" test
// below) — publishPack's own activate step would normally supersede
// (Deprecate) the previous Active version of the same code, so this
// constructs the scenario directly through transitionPack instead, bypassing
// that supersession on purpose. That also means this is a real, narrow gap
// worth naming: nothing currently stops two Versions of the same code from
// being simultaneously Active if they're each transitioned individually
// (e.g. by hand on the Pack Registry page) rather than through publishPack's
// own activate+supersede sequence.
test("compositionEngine.compose warns and dedupes when the same Pack code reaches a composition through two simultaneously-Active Versions", async () => {
  const code = `test-conflict-${randomUUID()}`;
  const v1Draft = await createPackDraft(freshPackSeed({ code, packVersion: "1.0.0" }));
  const v2Draft = await createPackDraft(freshPackSeed({ code, packVersion: "1.1.0" }));
  assert.equal(v1Draft.ok, true);
  assert.equal(v2Draft.ok, true);
  if (!v1Draft.ok || !v2Draft.ok) throw new Error("unreachable");

  for (const draft of [v1Draft.pack, v2Draft.pack]) {
    for (const targetState of ["Validated", "Published", "Active"]) {
      const step = await transitionPack({ packId: draft.id, targetState, actorRole: "power" });
      assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
    }
  }
  const { data: v1Reloaded } = await packsDB.findById(v1Draft.pack.id);
  const { data: v2Reloaded } = await packsDB.findById(v2Draft.pack.id);
  assert.equal(v1Reloaded?.status, "Active");
  assert.equal(v2Reloaded?.status, "Active", "both Versions genuinely Active — the scenario this test needs");

  const { data: template } = await templatesDB.upsert({ code: `test-conflict-template-${randomUUID()}`, name: "Conflict Test Template" });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template!.id, [v1Draft.pack.id]);

  const { data: profile } = await profilesDB.upsert({ code: `test-conflict-profile-${randomUUID()}`, name: "Conflict Test Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  assert.ok(profile);
  await profilesDB.setOptionalPacks(profile!.id, [v2Draft.pack.id]); // composed after the mandatory set — should win

  const result = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  assert.equal(result.composedPacks.length, 1, "the Override strategy dedupes by Pack code, keeping the later-composed one");
  assert.equal(result.composedPacks[0]?.packCode, code);
  assert.equal(result.composedPacks[0]?.packVersion, "1.1.0", "the Profile's optional (later-composed) Version wins over the Template's mandatory one");
  assert.equal(result.compositionReport.warnings.length, 1);
  assert.match(result.compositionReport.warnings[0]!, /contributed more than once/);
});

// The bug this covers: composition previously resolved template_packs/
// profile_packs junction rows without ever checking pack.status, so a
// Deprecated, Retired or Archived Pack composed exactly like Active,
// silently. Only Active Packs may be composed into a new EBM now; anything
// else must be excluded with a warning naming it, not silently dropped or
// silently included.
test("compositionEngine.compose excludes a non-Active Pack from the composed set and warns about it by name", async () => {
  const mandatory = await publishPack({ seed: freshPackSeed(), actorRole: "power", activate: true });
  assert.equal(mandatory.ok, true);
  const archived = await transitionPack({ packId: mandatory.pack!.id, targetState: "Deprecated", actorRole: "power" });
  assert.equal(archived.ok, true);
  if (!archived.ok) throw new Error("unreachable");
  const retired = await transitionPack({ packId: mandatory.pack!.id, targetState: "Retired", actorRole: "power" });
  assert.equal(retired.ok, true);
  const finalArchived = await transitionPack({ packId: mandatory.pack!.id, targetState: "Archived", actorRole: "power" });
  assert.equal(finalArchived.ok, true);
  if (!finalArchived.ok) throw new Error("unreachable");
  assert.equal(finalArchived.pack.status, "Archived");

  const stillActiveOptional = await publishPack({ seed: freshPackSeed(), actorRole: "power", activate: true });
  assert.equal(stillActiveOptional.ok, true);

  const { data: template } = await templatesDB.upsert({ code: `test-archived-template-${randomUUID()}`, name: "Archived Pack Test Template" });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template!.id, [finalArchived.pack.id]);

  const { data: profile } = await profilesDB.upsert({ code: `test-archived-profile-${randomUUID()}`, name: "Archived Pack Test Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  assert.ok(profile);
  await profilesDB.setOptionalPacks(profile!.id, [stillActiveOptional.pack!.id]);

  const result = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  assert.equal(result.composedPacks.length, 1, "the Archived Pack must not compose");
  assert.equal(result.composedPacks[0]?.packCode, stillActiveOptional.pack!.code);
  assert.equal(result.compositionReport.warnings.length, 1);
  assert.match(result.compositionReport.warnings[0]!, new RegExp(mandatory.pack!.code));
  assert.match(result.compositionReport.warnings[0]!, /Archived/);
});

// Logged in Open Design Questions.md — reactivating a terminal-state Pack
// deliberately does not resurrect its own row (Ch.41 VM-002: Versions are
// immutable); it publishes a new Version with an auto-bumped patch number.
for (const terminalState of ["Deprecated", "Retired", "Archived"]) {
  test(`transitionPack from ${terminalState} to Active publishes a new Version rather than resurrecting the old row`, async () => {
    const seed = freshPackSeed();
    const published = await publishPack({ seed, actorRole: "power", activate: true });
    assert.equal(published.ok, true);
    const original = published.pack!;

    let current = original;
    const path = ["Deprecated", "Retired", "Archived"].slice(0, ["Deprecated", "Retired", "Archived"].indexOf(terminalState) + 1);
    for (const targetState of path) {
      const step = await transitionPack({ packId: current.id, targetState, actorRole: "power" });
      assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
      if (step.ok) current = step.pack;
    }
    assert.equal(current.status, terminalState);

    const reactivated = await transitionPack({ packId: current.id, targetState: "Active", actorRole: "power" });
    assert.equal(reactivated.ok, true, !reactivated.ok ? JSON.stringify(reactivated) : undefined);
    if (!reactivated.ok) throw new Error("unreachable");

    assert.notEqual(reactivated.pack.id, original.id, "reactivation must create a new row, not flip the old one's status");
    assert.equal(reactivated.pack.status, "Active");
    assert.equal(reactivated.pack.pack_version, "1.0.1", "the patch version must be auto-bumped");
    assert.deepEqual(reactivated.pack.contributions, original.contributions, "the new Version carries the same content as the one being reactivated");

    const { data: oldRowReloaded } = await packsDB.findById(original.id);
    assert.equal(oldRowReloaded?.status, terminalState, "the original row must stay exactly as it was — reactivation never mutates it");
    assert.equal(oldRowReloaded?.pack_version, "1.0.0");
  });
}

test("reactivating a Pack supersedes whatever else is currently Active for the same code", async () => {
  const code = `test-reactivate-supersede-${randomUUID()}`;
  const v1 = await publishPack({ seed: freshPackSeed({ code, packVersion: "1.0.0" }), actorRole: "power", activate: true });
  assert.equal(v1.ok, true);
  const toDeprecated = await transitionPack({ packId: v1.pack!.id, targetState: "Deprecated", actorRole: "power" });
  assert.equal(toDeprecated.ok, true);

  // A second, unrelated Version of the same code takes over as Active.
  const v2 = await publishPack({ seed: freshPackSeed({ code, packVersion: "2.0.0" }), actorRole: "power", activate: true });
  assert.equal(v2.ok, true);
  assert.equal(v2.pack!.status, "Active");

  // Reactivating the original (still Deprecated) row must supersede v2.
  const reactivated = await transitionPack({ packId: v1.pack!.id, targetState: "Active", actorRole: "power" });
  assert.equal(reactivated.ok, true, !reactivated.ok ? JSON.stringify(reactivated) : undefined);
  if (!reactivated.ok) throw new Error("unreachable");
  assert.equal(reactivated.pack.status, "Active");
  assert.equal(reactivated.pack.pack_version, "1.0.1", "bumped from the row being reactivated's own version (1.0.0), not from whatever else happens to be Active (2.0.0)");

  const { data: v2Reloaded } = await packsDB.findById(v2.pack!.id);
  assert.equal(v2Reloaded?.status, "Deprecated", "the Version that was Active before reactivation must now be superseded");

  const { data: activeForCode } = await packsDB.findActiveByCode(code);
  assert.equal(activeForCode?.id, reactivated.pack.id, "exactly one Active row for this code after reactivation");
});

test("reactivating a Pack requires 'power' — a 'general' actor is denied", async () => {
  const published = await publishPack({ seed: freshPackSeed(), actorRole: "power", activate: true });
  assert.equal(published.ok, true);
  const deprecated = await transitionPack({ packId: published.pack!.id, targetState: "Deprecated", actorRole: "power" });
  assert.equal(deprecated.ok, true);

  const result = await transitionPack({ packId: published.pack!.id, targetState: "Active", actorRole: "general" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.reason, "authority_denied");

  const { data: stillDeprecated } = await packsDB.findById(published.pack!.id);
  assert.equal(stillDeprecated?.status, "Deprecated");
});
