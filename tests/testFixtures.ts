// Shared test-only fixture — NOT part of any production seed pipeline
// (cleanSlate.ts). Several tests were written against
// test-enterprise-web-application/test-profile-default-development, which
// used to be seeded ambiently by seedSeu.ts; that script is retired entirely now (owner,
// 2026-08-20: it left platform-core-engineering/technology-nodejs un-reset by
// every later db:clean-slate — "That is polluting the db") and
// db:clean-slate deliberately no longer recreates these two either way (the
// intended path post-reset is authoring through the SDK UI, not a pre-seeded
// demo — see Database Clean Slate — Instructions.md). That's the right call
// for the real database, but it left these tests depending on ambient state
// nothing guarantees anymore.
//
// Fix: reuse the exact original seed data (web-application.template.json /
// default-development.profile.json — still real files, just no longer
// referenced by any production script) via one idempotent, test-scoped
// helper, instead of each test file re-deriving its own throwaway Template
// and losing the specific shape (dependsOnCapabilityServiceCodes wiring,
// mandatoryPackCodes) some of these tests are specifically about. Safe to
// call from many test files/processes concurrently (upsert, not create) and
// safe to leave in place after a real db:clean-slate run — it recreates
// itself the next time tests run.
//
// 2026-08-25 (owner: "alter the test suites to use the seeded packs, not
// the legacy ones") — web-application.template.json's own mandatoryPackCodes
// no longer names platform-core-engineering/technology-nodejs (both
// confirmed permanently unpublishable — no working bootstrap path, and 69
// CRs of real design work since either was the source of truth). It named 3
// real, always-seeded OpenUP capability-pattern Packs instead — briefly.
//
// 2026-08-25, later same day — briefly moved onto test-only twins
// (test-requirements-analysis/test-architecture-solution-design/
// test-development, seedTestFixturePacks.ts / migration 119) after a live
// collision was found: tests/sdk-authoring.test.ts reused the literal code
// "software-construction" for its own throwaway authored-Pack tests, and since only
// one Pack version per code can be Active, every run of that file deprecated
// this fixture's real dependency out from under every other test file.
//
// 2026-08-25, reverted back to the real Pack codes same day — the twins
// introduced a worse, systemic problem: capabilities.code is Pack-scoped
// (CR-065), not globally unique, so having BOTH the real Pack and its twin
// simultaneously Active meant every capability code this fixture derives
// (requirements-analysis/architecture/development) now had TWO rows.
// capabilitiesDB.findByCodes (used by createObjective wherever
// requiredCapabilityCodes is passed — ~30 test files) has no Pack scoping at
// all, so it silently returned double the expected capabilities platform-
// wide the moment both Packs were Active together. Fixed properly instead:
// sdk-authoring.test.ts now mints its own randomized, per-run
// capability-name concept (registerTestOntologyCode) rather than reusing any
// shared identity, so this fixture no longer needs to avoid the real Packs
// at all — the original collision is solved at its actual source.
//
// 2026-08-29 (CR-079 bug fix) — sdk-authoring.test.ts's own randomized,
// per-run capability-name concept is gone too (registerTestOntologyCode
// removed entirely — see testFixtures.ts's own uniqueTestPackVersion note).
// It now uses a stable, migration-seeded engineering-name code
// ("test-sdk-pack", migration 134) instead, same as every other test file —
// the mechanism changed, but the principle the 2026-08-25 fix above
// established still holds: sdk-authoring.test.ts has its own distinct Pack
// identity, separate from this fixture's own real Pack dependencies, so
// there's still nothing for this fixture to avoid.
//
// 2026-08-27 — the fixture's OWN identity renamed: `enterprise-web-application`
// (web-application.template.json) collided with a REAL production Template,
// `enterprise-web-application-parent.template.json` (one of the 9 standard
// Templates, seedSdlcStandardTemplates.ts) — same code, different
// templateVersion, so templatesDB.upsert's own (code, template_version,
// tenant_id) ON CONFLICT never merged them; both rows coexisted, and
// templatesDB.findByCode's "most recent wins" resolution non-deterministically
// picked whichever was seeded last, silently handing several tests the real
// 9-deliverable Template instead of this fixture's own 3-deliverable one.
// Same collision class as the Pack-code/capability-code ones above, one layer
// up. Renamed to `test-enterprise-web-application` /
// `test-profile-default-development` — never touches templatesDB.upsert's
// Ontology validation (that only applies to the real authoring pipeline,
// createAuthoringDraft/publishAuthoringDraft — this fixture calls
// templatesDB.upsert directly), so no new Ontology concept was needed, unlike
// the Pack-code rename earlier.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { dependencyDefinitionsDB } from "../src/dblayer/dependencyDefinitionsDB.js";
import { materialiseDependencyGraph } from "../src/domain/engine/materialiseDependencyGraph.js";
import { deriveDedupedCapabilitiesFromPackCodes } from "../src/routes/seu/core/templates.js";
import { transitionDeliverable, type TransitionDeliverableResult } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { seedAllTestFixturePacks } from "../src/dblayer/seed/seedTestFixturePacks.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import { commissionFromForm, transitionEbm, previewCommissioningValidation } from "../src/routes/seu/core/commissioning.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import type { DeliverableRow, EventRow, ProfileRow, SeuRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry, TemplateRow } from "../src/dblayer/seuTypes.js";

