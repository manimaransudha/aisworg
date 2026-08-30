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
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { compositionEngine } from "../src/domain/engine/compositionEngine.js";
import { validatePackSeed, publishPack, transitionPack, createPackDraft, listPacksWithNextStates, packCodeVersionSummaries, type PackSeedInput } from "../src/routes/seu/core/packs.js";
import { ensureTestFixturePacks, uniqueTestPackVersion } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

// CR-026 — a real, seeded tenant (seedIdentityBaseline.ts's ATHENS_TENANT_ID's
// sibling "Demo" tenant), used only to prove Pack's tenant-scoped versioning
// against a genuine second tenant, not a made-up UUID.
const DEMO_TENANT_ID = "22222222-2222-2222-2222-222222222222";

// CR-079 bug fix — `code` used to be a freshly-registered, random-UUID-
// suffixed capability-name concept per call (registerTestOntologyCode).
// Owner: "the ontology was updated with what test fixture needs. This
// should be removed. The source of truth is what we fed through the
// migration files." `code` is now the same stable, migration-seeded
// engineering-name concept every call (migration 134) unless overridden;
// per-run uniqueness moves to packVersion instead (Pack identity is
// (code, packVersion, tenant_id), not code alone).
async function freshPackSeed(overrides: Partial<PackSeedInput> = {}): Promise<PackSeedInput> {
  return {
    code: "test-pack",
    name: "Test Pack",
    category: "Engineering",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {
      // CR-079 step (c) — a Capability contribution's own code is now
      // Ontology-enforced too (capability-name); a real, shared term
      // ("development") rather than a throwaway one — capability identity is
      // Pack-scoped, so reusing it across many unrelated test Packs is safe.
      capabilities: [{ code: "development", name: "Test Capability" }],
    },
    ...overrides,
  };
}

