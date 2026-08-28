// CR-067 — Pack authoring's own real wiring of the generic Composition
// Strategy engine: compositionSources arity/same-code validation
// (validatePackSeed) and the end-to-end "Compose" action (composeAuthoringDraft
// -> saveAuthoringDraft, exactly what the web route's POST .../compose calls).
// Run against the real dev database, no mocking — same discipline as
// pack-sdk.test.ts.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { createPackDraft, publishPack, validatePackSeed, type PackSeedInput } from "../src/routes/seu/core/packs.js";
import { composeAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { registerTestOntologyCode, deleteTestOntologyCodes } from "./testFixtures.js";

const createdOntologyCodes: Array<{ conceptType: string; code: string }> = [];

after(async () => {
  await deleteTestOntologyCodes(createdOntologyCodes);
  await pool.end();
});

async function freshCode(label: string): Promise<string> {
  const code = await registerTestOntologyCode("capability-name", label);
  createdOntologyCodes.push({ conceptType: "capability-name", code });
  return code;
}

test("validatePackSeed rejects a Composition Strategy with too few sources", async () => {
  const code = await freshCode("test-comp-arity");
  const seed: PackSeedInput = {
    code, name: "Test", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "merge", compositionSources: [{ packCode: "some-code" }],
  };
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /requires at least 2/.test(e)));
});

test("validatePackSeed rejects Merge sources that don't share the same code", async () => {
  const code = await freshCode("test-comp-samecode");
  const seed: PackSeedInput = {
    code, name: "Test", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "merge", compositionSources: [{ packCode: "code-a" }, { packCode: "code-b" }],
  };
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /same code/.test(e)));
});

test("validatePackSeed rejects Conflict Detection as a directly-chosen Composition Strategy", async () => {
  const code = await freshCode("test-comp-cd");
  const seed: PackSeedInput = {
    code, name: "Test", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "conflict-detection",
  };
  const result = await validatePackSeed(seed);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /not an independent/.test(e)));
});

test("composeAuthoringDraft — specialization pre-fills a new Draft from an Active parent Pack, code included", async () => {
  const parentCode = await freshCode("test-compose-specialize-parent");
  const published = await publishPack({
    seed: {
      code: parentCode, name: "Parent Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
      contributions: { capabilities: [{ code: `${parentCode}-cap`, name: "Cap" }] },
    },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(published.ok, true);

  // Starts at a version distinct from the parent's own "1.0.0" — once
  // Specialization copies the parent's CODE (below), a same-version Draft
  // would collide with the parent's own already-published (code, version,
  // tenant) row; version itself is never copied (every strategy starts
  // fresh), so this Draft's own starting version survives the compose.
  const childCode = await freshCode("test-compose-specialize-child");
  const draft = await createPackDraft({
    code: childCode, name: "Child Draft (before compose)", category: "Engineering", packVersion: "0.1.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "specialization", compositionSources: [{ packCode: parentCode }],
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: draft.pack.id });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.composedFrom, [parentCode]);
  assert.deepEqual(result.conflicts, []);

  const { data: composed } = await packsDB.findById(draft.pack.id);
  assert.ok(composed);
  assert.equal(composed!.code, parentCode, "Specialization's own definition: creation is an exact copy of the parent, including code");
  assert.equal(composed!.name, "Parent Pack");
  assert.deepEqual(composed!.contributions.capabilities, [{ code: `${parentCode}-cap`, name: "Cap" }]);
  // Own identity fields Specialization must NOT inherit from the parent.
  assert.equal(composed!.pack_version, "0.1.0", "packVersion is never copied from the parent — this Draft's own starting version survives the compose");
  assert.equal(composed!.metadata.compositionStrategy, "specialization", "this Draft's own composition choice must survive the compose, not be overwritten by the parent's");
});

test("composeAuthoringDraft — union combines two distinct Active Packs' fields, flags a genuine disagreement, unions non-conflicting array items", async () => {
  const codeA = await freshCode("test-compose-union-a");
  const codeB = await freshCode("test-compose-union-b");
  const a = await publishPack({
    seed: { code: codeA, name: "Union Source A", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: { capabilities: [{ code: `${codeA}-cap`, name: "Cap A" }] } },
    actorRole: "power", actorId: "1001", activate: true,
  });
  const b = await publishPack({
    seed: { code: codeB, name: "Union Source B", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: { capabilities: [{ code: `${codeB}-cap`, name: "Cap B" }] } },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);

  const childCode = await freshCode("test-compose-union-child");
  const draft = await createPackDraft({
    code: childCode, name: "Union Draft", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "union", compositionSources: [{ packCode: codeA }, { packCode: codeB }],
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: draft.pack.id });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.composedFrom.slice().sort(), [codeA, codeB].sort());
  // "Union Source A" vs "Union Source B" is a genuine, unresolvable disagreement on `name`.
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0], /name/);

  const { data: composed } = await packsDB.findById(draft.pack.id);
  assert.ok(composed);
  // The conflicting field never survives into the composed content...
  assert.equal(composed!.name, "Union Draft", "Save's own required-field fallback, since `name` was excluded from the composed fields as a conflict");
  // ...while non-conflicting array items combine unambiguously (both capabilities present, nothing dropped).
  const capCodes = (composed!.contributions.capabilities ?? []).map((c) => c.code).sort();
  assert.deepEqual(capCodes, [`${codeA}-cap`, `${codeB}-cap`].sort());
});

