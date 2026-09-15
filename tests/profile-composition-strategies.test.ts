// CR-067's own Composition Strategy engine (specialize/merge/union/
// intersection/supplement, compositionEngine.ts) is already fully tested in
// engine.test.ts and pack-sdk.test.ts against small, synthetic sources. This
// file instead proves out how each strategy actually behaves against a real,
// already-live scenario surfaced while fixing the test suite (owner,
// 2026-09-06): "the requirements-analysis Pack" and "integration-jira" both
// genuinely, deliberately contribute a Capability under the SAME code
// ("requirements-analysis") — real multi-Pack realization of one shared
// Ontology term, not test pollution or a data bug (confirmed against the
// live seed data; see dependency-definition-engine.test.ts's own comment).
//
// Owner: "So the real question is narrower: when something needs 'the
// Services that realize requirements-analysis,' which of those two
// Pack-scoped rows does it walk - that is the example of conflict resolution
// that the composition engine should handle... Both the packs move to
// Profile. When this profile is selected, the Composition Validation should
// throw up the conflict."
//
// This is exactly that scenario, run through the real, already-built engine
// — proof of what each strategy WOULD produce if a Profile's own composition
// step were wired to resolve it this way (core app work, not done here —
// owner: "No change to the actual app").
//
// No new seed data needed: the two real Packs already on the platform
// produce rich, illustrative results across all five strategies as-is
// (verified directly before writing this file) — merge correctly refuses
// (different Pack codes), union surfaces the real requirements-analysis
// disagreement as a precise, field-level conflict (while still cleanly
// combining everything the two Packs DON'T disagree on), intersection keeps
// only what's genuinely unanimous, supplement protects the base's own
// content, and specialize demonstrates the one-parent-plus-overrides case.
// Read-only against these two Packs — never publishes, drafts, or mutates
// anything; no change to the actual app.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { composableFieldsFromPack } from "../src/routes/seu/core/sdkAuthoring.js";
import { compositionEngine, type CompositionSource } from "../src/domain/engine/compositionEngine.js";

async function loadScenarioSources(): Promise<{ openupRequirements: CompositionSource; integrationJira: CompositionSource }> {
  const { data: openupRequirementsPack } = await packsDB.findActiveByCode("requirements-analysis");
  const { data: integrationJiraPack } = await packsDB.findActiveByCode("integration-jira");
  assert.ok(openupRequirementsPack, "expected the real, seeded requirements-analysis Pack to be Active");
  assert.ok(integrationJiraPack, "expected the real, seeded integration-jira Pack to be Active");
  return {
    openupRequirements: { id: openupRequirementsPack.id, code: openupRequirementsPack.code, fields: composableFieldsFromPack(openupRequirementsPack, { includeIdentity: true }) },
    integrationJira: { id: integrationJiraPack.id, code: integrationJiraPack.code, fields: composableFieldsFromPack(integrationJiraPack, { includeIdentity: true }) },
  };
}

test("composition scenario sanity check: both real Packs genuinely contribute a requirements-analysis Capability, with different content", async () => {
  const { openupRequirements, integrationJira } = await loadScenarioSources();
  const openupCap = (openupRequirements.fields.contributionCapabilities as Array<{ code: string; name?: string }>).find((c) => c.code === "requirements-analysis");
  const jiraCap = (integrationJira.fields.contributionCapabilities as Array<{ code: string; name?: string }>).find((c) => c.code === "requirements-analysis");
  assert.ok(openupCap, "the OpenUP requirements Pack contributes a requirements-analysis capability");
  assert.ok(jiraCap, "the Jira integration Pack contributes a requirements-analysis capability too — genuinely, not a duplicate/bug");
  assert.notEqual(openupCap!.name, jiraCap!.name, "the two Packs' own realizations of the same capability code genuinely disagree — this is the real conflict");
});

test("merge — refuses two Packs with different codes; requirements-analysis and integration-jira are not the same logical entity", async () => {
  const { openupRequirements, integrationJira } = await loadScenarioSources();
  const result = compositionEngine.merge([openupRequirements, integrationJira]);
  assert.equal(result.ok, false, "Merge requires every source to share the same code — these are two different Packs, not two Versions/Drafts of one");
  if (!result.ok) assert.match(result.error, /same code/i);
});