// Test-only Pack twins (migration 119 / seedTestFixturePacks.ts) — every real
// seed Pack mirrored under a `test-` prefixed code. NOT used by
// ensureWebAppTemplateFixture/ensureCoreEngineeringQualityGates below any
// more (see this file's own header — reverted onto the real Packs, since
// duplicating their capability codes broke every non-Pack-scoped capability
// lookup platform-wide). Still real infrastructure for consumers that need
// "a real, resolvable Pack" without caring about specific capability content
// — e.g. pack-sdk.test.ts's dependency-resolution test,
// dependency-graph-relationship-kind.test.ts's engineeringPackCodes. Same
// memoized, idempotent, self-healing idiom as ensureWebAppTemplateFixture.
let testFixturePacksCached: Promise<void> | null = null;

export function ensureTestFixturePacks(): Promise<void> {
  if (!testFixturePacksCached) testFixturePacksCached = seedAllTestFixturePacks();
  return testFixturePacksCached;
}

// CR-046 (owner: "why are test scripts adding code that is not in the
// ontology??? I thought we fixed this" / "the test script should use a code
// present in the ontology") — Pack.code and Template.code (template-categories)
// are server-side Ontology-validated at publish time (validatePackSeed/
// validateTemplateSeed's own assertCanonicalCategory check).
//
// CR-079 bug fix — this used to be solved by minting a fresh, random-UUID-
// suffixed Ontology concept per test run (registerTestOntologyCode,
// removed). Owner: "the ontology was updated with what test fixture needs.
// This should be removed. The source of truth is what we fed through the
// migration files." That was exactly the "test litter" pollution CR-079
// fixed capability-name of in the first place — every one of those dynamic
// prefixes already had a stable, descriptive name (only the random suffix
// was ever the problem), so each is now a real, permanent concept seeded by
// migration 134 instead, under its own test's actual category — Packs never
// need to be registered as capability-name at all (a Pack is never itself a
// capability, CR-079). Per-run uniqueness moves to packVersion, the real
// axis Pack identity is scoped by (code, packVersion, tenant_id) — not code
// alone — so reusing the same stable code every run is safe as long as the
// version differs.
export function uniqueTestPackVersion(): string {
  return `${Date.now()}.${Math.floor(Math.random() * 1000000)}.0`;
}

// Companion to the above — a stable, reused test Pack code means "reactivate
// from a terminal state auto-bumps the patch version" tests can no longer
// assert a hardcoded literal (e.g. "1.0.1"): the base version is now
// unpredictable (uniqueTestPackVersion's own Date.now()-derived value), not
// always "1.0.0". Mirrors packsDB's own real patch-bump logic (increment the
// trailing segment) so the test computes the SAME expected value the app
// itself would produce, from whatever base version it actually used.
export function bumpPatch(version: string): string {
  const parts = version.split(".");
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  return parts.join(".");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "dblayer", "seed", "data");

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8")) as T;
}

