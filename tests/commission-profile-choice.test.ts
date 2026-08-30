// Real fix, not just documented: findOrCreateDefaultProfile's own comment
// used to flag "no UI to choose between multiple real Profiles for a
// Template" as a known, unsolved gap. Closed via getObjectiveDetail's new
// commissioningPreview (core/objectives.ts) + a real dropdown on the
// Objective detail page + commissionFromExistingObjective accepting an
// explicit profileId. Proves, against real dev data:
//   1. getObjectiveDetail surfaces every real (non-throwaway) Profile for
//      the matched Template when more than one exists.
//   2. Passing an explicit profileId actually composes that Profile's own
//      optional Packs, not whichever the auto-pick heuristic would have
//      chosen.
//   3. Omitting profileId still falls back to the same heuristic as before
//      (regression safety — the quick-commission path is unaffected).
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { getObjectiveDetail } from "../src/routes/seu/core/objectives.js";
import { commissionFromExistingObjective } from "../src/routes/seu/core/commissioning.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";

after(async () => {
  await pool.end();
});

// This test's own fixture rows (randomUUID-coded, never cleaned up after a
// run, same disposable-fixture convention every other test in this suite
// uses) accumulate across repeated runs against the shared dev database —
// and since every one of them requires the exact same 2 Capabilities, they
// all tie for "tightest fit" with no deterministic tiebreaker between them.
// A real, observed flake: findCandidateTemplates matched a *previous* run's
// leftover Template instead of this run's own, so the "explicitly chosen
// Profile" assertions failed against a Template this run never touched.
// Fixed at the root — clear out this test's own prior leftovers before
// creating a fresh one, walking the real dependency chain
// commissionSeu populates for this specific minimal Template (deliverables,
// seu_capabilities, seus, ebms, profiles, templates — in that order, since
// every one of those FKs is NO ACTION, not CASCADE) so exactly one
// verify-profile-choice-template-* row exists whenever this test's own
// assertions run, regardless of how many times it's run before.
async function cleanupPriorRuns(): Promise<void> {
  const { rows: templateRows } = await pool.query<{ id: string }>("SELECT id FROM templates WHERE code LIKE 'verify-profile-choice-template-%'");
  const { rows: profileRows } = await pool.query<{ id: string }>("SELECT id FROM profiles WHERE code LIKE 'verify-profile-choice-%'");
  const templateIds = templateRows.map((r) => r.id);
  const profileIds = profileRows.map((r) => r.id);
  if (templateIds.length === 0 && profileIds.length === 0) return;

  const { rows: seuRows } = await pool.query<{ id: string }>(
    "SELECT id FROM seus WHERE template_id = ANY($1::uuid[]) OR profile_id = ANY($2::uuid[])",
    [templateIds, profileIds]
  );
  const seuIds = seuRows.map((r) => r.id);
  if (seuIds.length > 0) {
    // CR-059 build-time fix — every table with a direct NO ACTION FK to
    // seus.id must be cleared before the SEU row itself (confirmed against
    // information_schema, not guessed: 20 tables reference seus.id today).
    // This helper previously covered only events/deliverables/seu_capabilities
    // and broke — twice — once real accumulated state finally exercised the
    // gap (quality_gate_evaluations, then reviews). findings must go before
    // reviews (findings.review_id -> reviews.id), same discipline the events
    // comment above already established for this chain.
    await pool.query("DELETE FROM findings WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM events WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM quality_gate_evaluations WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM quality_gate_waivers WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM reviews WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM evidence WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM decisions WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM obligations WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM knowledge_items WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM attention_items WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM external_interactions WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM deliverable_references WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM attestations WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM compliance_waivers WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM compliance_evaluations WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    // dependency_edges was dropped outright by migration 073 (CR-039 —
    // superseded by the Template-scoped dependency_definitions model, no
    // per-SEU instance table to clean up here anymore). It existed live
    // when this cleanup chain was first written from a real
    // information_schema query; a later full migration replay correctly
    // dropped it, making this line reference a table that no longer exists.
    await pool.query("DELETE FROM commands WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM participants WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM deliverables WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM seu_capabilities WHERE seu_id = ANY($1::uuid[])", [seuIds]);
    await pool.query("DELETE FROM seus WHERE id = ANY($1::uuid[])", [seuIds]);
  }
  await pool.query("DELETE FROM ebms WHERE template_id = ANY($1::uuid[]) OR profile_id = ANY($2::uuid[])", [templateIds, profileIds]);
  await pool.query("DELETE FROM profiles WHERE id = ANY($1::uuid[])", [profileIds]);
  await pool.query("DELETE FROM templates WHERE id = ANY($1::uuid[])", [templateIds]);
}

test("Objective-first commissioning offers a real Profile choice when more than one exists, and honours it", async () => {
  await cleanupPriorRuns();

  // Two required Capabilities, not one — sdk-authoring.test.ts's own
  // validTemplateSeed helper creates throwaway Templates requiring exactly
  // ["requirements-analysis"] too, and findCandidateTemplates breaks ties on
  // requiredCapabilityCount alone, with no secondary tiebreaker favouring
  // this test's own Template. A one-capability requirement here was a real,
  // observed flake under concurrent test-file execution — this combination
  // isn't used as a Template's required set anywhere else in the suite.
  const templateCode = `verify-profile-choice-template-${randomUUID()}`;
  const { data: template, error: templateErr } = await templatesDB.upsert({
    code: templateCode,
    name: "Verify Profile Choice Template",
    deliverableCatalogue: [{ code: "requirements-spec", name: "Requirements Specification", category: "Documentation", producingCapabilityCode: "requirements-analysis" }],
  });
  assert.equal(templateErr, undefined);
  const { data: capabilities } = await capabilitiesDB.findByCodes(["requirements-analysis", "architecture-solution-design"]);
  await templatesDB.setRequiredCapabilities(template!.id, (capabilities ?? []).map((c) => c.id));

  // Two real Profiles for the same Template — one plain, one declaring
  // technology-nodejs as optional, so composing it is directly observable.
  const plainCode = `verify-profile-choice-plain-${randomUUID()}`;
  const nodejsCode = `verify-profile-choice-nodejs-${randomUUID()}`;
  const plainPublished = await publishProfile({ code: plainCode, name: "Plain Profile", baseTemplateCode: templateCode, environment: "development", optionalPackCodes: [], profileVersion: "1.0.0", category: "startup" });
  assert.equal(plainPublished.ok, true, !plainPublished.ok ? plainPublished.errors.join("; ") : undefined);
  const nodejsPublished = await publishProfile({ code: nodejsCode, name: "Nodejs Profile", baseTemplateCode: templateCode, environment: "development", optionalPackCodes: ["technology-nodejs"], profileVersion: "1.0.0", category: "startup" });
  assert.equal(nodejsPublished.ok, true, !nodejsPublished.ok ? nodejsPublished.errors.join("; ") : undefined);
  if (!nodejsPublished.ok || !plainPublished.ok) return;

  // CR-009: Engineering Objectives need a Strategic parent (only Strategic may be a root).
  // CR-075 — createObjective now requires the parent to be Proposed when adding a child under it.
  const { objective: pcRoot } = await createObjective({ statement: `verify-profile-choice-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed",});
  const { objective } = await createObjective({ statement: `verify-profile-choice-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-solution-design"], tier: "Engineering", parentObjectiveId: pcRoot.id, requestedBy: 1001,});
  assert.equal(objective.status, "Active");

  // 1. getObjectiveDetail surfaces both real Profiles as real candidates.
  const detail = await getObjectiveDetail(objective.id);
  assert.ok(detail?.commissioningPreview);
  assert.equal(detail!.commissioningPreview!.templateCode, templateCode);
  const candidateIds = detail!.commissioningPreview!.candidateProfiles.map((p) => p.id).sort();
  assert.deepEqual(candidateIds, [plainPublished.profileId, nodejsPublished.profileId].sort());

  // 2. Explicitly choosing the nodejs Profile actually composes it.
  const chosen = await commissionFromExistingObjective({ objectiveId: objective.id, actorRole: "super", actorId: "1001", profileId: nodejsPublished.profileId });
  assert.equal(chosen.ok, true, !chosen.ok ? JSON.stringify(chosen) : undefined);
  if (!chosen.ok) return;
  const chosenDetail = await getSeuDetailView(chosen.seu.id);
  assert.ok(chosenDetail!.composedPacks.some((p) => p.packCode === "technology-nodejs"), "expected the explicitly-chosen Profile's optional Pack to be composed");

  // 3. Omitting profileId still works via the existing auto-pick fallback
  // (development-environment preference, else first real match) — doesn't
  // throw, still produces a real SEU.
  const { objective: objective2 } = await createObjective({ statement: `verify-profile-choice-fallback-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-solution-design"], tier: "Engineering", parentObjectiveId: pcRoot.id, requestedBy: 1001,});
  const autoPicked = await commissionFromExistingObjective({ objectiveId: objective2.id, actorRole: "super", actorId: "1001" });
  assert.equal(autoPicked.ok, true, !autoPicked.ok ? JSON.stringify(autoPicked) : undefined);
});