// Real, honest limitation (not something this test works around): Pack's own
// identity is one Active row per (code, tenant) — findActiveCompositionSource
// always resolves a code to this Draft's own tenant first. Merge's "two
// sources sharing a code" therefore can't resolve to two genuinely DIFFERENT
// rows from a flat compositionSources code list scoped to one tenant; the
// combining algorithm itself (agreement/conflict/nested-recursion) is
// already thoroughly covered directly against compositionEngine.merge() in
// composition-strategy.test.ts. What this test proves is the REAL wiring
// end-to-end — arity/same-code validation with a duplicated code entry,
// resolution, compositionEngine.merge() dispatch, and save — using the one
// same-code scenario achievable today: the same code entered twice,
// resolving to the same row both times (a legitimate, if trivial, self-merge
// — every field agrees with itself, so zero conflicts is the CORRECT result,
// not a workaround).
test("composeAuthoringDraft — merge with a code entered twice self-merges cleanly (real wiring, no conflicts, since a Pack agrees with itself)", async () => {
  const sharedCode = await freshCode("test-compose-merge-shared");
  const published = await publishPack({
    seed: { code: sharedCode, name: "Merge Source", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: { capabilities: [{ code: `${sharedCode}-cap`, name: "Cap" }] } },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(published.ok, true);

  const childCode = await freshCode("test-compose-merge-child");
  const draft = await createPackDraft({
    code: childCode, name: "Merge Draft", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "merge", compositionSources: [{ packCode: sharedCode }, { packCode: sharedCode }],
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: draft.pack.id });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.conflicts, []);

  const { data: composed } = await packsDB.findById(draft.pack.id);
  assert.ok(composed);
  assert.equal(composed!.name, "Merge Source");
  assert.deepEqual((composed!.contributions.capabilities ?? []).map((c) => c.code), [`${sharedCode}-cap`]);
});

test("composeAuthoringDraft — intersection keeps only unanimous fields, drops a disagreeing one silently (no conflicts reported)", async () => {
  const codeA = await freshCode("test-compose-intersect-a");
  const codeB = await freshCode("test-compose-intersect-b");
  const a = await publishPack({
    seed: { code: codeA, name: "Common Name", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: { capabilities: [{ code: `${codeA}-cap`, name: "Cap A" }] } },
    actorRole: "power", actorId: "1001", activate: true,
  });
  const b = await publishPack({
    seed: { code: codeB, name: "Common Name", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: { capabilities: [{ code: `${codeB}-cap`, name: "Cap B" }] } },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);

  const childCode = await freshCode("test-compose-intersect-child");
  const draft = await createPackDraft({
    code: childCode, name: "Intersection Draft", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "intersection", compositionSources: [{ packCode: codeA }, { packCode: codeB }],
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: draft.pack.id });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Intersection never flags anything — disagreement is simply dropped, not escalated.
  assert.deepEqual(result.conflicts, []);

  const { data: composed } = await packsDB.findById(draft.pack.id);
  assert.ok(composed);
  // `name` is unanimous across both sources — kept.
  assert.equal(composed!.name, "Common Name");
  // `contributionCapabilities` disagrees (different array contents on each side) — dropped
  // entirely, not partially combined (Intersection doesn't recurse the way Merge/Union do);
  // the child Draft's own pre-existing (empty) value survives untouched.
  assert.deepEqual(composed!.contributions.capabilities, []);
});

test("composeAuthoringDraft — supplement adds only what the base lacks, rejects (never applies) a field the base already declares", async () => {
  const baseCode = await freshCode("test-compose-supplement-base");
  const extraCode = await freshCode("test-compose-supplement-extra");
  const base = await publishPack({
    seed: { code: baseCode, name: "Base Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} },
    actorRole: "power", actorId: "1001", activate: true,
  });
  const extra = await publishPack({
    // `name` collides with the base's own — must be rejected, never applied.
    // `owner` (metadata) is new — the base never set one — must be added.
    seed: { code: extraCode, name: "Attempted Override Name", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {}, owner: "team-x" },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(base.ok, true);
  assert.equal(extra.ok, true);

  const childCode = await freshCode("test-compose-supplement-child");
  const draft = await createPackDraft({
    code: childCode, name: "Supplement Draft", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "supplement", compositionSources: [{ packCode: baseCode }, { packCode: extraCode }],
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: draft.pack.id });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0], /name/);

  const { data: composed } = await packsDB.findById(draft.pack.id);
  assert.ok(composed);
  assert.equal(composed!.name, "Base Pack", "the base's own name survives — the supplement's attempted override was rejected, not applied");
  assert.equal(composed!.metadata.owner, "team-x", "a genuinely new field (absent from the base) is added");
});

test("composeAuthoringDraft — override points the author at the existing version-bump flow instead of computing anything", async () => {
  const code = await freshCode("test-compose-override");
  const published = await publishPack({
    seed: { code, name: "Override Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(published.ok, true);
  if (!published.ok || !published.pack) return;

  // Override needs 0 external sources (it acts on the entity's own prior
  // version) — a fresh Draft with compositionStrategy: "override" and no
  // compositionSources at all is exactly the valid, expected shape.
  const draftCode = await freshCode("test-compose-override-draft");
  const draft = await createPackDraft({
    code: draftCode, name: "Override Draft", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional",
    contributions: {}, compositionStrategy: "override",
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: draft.pack.id });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.composedFrom, []);
  assert.ok(result.note && /Next version/.test(result.note));

  // No content was computed or written — the draft's own fields are untouched.
  const { data: composed } = await packsDB.findById(draft.pack.id);
  assert.equal(composed!.name, "Override Draft");
});

test("composeAuthoringDraft — rejects composing a Pack that hasn't reached (or has left) Draft", async () => {
  const parentCode = await freshCode("test-compose-notdraft-parent");
  const published = await publishPack({
    seed: { code: parentCode, name: "Parent", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} },
    actorRole: "power", actorId: "1001", activate: true,
  });
  assert.equal(published.ok, true);
  if (!published.ok || !published.pack) return;

  const result = await composeAuthoringDraft({ kind: "Pack", id: published.pack.id });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((e) => /only a Draft/.test(e)));
});