interface TemplateSeed {
  code: string;
  name: string;
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
}

interface ProfileSeed {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  optionalPackCodes?: string[];
}

// CR-006 — the seeded fixture actors (seedIdentityBaseline). Holder ids are
// TEXT; these hold noun_verb grants so tests act as a non-root, badge-holding
// actor. tester-all authorises any transition; creator/approver are for
// separation-of-duties assertions.
export const TESTER_ALL_ID = "1001";
export const TESTER_CREATOR_ID = "1002";
export const TESTER_APPROVER_ID = "1003";

// Model A made transitionDeliverable async (Participant Integration Plan): a
// governed transition is *dispatched*, and the Deliverable only moves when a
// Participant reports a `done` result to the result-in callback. The many
// governance/telemetry/badge tests that are about the *outcome* of a
// transition (was it authorised? did the Quality Gate block? what's the cycle
// time?) — not about the async mechanics — drive the whole dispatch->complete
// round-trip in one call through this helper, which restores the old
// synchronous contract: it returns the moved Deliverable on success, or the
// governance failure verbatim (failures short-circuit before dispatch, so they
// never reach completion). Tests that assert the async mechanics themselves
// (command-pipeline, participant-lifecycle) call transitionDeliverable +
// completeWorkItem directly instead.
export async function transitionDeliverableSync(input: {
  deliverableId: string;
  targetState: string;
  actorRole?: string;
  actorId?: string;
  actingBadgeGrantId?: string;
  requestedBy?: number | null;
}): Promise<{ ok: true; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } } | Extract<TransitionDeliverableResult, { ok: false }>> {
  const dispatched = await transitionDeliverable({ ...input, actorId: input.actorId ?? TESTER_ALL_ID });
  if (!dispatched.ok) return dispatched;
  const completed = await completeWorkItem({
    workItemId: dispatched.workItemId,
    outcome: "done",
    reference: `vcs://test/${input.deliverableId}@${dispatched.pendingTransition.toState}`,
  });
  if (!completed.ok || completed.outcome !== "done") {
    throw new Error(`test transitionDeliverableSync: completion failed: ${completed.ok ? completed.outcome : completed.detail}`);
  }
  return { ok: true, deliverable: completed.deliverable, appliedTransition: completed.appliedTransition };
}

// design/mvp-build-plan/SEU Composition.md — commissionSeu now only gets
// through the shallow "Validate Request" gate; Compose EBM runs
// asynchronously off the CommissionValidated event it publishes (the EBM
// Composer, src/domain/engine/ebmComposer.ts), and reaching a real,
// Operational SEU needs two further, separate human actions (Validate,
// Activate) on top of that. Same idiom as transitionDeliverableSync above:
// most tests care about the OUTCOME of commissioning, not these new async/
// manual mechanics, so this drives the whole thing through in one call.
//
// Bug fix, found from a real test run (output.txt): this used to call
// ebmComposerHandler directly for "deterministic completion." That's wrong —
// CommissionValidated has a REAL subscription (eventSubscriptions.json,
// "ebmComposer"), so commissionSeu's own eventBus.publish call already
// dispatches the real handler in the background (fire-and-forget,
// eventBus.ts's own dispatch(...).catch(...), never awaited by publish()).
// Calling the handler again here ran it TWICE per commission — racing with
// the real dispatch, sometimes finishing after a test file's own
// after(() => pool.end()) already closed the pool ("Cannot use a pool after
// calling end on the pool", seen throughout output.txt). Same root cause
// tenant-contract.test.ts's own waitUntil comment already names: "dispatch
// is fire-and-forget... anything waiting on a handler's side effect must
// poll rather than assume it's done synchronously." Polling for the real
// dispatch's own result — never invoking the handler a second time — is the
// fix, matching that exact, already-established pattern.
export type DriveCommissioningResult = { ok: true; seu: SeuRow } | { ok: false; stage: string; reason: string; seuId?: string };

