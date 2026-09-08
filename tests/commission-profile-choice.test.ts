// Real fix, not just documented: findOrCreateDefaultProfile's own comment
// used to flag "no UI to choose between multiple real Profiles for a
// Template" as a known, unsolved gap. Closed via getObjectiveDetail's
// commissioningOptions (core/objectives.ts, a capability -> Templates ->
// Profiles tree — commissionFromExistingObjective itself no longer derives a
// Template at all; templateId is now the caller's own explicit choice, same
// as profileId already was) + a real picker on the SEU screen
// (seu/seus/new.ejs?objectiveId=..). Proves, against real dev data:
//   1. getObjectiveDetail surfaces every real (non-throwaway) Profile for
//      the Template under the branch(es) it actually covers.
//   2. Passing an explicit profileId actually composes that Profile's own
//      optional Packs, not whichever the auto-pick heuristic would have
//      chosen.
//   3. Omitting profileId still falls back to the same heuristic as before
//      (regression safety — the quick-commission path is unaffected).
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { getObjectiveDetail } from "../src/routes/seu/core/objectives.js";
import { commissionFromExistingObjective } from "../src/routes/seu/core/commissioning.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { getSeuEbmView } from "../src/routes/seu/core/seus.js";
import { ensureEventSubscriptionsLoaded, driveCommissioningToActive } from "./testFixtures.js";