test("validatePackSeed rejects a non-semver packVersion, duplicate contribution codes, an unresolved service->capability reference, and an unresolved dependency", async () => {
  const seed = await freshPackSeed({
    packVersion: "not-semver",
    dependencies: [{ packCode: `nonexistent-${randomUUID()}`, version: "1.0.0", type: "required" }],
    contributions: {
      // CR-079 step (c) — a real capability-name value, not "dup": the
      // duplicate-code check runs regardless of Ontology validity, and using
      // a real value keeps this test isolated to what it's actually testing
      // (duplicate detection), not incidentally also failing Ontology lookup.
      capabilities: [{ code: "development", name: "A" }, { code: "development", name: "B" }],
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
  await ensureTestFixturePacks();
  const seed = await freshPackSeed({
    dependencies: [{ packCode: "test-testing-qa", version: "1.0.0", type: "required" }],
  });
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
});

test("publishPack without activate: true walks the Pack to Published but not Active", async () => {
  const seed = await freshPackSeed();
  const result = await publishPack({ seed, actorRole: "general", actorId: "1001" });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
  assert.equal(result.pack!.status, "Published");
  assert.equal(result.alreadyPublished, false);

  // CR-079 bug fix — findByCodes is unscoped by Pack, and every test Pack in
  // this file now contributes the same shared "development" capability code
  // (real, curated term, no longer a per-call-unique throwaway) — [0] would
  // pick an arbitrary matching row, not necessarily this one. findByOriginatingPackIds
  // is the actually Pack-scoped query for "this Pack's own contributed Capability."
  const { data: capabilities } = await capabilitiesDB.findByOriginatingPackIds([result.pack!.id]);
  assert.equal(capabilities?.[0]?.originating_pack_id, result.pack!.id, "contributed Capability must be traceable to the Pack that declared it (PM-005)");
});

// CR-006: the "requires role 'power' to activate" gate is retired — Pack
// authority is now the noun_verb badge (pack_activate), proven once in
// badge-model.test.ts. Activation-happy-path is covered by the test below.

test("publishPack with activate: true and a 'power' actor reaches Active", async () => {
  const seed = await freshPackSeed();
  const result = await publishPack({ seed, actorRole: "power", actorId: "1001", activate: true });
  assert.equal(result.ok, true, !result.ok ? JSON.stringify(result.errors) : undefined);
  assert.equal(result.pack!.status, "Active");
});

test("republishing the exact same (code, packVersion) is idempotent — a no-op that returns the existing immutable row (VM-002)", async () => {
  const seed = await freshPackSeed();
  const first = await publishPack({ seed, actorRole: "power", actorId: "1001", activate: true });
  assert.equal(first.ok, true);

  const second = await publishPack({ seed, actorRole: "power", actorId: "1001", activate: true });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyPublished, true);
  assert.equal(second.pack!.id, first.pack!.id, "must be the same row, not a new one");
});

test("publishing a new version of an existing Pack code creates a new immutable row and, when activated, supersedes the previously-Active version", async () => {
  // CR-079 bug fix — this test's own dedicated code (migration 135) — it
  // can't share freshPackSeed's own default "test-pack" now that both are
  // stable, or the two would collide.
  const code = "test-pack-versioning";
  const versionA = uniqueTestPackVersion();
  const seedV1 = await freshPackSeed({ code, packVersion: versionA });
  const v1 = await publishPack({ seed: seedV1, actorRole: "power", actorId: "1001", activate: true });
  assert.equal(v1.ok, true);
  assert.equal(v1.pack!.status, "Active");

  const versionB = uniqueTestPackVersion();
  const seedV2 = await freshPackSeed({ code, packVersion: versionB });
  const v2 = await publishPack({ seed: seedV2, actorRole: "power", actorId: "1001", activate: true });
  assert.equal(v2.ok, true, !v2.ok ? JSON.stringify(v2.errors) : undefined);
  assert.notEqual(v2.pack!.id, v1.pack!.id, "a new version must be a new row, not a mutation of the old one");
  assert.equal(v2.pack!.status, "Active");
  assert.equal(v2.supersededPack?.id, v1.pack!.id);
  assert.equal(v2.supersededPack?.status, "Retired");

  // The old row's own content is untouched — immutability, not just a status flip.
  const { data: v1Reloaded } = await packsDB.findById(v1.pack!.id);
  assert.equal(v1Reloaded?.pack_version, versionA);
  assert.equal(v1Reloaded?.status, "Retired");

  // CR-079 bug fix — `code` is now stable/reused across runs, so its own
  // version history accumulates over time; assert the DELTA this test's own
  // two publishes produced (both real version strings present), not an
  // absolute total that only held when the code itself was fresh every run.
  const { data: versions } = await packsDB.findVersionsByCode(code);
  const ownVersions = (versions ?? []).map((v) => v.pack_version);
  assert.ok(ownVersions.includes(versionA) && ownVersions.includes(versionB), "both of this run's own versions must be present");
});

test("transitionPack rejects an undefined transition (Draft -> Active, skipping Validated/Published)", async () => {
  const { data: rawDraftPack } = await packsDB.create(await freshPackSeed());
  assert.ok(rawDraftPack);
  const result = await transitionPack({ packId: rawDraftPack!.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.reason, "no_transition_definition");
});

test("Pack Registry (listPacksWithNextStates) reports the correct possibleNextStates per lifecycle state", async () => {
  const seed = await freshPackSeed();
  const published = await publishPack({ seed, actorRole: "general", actorId: "1001" });
  assert.equal(published.ok, true);

  const registry = await listPacksWithNextStates();
  const entry = registry.find((r) => r.pack.id === published.pack!.id);
  assert.ok(entry);
  assert.deepEqual(entry!.possibleNextStates, ["Active"]);
});

// Bug fix (Open Design Questions.md #2, second half — 013_template_profile_
// pack_by_code.sql): template_packs/profile_packs now store a Pack *code*,
// not a frozen row id, resolved fresh via packsDB.findActiveByCode at every
// composition. That changes what this scenario actually is: a Template and
// a Profile can no longer each pin a *different* specific Version of the
// same code (there's only one thing to store — the code — so both resolve
// through the exact same lookup). What's left to test is the narrower real
// gap this test's own comment already named: nothing stops two Versions of
// one code from being simultaneously Active (transitioned individually,
// bypassing publishPack's own supersede step) — when that happens,
// findActiveByCode's own tie-break (most recently created) decides which
// one composes, the same way regardless of whether the code came from the
// Template's mandatory set or the Profile's optional set. The Override
// strategy (later composition wins) still fires and still warns — it's
// just deduping two resolutions of the *same* row now, not two different
// rows — because both sides do genuinely name this code.
test("compositionEngine.compose resolves the same code referenced by both a Template and a Profile to one Version, and still warns about the duplicate reference", async () => {
  const code = "test-conflict";
  const versionA = uniqueTestPackVersion();
  const versionB = uniqueTestPackVersion();
  const v1Draft = await createPackDraft(await freshPackSeed({ code, packVersion: versionA }));
  const v2Draft = await createPackDraft(await freshPackSeed({ code, packVersion: versionB }));
  assert.equal(v1Draft.ok, true);
  assert.equal(v2Draft.ok, true);
  if (!v1Draft.ok || !v2Draft.ok) throw new Error("unreachable");

  for (const draft of [v1Draft.pack, v2Draft.pack]) {
    for (const targetState of ["Validated", "Published", "Active"]) {
      const step = await transitionPack({ packId: draft.id, targetState, actorRole: "power", actorId: "1001" });
      assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
    }
  }
  const { data: v1Reloaded } = await packsDB.findById(v1Draft.pack.id);
  const { data: v2Reloaded } = await packsDB.findById(v2Draft.pack.id);
  assert.equal(v1Reloaded?.status, "Active");
  assert.equal(v2Reloaded?.status, "Active", "both Versions genuinely Active — the scenario this test needs");

  const { data: template } = await templatesDB.upsert({ code: `test-conflict-template-${randomUUID()}`, name: "Conflict Test Template" });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template!.id, [code]);

  const { data: profile } = await profilesDB.upsert({ code: `test-conflict-profile-${randomUUID()}`, name: "Conflict Test Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  assert.ok(profile);
  await profilesDB.setOptionalPacks(profile!.id, [code]); // same code as the Template's mandatory set, on purpose

  const result = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  assert.equal(result.composedPacks.length, 1, "one code, resolved once, regardless of how many places reference it");
  assert.equal(result.composedPacks[0]?.packCode, code);
  assert.equal(result.composedPacks[0]?.packVersion, versionB, "findActiveByCode's own tie-break (most recently created) picks the newer Version");
  assert.equal(result.compositionReport.warnings.length, 1);
  assert.match(result.compositionReport.warnings[0]!, /contributed more than once/);
});

// The original bug this covered: composition resolved template_packs/
// profile_packs junction rows without ever checking pack.status, so a
// Retired or Archived Pack composed exactly like Active, silently. Fixed
// twice now, for two different failure modes of the same
// underlying problem (Open Design Questions.md #2):
//   1. (first fix) a pinned row that was still Active composed; a pinned
//      row that had gone terminal did not — checked by reading pack.status
//      off the resolved row.
//   2. (this test, current fix — 013_template_profile_pack_by_code.sql) a
//      code with *no* Active Version at all (every Version terminal) now
//      simply has nothing to resolve via findActiveByCode — there's no
//      status to read off a row that was never fetched, so the warning
//      names the code and says there's no Active Version, not a specific
//      status. (The complementary case — a code *with* a currently-Active
//      newer Version, replacing an old pinned row that went terminal — is
//      exactly the bug report this fix closes; not re-tested here since
//      it's just "composition picks up whatever findActiveByCode returns,"
//      already covered by every other composition test using a freshly-
//      published, Active Pack.)
test("compositionEngine.compose excludes a Pack code with no Active Version and warns about it by name", async () => {
  // CR-079 bug fix — freshPackSeed()'s default code is now a stable, fixed
  // literal ("test-pack"), so the two calls below need explicit, distinct
  // overridden codes to remain two DIFFERENT Pack identities (one that goes
  // Archived, one that stays Active) — see migration 136.
  const mandatory = await publishPack({ seed: await freshPackSeed({ code: "test-pack-no-active-version" }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(mandatory.ok, true);
  // CR-080 — Deprecated dropped from Pack's lifecycle; Active winds down to
  // Archived in 2 hops now (Retired, then Archived), not 3.
  const retired = await transitionPack({ packId: mandatory.pack!.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  assert.equal(retired.ok, true);
  if (!retired.ok) throw new Error("unreachable");
  const finalArchived = await transitionPack({ packId: mandatory.pack!.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(finalArchived.ok, true);
  if (!finalArchived.ok) throw new Error("unreachable");
  assert.equal(finalArchived.pack.status, "Archived");

  const stillActiveOptional = await publishPack({ seed: await freshPackSeed({ code: "test-pack-still-active" }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(stillActiveOptional.ok, true);

  const { data: template } = await templatesDB.upsert({ code: `test-archived-template-${randomUUID()}`, name: "Archived Pack Test Template" });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template!.id, [finalArchived.pack.code]);

  const { data: profile } = await profilesDB.upsert({ code: `test-archived-profile-${randomUUID()}`, name: "Archived Pack Test Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  assert.ok(profile);
  await profilesDB.setOptionalPacks(profile!.id, [stillActiveOptional.pack!.code]);

  const result = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  assert.equal(result.composedPacks.length, 1, "the code with no Active Version must not compose");
  assert.equal(result.composedPacks[0]?.packCode, stillActiveOptional.pack!.code);
  assert.equal(result.compositionReport.warnings.length, 1);
  assert.match(result.compositionReport.warnings[0]!, new RegExp(mandatory.pack!.code));
  assert.match(result.compositionReport.warnings[0]!, /no Active Version/);
});

// The actual bug report this migration/fix closes (Open Design Questions.md
// #2): a Template/Profile that referenced a Pack by row id kept pointing at
// that specific row forever — publishing and activating a newer Version
// under the same code did nothing for it, since nothing ever re-resolved
// the reference. Proven directly here: commission the same Template/Profile
// pair twice, publishing a new Active Version of the mandatory Pack's code
// in between, with *zero* edits to the Template itself — the second
// composition must pick up the new Version automatically.
test("a Template automatically composes a newer Active Version of its mandatory Pack's code, with no edit to the Template itself", async () => {
  const code = "test-live-code";
  const versionA = uniqueTestPackVersion();
  const v1 = await publishPack({ seed: await freshPackSeed({ code, packVersion: versionA }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(v1.ok, true, !v1.ok ? JSON.stringify(v1) : undefined);
  if (!v1.ok) throw new Error("unreachable");

  const { data: template } = await templatesDB.upsert({ code: `test-live-code-template-${randomUUID()}`, name: "Live Code Test Template" });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template!.id, [code]);
  const { data: profile } = await profilesDB.upsert({ code: `test-live-code-profile-${randomUUID()}`, name: "Live Code Test Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  assert.ok(profile);

  const firstComposition = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  assert.equal(firstComposition.composedPacks.length, 1);
  assert.equal(firstComposition.composedPacks[0]?.packVersion, versionA);

  // A newer Version of the *same code*, published and activated — this
  // supersedes (Retires) v1 the normal way, through publishPack's own
  // activate+supersede step, exactly like the real bug report's scenario
  // (an Active Pack getting archived and a new Version taking over).
  const versionB = uniqueTestPackVersion();
  const v2 = await publishPack({ seed: await freshPackSeed({ code, packVersion: versionB }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(v2.ok, true, !v2.ok ? JSON.stringify(v2) : undefined);
  if (!v2.ok) throw new Error("unreachable");
  const { data: v1Reloaded } = await packsDB.findById(v1.pack!.id);
  assert.equal(v1Reloaded?.status, "Retired", "publishing+activating v2 must supersede v1, the scenario this test needs");

  // No change to the Template/Profile at all — same ids, same stored code.
  const secondComposition = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  assert.equal(secondComposition.composedPacks.length, 1);
  assert.equal(secondComposition.composedPacks[0]?.packCode, code);
  assert.equal(secondComposition.composedPacks[0]?.packVersion, versionB, "the newer Active Version composes automatically — this is the bug fix");
  assert.equal(secondComposition.compositionReport.warnings.length, 0, "a clean pickup of the new Version, nothing to warn about");
});

// CR-080 — reactivation from a terminal state (Ch.41 VM-002-driven, per Open
// Design Questions.md) is removed entirely for Pack (owner: "Remove: Retired
// -> Active (reactivation) / Remove: Archived -> Active (reactivation)").
// Once Retired or Archived, a Pack Version is done permanently — the real
// coverage worth keeping is that both terminal states are genuinely
// terminal, not that reactivation used to auto-bump a version (it can't
// happen at all anymore). CR-081 — the "New Pack" form's own existing-code
// branch picker (createAuthoringDraft's ?fromPackId= prefill) is the only
// way to carry a terminal Pack's content forward now, and it lands in Draft,
// not Active — Registry "Copy" (copyPackAsNewDraft), which did the same job,
// was removed as redundant once this shipped.
test("transitionPack from a terminal state (Retired or Archived) back to Active is rejected — no reactivation exists for Pack", async () => {
  const published = await publishPack({ seed: await freshPackSeed(), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(published.ok, true);

  const retired = await transitionPack({ packId: published.pack!.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  assert.equal(retired.ok, true);
  const fromRetired = await transitionPack({ packId: published.pack!.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  assert.equal(fromRetired.ok, false);
  if (fromRetired.ok) throw new Error("unreachable");
  assert.equal(fromRetired.reason, "no_transition_definition");

  const archived = await transitionPack({ packId: published.pack!.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(archived.ok, true);
  const fromArchived = await transitionPack({ packId: published.pack!.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  assert.equal(fromArchived.ok, false);
  if (fromArchived.ok) throw new Error("unreachable");
  assert.equal(fromArchived.reason, "no_transition_definition");
});

// CR-080 — Validated -> Draft (Reject) mirrors Objective's CR-073 discipline:
// mandatory feedback every time, and it must be genuinely new text, not a
// repeat of the most recent comment already on record.
test("Pack reject (Validated -> Draft) requires a genuinely new comment every time", async () => {
  const draft = await createPackDraft(await freshPackSeed({ code: "test-pack-reject" }));
  assert.equal(draft.ok, true);
  if (!draft.ok) throw new Error("unreachable");
  const validated = await transitionPack({ packId: draft.pack.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  assert.equal(validated.ok, true);

  const noComment = await transitionPack({ packId: draft.pack.id, targetState: "Draft", actorRole: "power", actorId: "1001" });
  assert.equal(noComment.ok, false);
  if (noComment.ok) throw new Error("unreachable");
  assert.equal(noComment.reason, "comment_required");

  const rejected = await transitionPack({ packId: draft.pack.id, targetState: "Draft", actorRole: "power", actorId: "1001", comment: "Needs a clearer description." });
  assert.equal(rejected.ok, true, !rejected.ok ? JSON.stringify(rejected) : undefined);
  if (!rejected.ok) throw new Error("unreachable");
  assert.equal(rejected.pack.status, "Draft");

  // Re-validate, then try to reject again with the exact same comment text.
  const revalidated = await transitionPack({ packId: draft.pack.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  assert.equal(revalidated.ok, true);
  const staleComment = await transitionPack({ packId: draft.pack.id, targetState: "Draft", actorRole: "power", actorId: "1001", comment: "Needs a clearer description." });
  assert.equal(staleComment.ok, false);
  if (staleComment.ok) throw new Error("unreachable");
  assert.equal(staleComment.reason, "comment_required");

  const { data: comments } = await packsDB.getComments(draft.pack.id);
  assert.equal(comments?.length, 1, "the rejected staleComment attempt must not have written a second row");
});

// CR-026 — packs_code_version_key (migration 010) never included tenant_id,
// even after Pack ownership existed (migration 044): two tenants (or a tenant
// and Platform) each publishing the exact same (code, packVersion) collided
// on a row that wasn't actually theirs. packs_code_version_tenant_key
// (migration 063) fixes the identity; this proves the fix, not just the
// constraint — publishPack's own rerun-safety check must scope by tenant too,
// or a tenant's "new" publish could silently resolve to Platform's row.
test("CR-026: two tenants publishing the exact same (code, packVersion) no longer collide, and each tenant's Active row is independent", async () => {
  const code = "test-tenant-scoped";
  const version = uniqueTestPackVersion();
  const platformResult = await publishPack({ seed: await freshPackSeed({ code, packVersion: version, tenantId: PLATFORM_TENANT_ID }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(platformResult.ok, true, !platformResult.ok ? JSON.stringify(platformResult.errors) : undefined);

  const tenantResult = await publishPack({ seed: await freshPackSeed({ code, packVersion: version, tenantId: DEMO_TENANT_ID }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(tenantResult.ok, true, !tenantResult.ok ? JSON.stringify(tenantResult.errors) : "a tenant's own Pack at the same (code, packVersion) as Platform's must not collide");
  assert.notEqual(tenantResult.pack!.id, platformResult.pack!.id, "must be two genuinely distinct rows, not one resolved for both tenants");
  assert.equal(tenantResult.alreadyPublished, false, "must be treated as a real new publish, not Platform's row mistaken for an idempotent rerun");

  const { data: platformActive } = await packsDB.findActiveByCode(code, PLATFORM_TENANT_ID);
  const { data: tenantActive } = await packsDB.findActiveByCode(code, DEMO_TENANT_ID);
  assert.equal(platformActive?.id, platformResult.pack!.id, "Platform's own Active row, unaffected by the tenant's activation");
  assert.equal(tenantActive?.id, tenantResult.pack!.id, "the tenant's own Active row, distinct from Platform's");
});

// CR-080 — reactivation removed entirely; this test's real, still-relevant
// point (the elevated authority tier actually blocks a 'general' actor) is
// preserved below against Active -> Retired instead, the hop that now shares
// the same "authority-transition-pack-elevated" badge tier Published ->
// Active and (formerly) reactivation used.
test("Pack Active -> Retired requires 'power' — a 'general' actor is denied", async () => {
  const published = await publishPack({ seed: await freshPackSeed(), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(published.ok, true);

  const result = await transitionPack({ packId: published.pack!.id, targetState: "Retired", actorRole: "general" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.reason, "authority_denied");

  const { data: stillActive } = await packsDB.findById(published.pack!.id);
  assert.equal(stillActive?.status, "Active");
});

// CR-081 — "New Pack" form's existing-code branch picker: version is a
// SEQUENCE per (code, tenant), not a semver tree (owner: "version is to be
// treated like a 'sequence'. If it['s] taken, assign the next"). Proves both
// halves of that rule directly: (1) nextVersion is bumped from the HIGHEST
// version across EVERY status for the code — including a Draft nobody would
// ever see in the branch list — not from whichever version is merely Active;
// (2) the branch list itself only ever offers Published-through-Archived
// versions (owner: "Draft and validated status should not be shown...
// Those are still 'draft'").
//
// Bug fix (owner: logged in as a real tenant author with zero Packs of its
// own — pack-define@athens.com — picked an existing code and saw an empty
// branch-picker, even though Platform had real published versions under it)
// — a tenant with NOTHING of its own under a code now falls back to
// Platform's own branchable versions as a content source (owner: "Include
// Platform as a fallback"), same as Template/Profile Inheritance already
// lets a tenant start from a Platform baseline. `nextVersion` is
// deliberately NOT part of that fallback: it always stays this tenant's own
// independent sequence (starts fresh at "1.0.0" when they have nothing of
// their own), regardless of which version's content they branch from —
// CR-081's own "which version you copy content from never changes which
// number the new Draft gets" rule, unaffected by widening WHERE that
// content can come from.
test("packCodeVersionSummaries: version is a sequence per code, not per branch — Draft/Validated excluded from the list, nextVersion bumped from the true highest across every status", async () => {
  const code = "test-pack-sequence";
  const v1 = await publishPack({ seed: await freshPackSeed({ code, packVersion: "9.0.0", tenantId: PLATFORM_TENANT_ID }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(v1.ok, true, !v1.ok ? JSON.stringify(v1.errors) : undefined);
  const v2 = await publishPack({ seed: await freshPackSeed({ code, packVersion: "9.0.1", tenantId: PLATFORM_TENANT_ID }), actorRole: "power", actorId: "1001", activate: true });
  assert.equal(v2.ok, true, !v2.ok ? JSON.stringify(v2.errors) : undefined);
  // A Draft sitting at a HIGHER version than anything Published/Active —
  // must still count toward "the highest" for nextVersion, but must never
  // appear in the visible branch list (it's still "draft").
  const draftHigh = await createPackDraft(await freshPackSeed({ code, packVersion: "9.5.0", tenantId: PLATFORM_TENANT_ID }));
  assert.equal(draftHigh.ok, true, !draftHigh.ok ? JSON.stringify(draftHigh.errors) : undefined);

  const summaries = await packCodeVersionSummaries(PLATFORM_TENANT_ID);
  const summary = summaries[code];
  assert.ok(summary, "the code must appear in the summary map");
  assert.equal(summary!.versions.length, 2, "only Published/Active/Retired/Archived count toward the branch list — the Draft must be excluded");
  assert.ok(summary!.versions.every((v) => v.version !== "9.5.0"), "the Draft-status version must never appear in the branch list");
  assert.equal(summary!.nextVersion, "9.5.1", "nextVersion must bump from the HIGHEST version across every status (9.5.0, the invisible Draft) — not from whichever version merely happens to be Active (9.0.1)");

  // Tenant fallback — a different tenant with NOTHING of its own under this
  // code sees Platform's own branchable versions as a content source, but
  // its OWN nextVersion is unaffected — a fresh "1.0.0", not a continuation
  // of Platform's own "9.5.1".
  const demoSummaries = await packCodeVersionSummaries(DEMO_TENANT_ID);
  const demoSummary = demoSummaries[code];
  assert.ok(demoSummary, "a tenant with nothing of its own under this code must still see Platform's versions as a fallback");
  assert.equal(demoSummary!.versions.length, 2, "the same 2 branchable (Published-through-Archived) Platform versions, Draft still excluded");
  assert.equal(demoSummary!.nextVersion, "1.0.0", "the fallback offers Platform's CONTENT to branch from, but this tenant's own version sequence starts fresh — never continues Platform's numbering");
});
