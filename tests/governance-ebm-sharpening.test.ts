// Governance & EBM Sharpening — Plan (Phase 16). Four FRs:
//   FR-3.3      the EBM is versioned
//   FR-3.6/3.7  composition conflicts hard-block commissioning
//   FR-21.1     an SEU exposes one effective Governance Model derived from its EBM
//   §4.3 / Q#3  Quality Gates can gate Pack/Objective (seu_id nullable + CHECK)
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { getEffectiveGovernanceModel } from "../src/routes/seu/core/governanceModel.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective, submitObjective, transitionObjective } from "../src/routes/seu/core/objectives.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { qualityGateEvaluationsDB } from "../src/dblayer/qualityGateEvaluationsDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { ensureWebAppTemplateFixture, uniqueTestPackVersion, commissionFromFormSync, driveCommissioningToActive, ensureEventSubscriptionsLoaded, waitUntilAsync } from "./testFixtures.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import type { EventRow, SeuRow } from "../src/dblayer/seuTypes.js";

before(async () => {
  // Must run before this file's own first commissionSeu call — see
  // ensureEventSubscriptionsLoaded's own header comment (testFixtures.ts).
  await ensureEventSubscriptionsLoaded();
});

test("FR-3.3: a commissioned SEU's Engineering Behavior Model is versioned (version 1 for the first)", async () => {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync({ statement: `ebm-version-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"], actorRole: "super", actorId: "1001", requestedBy: 1001 });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const { data: seu } = await seusDB.findById(result.seu.id);
  const { data: ebm } = await ebmsDB.findById(seu!.active_ebm_id!);
  // design/mvp-build-plan/SEU Composition.md — EBM versioning is deferred to
  // a later, execution-time recomposition pass (owner: "did i not say
  // version is not part of validation" / "we have not reached there yet").
  // Validate/Activate both update this SAME ebms row's status in place
  // (Composed -> Validated -> Active); no new row is ever created in this
  // pass, so the first (and only) EBM for a fresh commission stays version 1.
  assert.equal(ebm?.version, 1, "the active EBM is still version 1 — Validate/Activate update the same row in place");
});

test("FR-21.1: an SEU exposes one effective Governance Model derived from its EBM (authority rules, policies, quality gates)", async () => {
  // CR-087 — pinned to the fixture Template directly (commissionSeu, not
  // commissionFromForm's own auto-matching): test-enterprise-web-application
  // gained a 4th required capability (requirements-validation, CR-087 Step
  // 2d) alongside every other seeded Template, which the "smallest
  // satisfying candidate wins" selection in findCandidateTemplates is
  // sensitive to — a different Template being picked broke this test's own
  // assumptions about exactly which Packs get composed.
  const { template: fixtureTemplate } = await ensureWebAppTemplateFixture();
  const { data: profile } = await profilesDB.upsert({ code: `gov-model-profile-${randomUUID()}`, name: "Gov Model Profile", baseTemplateId: fixtureTemplate.id, environment: "development" });
  const { objective: govRoot } = await createObjective({ statement: `gov-model-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `gov-model-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"], tier: "Engineering", parentObjectiveId: govRoot.id, requestedBy: 1001, status: "Proposed" });
  await submitObjective(objective.id, 1001);
  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(activated.ok, true);

  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [fixtureTemplate.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001", requestedBy: 1001 });
  assert.equal(requested.ok, true, !requested.ok ? `commissioning failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");
  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");

  const model = await getEffectiveGovernanceModel(result.seu.id);
  assert.ok(model, "expected an effective governance model");
  // See FR-3.3 above — EBM versioning is deferred; the active EBM stays version 1.
  assert.equal(model!.ebm.version, 1);
  // "development" (openup-development.pack.json) is the fixture's own
  // mandatory Pack contributing software-construction — no Pack anywhere in
  // this codebase has "software-construction" as its own top-level code.
  assert.ok(model!.ebm.composedPacks.some((p) => p.packCode === "development"), "the EBM's composed packs are listed");
  assert.ok(model!.authorityRules.some((r) => r.governedTransition === "deliverable.transition"), "authority rules derived from composed packs");
  assert.ok(model!.qualityGates.length >= 1, "quality gates derived from composed packs");
  assert.ok(model!.authorityRules.every((r) => typeof r.fromPack === "string"), "each rule records the contributing pack (traceable)");
});

test("FR-3.6/3.7: a composition conflict hard-blocks commissioning; the SEU never reaches Operational", async () => {
  const run = randomUUID().slice(0, 8);
  const codeA = "conflict-a";
  const codeB = "conflict-b";
  // Two packs contributing authority rules for the SAME governedTransition with DIFFERENT roles.
  const packA = { code: codeA, name: "Conflict A", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: { authorityRules: [{ code: `auth-a-${run}`, governedTransition: `x.transition.${run}`, authorisedRole: "general" }] } };
  const packB = { code: codeB, name: "Conflict B", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional",
    contributions: { authorityRules: [{ code: `auth-b-${run}`, governedTransition: `x.transition.${run}`, authorisedRole: "super" }] } };
  const pubA = await publishPack({ seed: packA as any, actorRole: "super", actorId: "1001", activate: true });
  const pubB = await publishPack({ seed: packB as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(pubA.ok && pubB.ok, "both packs publish");

  // A template that composes BOTH conflicting packs.
  const { data: template } = await templatesDB.upsert({ code: `conflict-tpl-${run}`, name: "Conflict Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [packA.code, packB.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);
  const { data: profile } = await profilesDB.upsert({ code: `conflict-prof-${run}`, name: "Conflict Profile", baseTemplateId: template!.id, environment: "development" });
  // CR-009: Engineering Objectives need a Strategic parent (only Strategic may be a root).
  // CR-075 — createObjective now requires the parent to be Proposed when adding a child under it.
  const { objective: conflictRoot } = await createObjective({ statement: `conflict-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed",});
  const { objective } = await createObjective({ statement: `conflict-obj-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: conflictRoot.id, requestedBy: 1001,});

  // design/mvp-build-plan/SEU Composition.md — commissionSeu's own shallow
  // "Validate Request" gate no longer detects Pack-level conflicts (that's
  // Compose EBM's job now, run by the EBM Composer off CommissionValidated);
  // Template/Profile/Pack existence and liveness are all genuinely fine
  // here, so the shallow gate passes. The conflict is only found once
  // driveCommissioningToActive runs the deep unravel/detectCompositionConflicts
  // pass — detectCompositionConflicts aggregates each Pack's own Authority
  // Rules per governedTransition first, so this is still a real, genuine
  // cross-Pack role-SET disagreement (general vs super), not a false
  // positive from Pack A's/B's own internal multiplicity.
  const requested = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(requested.ok, true, !requested.ok ? `Validate Request failed: ${requested.reason}` : undefined);
  if (!requested.ok) throw new Error("unreachable");

  const result = await driveCommissioningToActive({ seuId: requested.seu.id, actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, false, "Compose EBM must be blocked by the conflict");
  if (!result.ok) {
    assert.equal(result.stage, "compose_ebm");
    // detectCompositionConflicts (profileCompositionUnravel.ts) names the
    // disagreeing property path, not a sentence containing the word
    // "conflict" — authorityRule::<governedTransition>[.<nested path>].
    assert.ok(result.reason.includes(`authorityRule::x.transition.${run}`), `the reason names the disagreeing property: ${result.reason}`);
    // Unlike a validate_request-stage failure, a Compose EBM conflict does
    // NOT transition the SEU to Failed — it's meant to be resolved
    // interactively by a human on the Compose EBM page (web/objectives.ts's
    // POST .../compose-ebm just re-renders with the conflict, it never
    // writes lifecycle_state). Only validateRequestHandler's shallow gate
    // ever reaches Failed (src/domain/engine/validateRequest.ts). The SEU
    // stays Pending, blocked from progressing until a human resolves it.
    const { data: blockedSeu } = await seusDB.findById(requested.seu.id);
    assert.equal(blockedSeu?.lifecycle_state, "Pending", "a Compose EBM conflict leaves the SEU Pending, awaiting human resolution — not a hard Failed");
  }
});

test("Retry after a failed commission: a Failed SEU does not permanently block its Objective (design/mvp-build-plan/SEU Composition.md)", async () => {
  const run = randomUUID().slice(0, 8);
  // A validate_request-stage failure (a since-Retired mandatory Pack) is
  // what actually reaches lifecycle_state "Failed" today — same pattern as
  // "Validate Request: a Template mandating a since-Retired Pack..." below.
  // A Compose EBM conflict does NOT (see FR-3.6/3.7 above — it leaves the
  // SEU Pending, awaiting human resolution), so it can't exercise this
  // test's own subject: does a real Failed SEU permanently block retry.
  const stalePack = { code: "retry-stale-pack-test", name: "Retry Stale Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  const published = await publishPack({ seed: stalePack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, "the stale Pack publishes and activates first");
  const { data: activePack } = await packsDB.findActiveByCode(stalePack.code);
  assert.ok(activePack, "sanity check: it really is Active before being retired");
  await packsDB.updateStatus(activePack!.id, "Retired");

  // A conflicting Template (mandates the now-Retired Pack) and a clean one
  // (mandates nothing) — same Objective is commissioned against the
  // conflicting one first, then retried against the clean one, to isolate
  // "does a prior Failed SEU block retry" from "did the second attempt
  // genuinely resolve anything" — it never had the stale reference to begin
  // with.
  const { data: conflictTemplate } = await templatesDB.upsert({ code: `retry-conflict-tpl-${run}`, name: "Retry Conflict Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(conflictTemplate!.id, [stalePack.code]);
  await templatesDB.setRequiredCapabilities(conflictTemplate!.id, []);
  const { data: conflictProfile } = await profilesDB.upsert({ code: `retry-conflict-prof-${run}`, name: "Retry Conflict Profile", baseTemplateId: conflictTemplate!.id, environment: "development" });

  const { data: cleanTemplate } = await templatesDB.upsert({ code: `retry-clean-tpl-${run}`, name: "Retry Clean Template", deliverableCatalogue: [] });
  await templatesDB.setRequiredCapabilities(cleanTemplate!.id, []);
  const { data: cleanProfile } = await profilesDB.upsert({ code: `retry-clean-prof-${run}`, name: "Retry Clean Profile", baseTemplateId: cleanTemplate!.id, environment: "development" });

  const { objective: retryRoot } = await createObjective({ statement: `retry-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `retry-obj-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: retryRoot.id, requestedBy: 1001 });

  const firstAttempt = await commissionSeu({ objectiveId: objective.id, templateIds: [conflictTemplate!.id], profileIds: [conflictProfile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(firstAttempt.ok, true, !firstAttempt.ok ? `SEU creation itself failed: ${firstAttempt.reason}` : undefined);
  if (!firstAttempt.ok) throw new Error("unreachable");

  // Validate Request runs asynchronously (validateRequestHandler, off
  // CommissionRequested) — poll for its real CommissionFailed outcome.
  // CR-104 — validateRequestHandler's own "stale reference" branch (the one
  // this scenario hits) publishes CommissionFailed BEFORE its own
  // seusDB.updateLifecycleState(seu.id, "Failed") call (validateRequest.ts)
  // — the opposite order from its "authority denied" branch just above it.
  // Polling only on the event (as this used to) can race ahead of the state
  // write and observe lifecycle_state still "Pending" right after seeing the
  // event. Wait for the state too, not just the event — same fix already
  // applied to driveCommissioningToActive's own SEUOperational wait.
  let firstFailedEvent: EventRow | undefined;
  let firstSeu: SeuRow | null | undefined;
  await waitUntilAsync(async () => {
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", firstAttempt.seu.id);
    firstFailedEvent = (events ?? []).find((e) => e.event_type === "CommissionFailed");
    if (!firstFailedEvent) return false;
    const { data: seu } = await seusDB.findById(firstAttempt.seu.id);
    firstSeu = seu;
    return seu?.lifecycle_state === "Failed";
  });
  assert.ok(firstFailedEvent, "a retired mandatory Pack must fail Validate Request");
  assert.equal(firstSeu?.lifecycle_state, "Failed");

  // The Objective must not be permanently stuck on this one Failed attempt —
  // migration 179's partial unique index (active states only) plus
  // seusDB.findByObjectiveId's own matching filter.
  const secondAttempt = await commissionSeu({ objectiveId: objective.id, templateIds: [cleanTemplate!.id], profileIds: [cleanProfile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(secondAttempt.ok, true, !secondAttempt.ok ? `retry blocked: ${secondAttempt.reason}` : undefined);
  if (!secondAttempt.ok) throw new Error("unreachable");
  assert.notEqual(secondAttempt.seu.id, firstAttempt.seu.id, "retry creates its own new SEU row — the Failed one is never reused or deleted");

  const secondResult = await driveCommissioningToActive({ seuId: secondAttempt.seu.id, actorRole: "super", actorId: "1001" });
  assert.equal(secondResult.ok, true, !secondResult.ok ? `retry's own Compose EBM failed: ${secondResult.reason}` : undefined);
  if (secondResult.ok) assert.equal(secondResult.seu.lifecycle_state, "Operational");

  // The first, failed SEU row is still there, untouched — audit/traceability
  // (owner: "delete a row will remove audit/traceability").
  const { data: firstSeuStillThere } = await seusDB.findById(firstAttempt.seu.id);
  assert.ok(firstSeuStillThere, "the Failed SEU row is never deleted");
  assert.equal(firstSeuStillThere?.lifecycle_state, "Failed");
});

test("Validate Request: a Template mandating a since-Retired Pack fails commissioning before Compose EBM ever runs (design/mvp-build-plan/SEU Composition.md)", async () => {
  const run = randomUUID().slice(0, 8);
  // Stable, pre-registered code (cleanSlate.ts's own CATEGORY_SCOPED_PACK_NAME_CONCEPTS,
  // organisation-name) — CR-079: a Pack's own `code` is checked against its
  // category's real Ontology vocabulary at publish time, so a random per-run
  // suffix here would fail validatePackSeed outright, same as it always would.
  const stalePack = { code: "stale-pack-test", name: "Stale Pack", category: "Organisation", packVersion: uniqueTestPackVersion(), installationClassification: "Optional", contributions: {} };
  const published = await publishPack({ seed: stalePack as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, "the stale Pack publishes and activates first");
  const { data: activePack } = await packsDB.findActiveByCode(stalePack.code);
  assert.ok(activePack, "sanity check: it really is Active before being retired");
  // A Profile/Template authored against this Pack while it was still live —
  // nothing re-checks that later (ontology.ts's assertCanonicalCategory is
  // write-path only), so retiring it afterwards leaves this Template's own
  // status untouched — exactly the "am I working off a current live
  // abstraction" gap Validate Request exists to close.
  await packsDB.updateStatus(activePack!.id, "Retired");

  const { data: template } = await templatesDB.upsert({ code: `stale-pack-tpl-${run}`, name: "Stale Pack Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [stalePack.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);
  const { data: profile } = await profilesDB.upsert({ code: `stale-pack-prof-${run}`, name: "Stale Pack Profile", baseTemplateId: template!.id, environment: "development" });
  const { objective: staleRoot } = await createObjective({ statement: `stale-pack-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 1001, status: "Proposed" });
  const { objective } = await createObjective({ statement: `stale-pack-obj-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: staleRoot.id, requestedBy: 1001 });

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — commissionSeu
  // itself only creates the SEU and publishes CommissionRequested now;
  // Validate Request (the actual liveness check this test is about) runs
  // asynchronously in validateRequestHandler, off that event. Poll for its
  // real, async CommissionFailed outcome instead of checking commissionSeu's
  // own synchronous return value.
  const result = await commissionSeu({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true, !result.ok ? `SEU creation itself failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");

  let failedEvent: EventRow | undefined;
  await waitUntilAsync(async () => {
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", result.seu.id);
    failedEvent = (events ?? []).find((e) => e.event_type === "CommissionFailed");
    return !!failedEvent;
  });
  assert.ok(failedEvent, "a retired mandatory Pack must fail Validate Request");
  const payload = failedEvent!.payload as { stage?: string; reason?: string; references?: string[] };
  assert.equal(payload.stage, "validate_request", "caught at the shallow gate, before Compose EBM ever runs");
  assert.ok(payload.references?.some((r) => r.includes(stalePack.code)), "the reason names the stale Pack code");

  const { data: seu } = await seusDB.findById(result.seu.id);
  assert.equal(seu?.lifecycle_state, "Failed");
  assert.equal(seu?.active_ebm_id, null, "Compose EBM never ran — no EBM was ever created for this attempt");
});

test("§4.3 / Open Q#3: a Quality Gate can gate a Pack transition with a null SEU; the CHECK rejects mis-scoped evaluations", async () => {
  const run = randomUUID().slice(0, 8);
  const { data: corePack } = await packsDB.findByCode("development");
  assert.ok(corePack);

  // A gate on a Pack transition (platform-level entity, no SEU). CR-058 —
  // (entity_type, from_state, to_state, category) is now the active-slot
  // uniqueness key, and a real "Exit"-category gate already occupies
  // Pack/Published/Active (qg-pack-a44355c1) — a run-scoped category keeps
  // this test's own fresh gate from colliding with it, same reason `code`
  // is already run-scoped.
  const { data: gate } = await qualityGatesDB.upsert({ code: `qg-pack-${run}`, name: "Pack publish gate", category: `test-${run}`, entityType: "Pack", fromState: "Published", toState: "Active", criteria: { type: "no_unresolved_obligations" }, originatingPackId: corePack.id });
  const evalResult = await qualityGateEngine.evaluate({ entityType: "Pack", entityId: corePack.id, seuId: null, fromState: "Published", toState: "Active" });
  assert.equal(evalResult.outcome, "Passed", "a Pack transition can be gated and evaluated with a null SEU");

  // The CHECK enforces the scope invariant (the DB layer surfaces the violation
  // as { error }, not a throw): a SEU-scoped entity may not have a null SEU...
  // CR-058 — evaluate()'s "Passed" outcome no longer carries a `gate` (a
  // transition may now have several active gates, one per category, so
  // "the" gate that passed isn't well-defined from the result alone); the
  // upsert's own return value is the real source for the gate's id here.
  const gateId = gate!.id;
  const badDeliverable = await qualityGateEvaluationsDB.create({ qualityGateId: gateId, seuId: null, entityType: "Deliverable", entityId: corePack.id, outcome: "Passed" });
  assert.ok(badDeliverable.error, "a Deliverable evaluation with a null SEU is rejected by the CHECK");
  // ...and a platform-level entity may not carry a SEU.
  const badPack = await qualityGateEvaluationsDB.create({ qualityGateId: gateId, seuId: corePack.id, entityType: "Pack", entityId: corePack.id, outcome: "Passed" });
  assert.ok(badPack.error, "a Pack evaluation carrying a SEU is rejected by the CHECK");
});