export async function waitUntilAsync(condition: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 25): Promise<void> {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) return; // let the caller's own check report the failure
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Bug fix, found from a real test run: "Compose EBM did not complete in
// time" on files that never call this. eventBus.loadSubscriptions() reads
// event_subscriptions into an in-memory map once per process
// (eventBus.ts) — until it's called, subscribersByEventType is empty, so
// commissionSeu's own eventBus.publish("CommissionValidated") finds zero
// handlers and never dispatches the real EBM Composer at all (not a race —
// it simply never runs). tenant-contract.test.ts happened to already call
// this itself; nothing else did. Must run before the FIRST commissionSeu/
// commissionFromForm call in a given test file — calling it only inside
// driveCommissioningToActive would be too late for that file's own first
// commission (the event is already published with zero handlers by then).
// Memoized like ensureTestFixturePacks above; safe/cheap to call repeatedly.
let subscriptionsLoaded: Promise<void> | null = null;
export function ensureEventSubscriptionsLoaded(): Promise<void> {
  if (!subscriptionsLoaded) subscriptionsLoaded = eventBus.loadSubscriptions();
  return subscriptionsLoaded;
}

export async function driveCommissioningToActive(input: { seuId: string; actorRole: string; actorId?: string }): Promise<DriveCommissioningResult> {
  await ensureEventSubscriptionsLoaded();

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — Validate Request
  // itself is now async too (validateRequestHandler, off CommissionRequested,
  // triggered by commissionSeu's own publish which already returned by the
  // time this runs) — this used to be a synchronous check because
  // commissionSeu published CommissionValidated inline before returning;
  // now it has to poll, same as the Compose EBM wait below.
  let requestValidatedOrFailed: EventRow | undefined;
  await waitUntilAsync(async () => {
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", input.seuId);
    requestValidatedOrFailed = (events ?? []).find((e) => e.event_type === "CommissionValidated" || e.event_type === "CommissionFailed");
    return !!requestValidatedOrFailed;
  });
  if (!requestValidatedOrFailed || requestValidatedOrFailed.event_type === "CommissionFailed") {
    const payload = requestValidatedOrFailed?.payload as { reason?: string; references?: string[] } | undefined;
    const reason = payload?.references?.length ? `${payload.reason}: ${payload.references.join("; ")}` : (payload?.reason ?? "no CommissionValidated event found for this SEU — validateRequestHandler must not have run (or failed)");
    return { ok: false, stage: "validate_request", reason, seuId: input.seuId };
  }

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — Compose EBM is a
  // manual transition now (owner: "handler have to check for the manual
  // transition definition"); ebmComposerHandler's own automatic subscription
  // to CommissionValidated is gone. Nothing runs Compose EBM unless a human
  // (or, here, this fixture) clicks it — mirrors the real "Compose" button's
  // own POST .../compose-ebm zero-conflict path (web/objectives.ts) exactly:
  // previewCommissioningValidation, setCompositionReport, and — since this
  // fixture's own callers always expect a clean commission, no conflicts —
  // publish CompositionCompleted directly, same as that route does.
  let seuForCompose: SeuRow | null = null;
  {
    const { data: seu } = await seusDB.findById(input.seuId);
    seuForCompose = seu ?? null;
  }
  if (!seuForCompose) return { ok: false, stage: "compose_ebm", reason: "SEU not found before Compose EBM", seuId: input.seuId };
  const composeViewerTenantId = seuForCompose.tenant_id ?? PLATFORM_TENANT_ID;
  const { compositionReport, composedPacks, profileDetails, unraveled, compositionConflicts } = await previewCommissioningValidation({
    selections: [{ templateId: seuForCompose.template_id, profileId: seuForCompose.profile_id }],
    viewerTenantId: composeViewerTenantId,
  });
  await seusDB.setCompositionReport(input.seuId, {
    selections: [{ templateId: seuForCompose.template_id, profileId: seuForCompose.profile_id }],
    compositionReport, composedPacks, profileDetails, unraveled, compositionConflicts, resolvedCompositionConflicts: {},
  });
  if (compositionConflicts.length > 0) {
    return { ok: false, stage: "compose_ebm", reason: compositionConflicts.map((c) => c.propertyName).join(" | "), seuId: input.seuId };
  }
  await eventBus.publish({
    eventType: "CompositionCompleted",
    originatingObjectType: "SEU",
    originatingObjectId: input.seuId,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { seuId: input.seuId },
    actorId: input.actorId ?? null,
  });

  // Wait for the REAL, already-dispatched compositionCompletedHandler to
  // finish — either the SEU picks up an active_ebm_id (success) or a
  // CommissionFailed event lands for it (an ebmsDB.create() error) — never
  // invoke the handler ourselves.
  let seuAfterCompose: SeuRow | null = null;
  let failedEvent: EventRow | undefined;
  await waitUntilAsync(async () => {
    const { data: seu } = await seusDB.findById(input.seuId);
    seuAfterCompose = seu ?? null;
    if (seu?.active_ebm_id) return true;
    const { data: eventsAfter } = await eventsDB.findByOriginatingObject("SEU", input.seuId);
    failedEvent = (eventsAfter ?? []).find((e) => e.event_type === "CommissionFailed");
    return !!failedEvent;
  });

  if (!seuAfterCompose?.active_ebm_id) {
    const payload = failedEvent?.payload as { conflicts?: string[]; reason?: string } | undefined;
    const reason = payload?.conflicts?.join(" | ") ?? payload?.reason ?? "Compose EBM did not complete in time";
    return { ok: false, stage: "compose_ebm", reason, seuId: input.seuId };
  }

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — "Validate" and
  // "Activate" are two separate, independently human-triggered transitions
  // on the EBM (owner: "Validate and Activate are 2 separate events. I can
  // validate an EBM and not yet activate it"), same shape as the SEU detail
  // page's own real "Apply" form (detail.ejs) — no async handler subscribed
  // to either event any more (ebmVersioningHandler/seuActivationHandler/
  // createEngineeringAssetsHandler deleted: "Subscription to an event and
  // manual trigger of transition definition are 2 different things"). Both
  // calls are synchronous now — transitionEbm's own Active branch runs
  // finalizeCommissioning inline (Configured -> Commissioned -> Activated,
  // Create Engineering Assets, Activated -> Operational), so its own return
  // value is the real, authoritative outcome — nothing left to poll for.
  const validateResult = await transitionEbm({ ebmId: seuAfterCompose.active_ebm_id, targetState: "Validated", actorRole: input.actorRole, actorId: input.actorId });
  if (!validateResult.ok) {
    return { ok: false, stage: "validate_engineering_model", reason: validateResult.reason === "not_found" ? "EBM not found" : validateResult.detail, seuId: input.seuId };
  }

  const activateResult = await transitionEbm({ ebmId: seuAfterCompose.active_ebm_id, targetState: "Active", actorRole: input.actorRole, actorId: input.actorId });
  if (!activateResult.ok) {
    return { ok: false, stage: "activate", reason: activateResult.reason === "not_found" ? "EBM not found" : activateResult.detail, seuId: input.seuId };
  }

  const { data: finalSeu } = await seusDB.findById(input.seuId);
  if (!finalSeu || finalSeu.lifecycle_state !== "Operational") {
    return { ok: false, stage: "activate", reason: `expected Operational after Activate, got ${finalSeu?.lifecycle_state ?? "SEU not found"}`, seuId: input.seuId };
  }
  return { ok: true, seu: finalSeu };
}