before(async () => {
  // Must run before this file's own first commissionFromExistingObjective
  // call — see ensureEventSubscriptionsLoaded's own header comment
  // (testFixtures.ts).
  await ensureEventSubscriptionsLoaded();
});

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
    // Bug fix (owner: "let us fix the test suite") — capability_fulfilments
    // has no seu_id of its own (only seu_capability_id -> seu_capabilities,
    // participant_id -> participants), so it was never cleared here at all;
    // once enough accumulated fixture rows existed, the participants delete
    // below started hitting capability_fulfilments_participant_id_fkey.
    await pool.query("DELETE FROM capability_fulfilments WHERE seu_capability_id IN (SELECT id FROM seu_capabilities WHERE seu_id = ANY($1::uuid[]))", [seuIds]);
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
    deliverableCatalogue: [{ code: "requirements-spec" }],
  });
  assert.equal(templateErr, undefined);
  const { data: capabilities } = await capabilitiesDB.findByCodes(["requirements-analysis", "architecture-design"]);
  await templatesDB.setRequiredCapabilities(template!.id, (capabilities ?? []).map((c) => c.id));
  // technology-nodejs.pack.json declares a real `required` dependency on
  // "development" — never checked as a blocking concern before this session's
  // own detectCompositionConflicts (design/mvp-build-plan/SEU Composition.md);
  // this test's own Template must mandate it too, or selecting the nodejs
  // Pack as optional leaves that dependency genuinely unsatisfied.
  await templatesDB.setMandatoryPacks(template!.id, ["development"]);

  // Two real Profiles for the same Template — one plain, one declaring
  // technology-nodejs as optional, so composing it is directly observable.
  const plainCode = `verify-profile-choice-plain-${randomUUID()}`;
  const nodejsCode = `verify-profile-choice-nodejs-${randomUUID()}`;
  // CR-091 Part 2 — development-methodology/primary-programming-language/
  // source-control-provider are mandatory on the Platform tenant; publishProfile
  // runs validateProfileSeed, so these need real values or it rejects both.
  const mandatoryConfigParams = { developmentMethodology: "scrum", primaryProgrammingLanguage: "typescript", sourceControlProvider: "github" };
  const plainPublished = await publishProfile({ code: plainCode, name: "Plain Profile", baseTemplateCode: templateCode, environment: "development", optionalPackCodes: [], profileVersion: "1.0.0", ...mandatoryConfigParams });
  assert.equal(plainPublished.ok, true, !plainPublished.ok ? plainPublished.errors.join("; ") : undefined);
  const nodejsPublished = await publishProfile({ code: nodejsCode, name: "Nodejs Profile", baseTemplateCode: templateCode, environment: "development", optionalPackCodes: ["technology-nodejs"], profileVersion: "1.0.0", ...mandatoryConfigParams });
  assert.equal(nodejsPublished.ok, true, !nodejsPublished.ok ? nodejsPublished.errors.join("; ") : undefined);
  if (!nodejsPublished.ok || !plainPublished.ok) return;

  // CR-009: Engineering Objectives need a Strategic parent (only Strategic may be a root).
  // CR-075 — createObjective now requires the parent to be Proposed when adding a child under it.
  const { objective: pcRoot } = await createObjective({ statement: `verify-profile-choice-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed",});
  const { objective } = await createObjective({ statement: `verify-profile-choice-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design"], tier: "Engineering", parentObjectiveId: pcRoot.id, requestedBy: 1001,});
  assert.equal(objective.status, "Active");

  // 1. getObjectiveDetail surfaces both real Profiles as real candidates,
  // each exactly once (CR-092 Part 6 inversion — one row per Profile, not
  // one per Capability branch, even though this Template covers both
  // Capabilities this Objective declares — it's the only Template requiring
  // either, in this test's own isolated fixture), each row naming both
  // required Capabilities its own Template covers.
  const detail = await getObjectiveDetail(objective.id);
  assert.ok(detail?.commissioningOptions?.length);
  const rowsForTemplate = detail!.commissioningOptions!.filter((r) => r.templateCode === templateCode);
  const candidateIds = rowsForTemplate.map((r) => r.profile?.id).filter((id): id is string => !!id).sort();
  assert.deepEqual(candidateIds, [plainPublished.profileId, nodejsPublished.profileId].sort());
  for (const row of rowsForTemplate) {
    assert.deepEqual(row.capabilities.map((c) => c.code).sort(), ["architecture-design", "requirements-analysis"]);
  }

  // 2. Explicitly choosing the Template + nodejs Profile actually composes it.
  const requestedChoice = await commissionFromExistingObjective({ objectiveId: objective.id, selections: [{ templateId: template!.id, profileId: nodejsPublished.profileId }], actorRole: "super", actorId: "1001" });
  assert.equal(requestedChoice.ok, true, !requestedChoice.ok ? JSON.stringify(requestedChoice) : undefined);
  if (!requestedChoice.ok) return;
  const chosen = await driveCommissioningToActive({ seuId: requestedChoice.seu.id, actorRole: "super", actorId: "1001" });
  assert.equal(chosen.ok, true, !chosen.ok ? `commissioning failed: ${chosen.reason}` : undefined);
  if (!chosen.ok) return;
  // composedPacks moved off SeuDetailView onto its own EBM page/read model
  // (design/mvp-build-plan/SEU Composition.md — "create a new one. EBM
  // page.") — getSeuDetailView is SEU-runtime only now.
  const chosenEbmView = await getSeuEbmView(chosen.seu.id);
  assert.ok(chosenEbmView!.composedPacks.some((p) => p.packCode === "technology-nodejs"), "expected the explicitly-chosen Profile's optional Pack to be composed");

  // 3. Omitting profileId still works via the existing auto-pick fallback
  // (development-environment preference, else first real match) — doesn't
  // throw, still produces a real SEU. templateId is still required — it's
  // the human's own choice now, never auto-derived — but is the one thing
  // this path never asked the human to pick before either.
  const { objective: objective2 } = await createObjective({ statement: `verify-profile-choice-fallback-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design"], tier: "Engineering", parentObjectiveId: pcRoot.id, requestedBy: 1001,});
  const autoPicked = await commissionFromExistingObjective({ objectiveId: objective2.id, selections: [{ templateId: template!.id }], actorRole: "super", actorId: "1001" });
  assert.equal(autoPicked.ok, true, !autoPicked.ok ? JSON.stringify(autoPicked) : undefined);
});