test("union — combines everything the two Packs don't disagree on, and surfaces the real requirements-analysis disagreement precisely, field by field", async () => {
  const { openupRequirements, integrationJira } = await loadScenarioSources();
  const result = compositionEngine.union([openupRequirements, integrationJira]);
  assert.equal(result.ok, true, "Union has no same-code requirement, unlike Merge");
  if (!result.ok) return;

  // The actual scenario: both Packs contribute a capability CODED
  // "requirements-analysis" with a different name/description — Union's
  // array-identity matching (by code) finds the matching pair and recurses
  // into it, rather than treating the whole array as one opaque disagreement.
  assert.ok(
    result.conflicts.some((c) => c.includes('contributionCapabilities[code=requirements-analysis].name')),
    `expected a precise conflict naming the shared "requirements-analysis" capability's own name field, got: ${JSON.stringify(result.conflicts)}`
  );
  assert.ok(
    result.conflicts.some((c) => c.includes('contributionCapabilities[code=requirements-analysis].description')),
    "expected the same precision on the capability's description field"
  );

  // Everything else about these two Packs is also genuinely different
  // (they're different Packs), so it's correctly flagged too — Union isn't
  // scoped to just the one capability code; every top-level field the two
  // sources both set to a different value is a real conflict.
  for (const field of ["code", "name", "category", "installationClassification", "owner", "description"]) {
    assert.ok(result.conflicts.some((c) => c.startsWith(`Composition conflict on "${field}"`)), `expected a top-level conflict on "${field}" — the two Packs genuinely disagree on it`);
  }

  // What the two Packs DON'T disagree on still combines cleanly. Both
  // declare a "deliverable.transition" authority rule under a DIFFERENT own
  // code — different identity, so Union adds both rather than conflating
  // them into a false disagreement.
  const authorityRules = result.fields.contributionAuthorityRules as Array<{ code: string }>;
  assert.equal(authorityRules.length, 5, "3 from the requirements-analysis Pack + 2 from integration-jira, unioned as distinct items");
  assert.ok(authorityRules.some((r) => r.code === "authority-transition-deliverable"));
  assert.ok(authorityRules.some((r) => r.code === "authority-jira-deliverable-transition"));

  // The one field both Packs genuinely agree on (same value, not just same
  // key) is correctly recognised as agreement, not conflict — appears once
  // in the combined fields, not in the conflict list.
  assert.equal(result.fields.publisher, "Platform");
  assert.ok(!result.conflicts.some((c) => c.startsWith('Composition conflict on "publisher"')), "both Packs set publisher to the identical value \"Platform\" — that's agreement, not a conflict");
});

test("intersection — keeps only what's genuinely unanimous between the two Packs, drops every disagreement silently (including the shared capability code)", async () => {
  const { openupRequirements, integrationJira } = await loadScenarioSources();
  const result = compositionEngine.intersection([openupRequirements, integrationJira]);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Two Packs this different share almost nothing — only the identical
  // publisher value survives. Intersection never attempts to combine or
  // explain a disagreement (unlike Union); it just drops it, so the
  // requirements-analysis capability itself doesn't appear here at all.
  assert.equal(result.fields.publisher, "Platform");
  assert.equal(result.fields.contributionCapabilities, undefined, "the disagreeing requirements-analysis capability (and everything else that disagrees) is dropped, not reported");
});

test("supplement — the base Pack's own content is protected; the supplementing Pack contributes nothing new here since it has no field the base doesn't already declare", async () => {
  const { openupRequirements, integrationJira } = await loadScenarioSources();
  const result = compositionEngine.supplement(openupRequirements, [integrationJira]);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Base (requirements-analysis) is untouched — its own capability
  // realization wins outright, never silently replaced by the supplement's.
  const capabilities = result.fields.contributionCapabilities as Array<{ code: string; name?: string }>;
  const requirementsCap = capabilities.find((c) => c.code === "requirements-analysis");
  assert.equal(requirementsCap?.name, "Requirements Management", "the base's own realization is kept, not overwritten by the supplement's");

  // Every field integration-jira also carries is rejected, not merged in —
  // supplement only ever fills a genuine gap in the base, never overrides.
  assert.ok(result.rejected.includes("contributionCapabilities"), "the base already declares contributionCapabilities, so the supplement's own version is rejected, not applied");
  assert.ok(result.rejected.includes("contributionAuthorityRules"));
});

test("specialize — a Draft copied from the requirements-analysis Pack alone, with a real author override applied", async () => {
  const { openupRequirements } = await loadScenarioSources();
  const result = compositionEngine.specialize(openupRequirements, { name: "Requirements (Tenant-Specialised Copy)" });
  assert.equal(result.fields.code, "requirements-analysis", "specialization is an exact copy, code included, unless the author changes it");
  assert.equal(result.fields.name, "Requirements (Tenant-Specialised Copy)", "the author's own override wins");
  assert.deepEqual(result.parentIds, [openupRequirements.id]);
  const capabilities = result.fields.contributionCapabilities as Array<{ code: string }>;
  assert.ok(capabilities.some((c) => c.code === "requirements-analysis"), "everything else the parent declared, including its own requirements-analysis capability, is copied as-is");
});