// Drop-in replacement for the old, fully-synchronous commissionFromForm
// contract — the ~25 test files that use it purely as a "get me a working
// SEU" fixture (not to test commissioning's own mechanics) should call this
// instead. commissionFromForm itself now only gets through the shallow gate
// (see its own header comment); this drives the rest through.
export async function commissionFromFormSync(input: Parameters<typeof commissionFromForm>[0]): Promise<DriveCommissioningResult> {
  await ensureEventSubscriptionsLoaded();
  const requested = await commissionFromForm(input);
  if (!requested.ok) return requested;
  return driveCommissioningToActive({ seuId: requested.seu.id, actorRole: input.actorRole, actorId: input.actorId });
}

let cached: Promise<{ template: TemplateRow; profile: ProfileRow }> | null = null;

export function ensureWebAppTemplateFixture(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  // Memoized per test process — repeat calls within the same file (or via
  // Promise identity across files that happen to share a process) don't
  // re-run the upserts, but a second process (a separate `node --test` file
  // run) safely re-upserts the same rows.
  if (!cached) cached = seed();
  return cached;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

// Real race found running the full suite: many test files (16+) call this
// fixture, each in its own `node --test` process, all against the same
// shared dev database. templatesDB.setRequiredCapabilities/setMandatoryPacks
// and profilesDB.setOptionalPacks each DELETE their junction rows then
// loop-INSERT fresh ones — not atomic — so two files' concurrent calls could
// interleave, and a *third* file's findCandidateTemplates could catch
// enterprise-web-application with its required_capabilities junction rows
// transiently empty (DELETE already ran, INSERTs hadn't yet), making it
// briefly fail to satisfy any request. Fixed by checking first: only write
// when the junction tables don't already hold the fixture's exact target
// data. After the very first successful seed anywhere against a given
// database, every other file's call becomes a pure read, no DELETE+INSERT
// race window left to hit.
async function seed(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  const templateSeed = loadJson<TemplateSeed>("web-application.template.json");
  const profileSeed = loadJson<ProfileSeed>("default-development.profile.json");

  const { data: template, error: templateErr } = await templatesDB.upsert({
    code: templateSeed.code,
    name: templateSeed.name,
    deliverableCatalogue: templateSeed.deliverableCatalogue,
  });
  if (templateErr || !template) throw templateErr ?? new Error(`template upsert failed: ${templateSeed.code}`);

  const { data: existingMandatory } = await templatesDB.getMandatoryPackCodes(template.id);
  if (!sameSet(existingMandatory ?? [], templateSeed.mandatoryPackCodes)) {
    await templatesDB.setMandatoryPacks(template.id, templateSeed.mandatoryPackCodes);
  }

  // CR-038 — requiredCapabilityCodes is derived from the real mandatory-Pack
  // selection now, same as the live authoring form and the SDLC seed script
  // both do, not read from the seed's own (now removed) hand-typed field.
  // 2026-08-25 — mandatoryPackCodes repointed from the dead
  // platform-core-engineering to 3 real, always-seeded OpenUP packs
  // (requirements-analysis/architecture-solution-design/development) —
  // briefly detoured onto their test-only twins the same day, then back (see
  // this file's own header: the twins duplicated these exact 3 capability
  // codes platform-wide, breaking capabilitiesDB.findByCodes wherever
  // requiredCapabilityCodes is used, well beyond this fixture). Resolves the
  // same 3 capability codes (and 28 other test files) already hardcoded —
  // requirements-analysis/architecture/development — rather than updating
  // every test file individually (owner's own call: fix the seed data, not
  // the tests, since Capability.code is free text with no Ontology
  // constraint blocking the rename). Reproduces the exact same 3 capability
  // codes core-engineering used to, just sourced from real Packs now.
  // Bug fix (owner: "fix the tests. Do not change the scenario") —
  // capability-name is a genuinely shared Ontology term multiple Packs can
  // each independently contribute (e.g. "requirements-analysis" from this
  // fixture's own Pack AND, separately, from integration-jira.pack.json —
  // real, deliberate, not a data bug). The previous fix here
  // (deriveCapabilityCodesFromPackCodes for codes, then a second, UNSCOPED
  // capabilitiesDB.findByCodes(codes) pass to get rows) reintroduced exactly
  // the ambiguity it meant to close — that second lookup sees every Pack
  // sharing the code, not just this fixture's own mandatoryPackCodes, so
  // which Pack's row (and which Pack's own Services) ends up as this
  // Template's "required capability" depended on query return order.
  // deriveDedupedCapabilitiesFromPackCodes (core/templates.ts's own
  // resolution, same one materialisePackSelectionsAndCapabilities uses) goes
  // straight from Pack codes to rows, scoped correctly the first time.
  const capabilities = await deriveDedupedCapabilitiesFromPackCodes(templateSeed.mandatoryPackCodes);
  const requiredCapabilityIds = capabilities.map((c) => c.id);

  const { data: existingRequired } = await templatesDB.getRequiredCapabilities(template.id);
  if (!sameSet((existingRequired ?? []).map((c) => c.id), requiredCapabilityIds)) {
    await templatesDB.setRequiredCapabilities(template.id, requiredCapabilityIds);
  }

  // CR-039/CR-041 — same guard as above: the seed's dependencyGraph never
  // changes across a run, so only materialise once (a non-empty result is
  // that "already holds the fixture's exact target data" state), avoiding
  // the same concurrent DELETE+INSERT race this file's own header warns
  // about (belt-and-braces alongside migration 075's real unique constraint).
  const { data: existingDependencyDefinitions } = await dependencyDefinitionsDB.findByOwner("Template", template.id);
  if (!existingDependencyDefinitions || existingDependencyDefinitions.length === 0) {
    await materialiseDependencyGraph({
      owningEntityType: "Template",
      owningEntityId: template.id,
      deliverableCatalogue: templateSeed.deliverableCatalogue,
      dependencyGraph: templateSeed.dependencyGraph ?? [],
      tenantId: PLATFORM_TENANT_ID,
    });
  }

  const { data: profile, error: profileErr } = await profilesDB.upsert({
    code: profileSeed.code,
    name: profileSeed.name,
    baseTemplateId: template.id,
    environment: profileSeed.environment,
  });
  if (profileErr || !profile) throw profileErr ?? new Error(`profile upsert failed: ${profileSeed.code}`);

  const { data: existingOptional } = await profilesDB.getOptionalPackCodes(profile.id);
  const targetOptional = profileSeed.optionalPackCodes ?? [];
  if (!sameSet(existingOptional ?? [], targetOptional)) {
    await profilesDB.setOptionalPacks(profile.id, targetOptional);
  }

  return { template, profile };
}

// CR-058 follow-up — same class of gap as the Template/Profile fixture
// above, discovered the same way: platform-core-engineering's own 2 real
// Quality Gates (core-engineering.pack.json's qualityGates[]) were never
// actually recreated by any working seed path, and that Pack itself has no
// working bootstrap path at all (its own seed script was retired;
// validatePackSeed's capability-name check permanently rejects its code
// being republished). Several tests implicitly assumed these 2 gates
// already existed. Owner: "that just simply means the test scripts have to
// be aligned to the changes we make every time" — idempotent, memoized per
// process, same discipline as ensureWebAppTemplateFixture above.
// 2026-08-25 — repointed off platform-core-engineering entirely (69 CRs of
// real design work later, it's not the source of truth — owner) onto
// `development` (openup-development.pack.json), a real, always-seeded Pack —
// briefly detoured onto `test-development` (the test-only twin) the same
// day, then back onto the real `development` again (see this file's own
// header — the twin caused a worse, systemic capability-code duplication
// bug; test-development is deliberately never published at all now). These
// 2 Quality Gates are directly created here, not published through the
// Pack's own seed JSON (development doesn't declare them) — this function
// only needs a real Pack id to attribute them to, same as before.
let coreGatesCached: Promise<void> | null = null;

export function ensureCoreEngineeringQualityGates(): Promise<void> {
  if (!coreGatesCached) coreGatesCached = seedCoreGates();
  return coreGatesCached;
}

async function seedCoreGates(): Promise<void> {
  const { data: corePack } = await packsDB.findByCode("development");
  if (!corePack) throw new Error("development pack not found — seed baseline is missing entirely, not just its Quality Gates");

  await qualityGatesDB.upsert({
    name: "No Unresolved Obligations",
    category: "Review Evidence",
    entityType: "Deliverable",
    fromState: "In Progress",
    toState: "Approved",
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: corePack.id,
  });

  await qualityGatesDB.upsert({
    name: "Requires Accepted Evidence or Approved Decision",
    category: "Validation Evidence",
    entityType: "Deliverable",
    fromState: "Approved",
    toState: "Baselined",
    criteria: { type: "requires_accepted_evidence_or_approved_decision" },
    originatingPackId: corePack.id,
  });
}
