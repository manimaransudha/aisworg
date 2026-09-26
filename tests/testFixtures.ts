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
import { randomUUID } from "node:crypto";
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
import { publishProfile, type ProfileSeedInput } from "../src/routes/seu/core/profiles.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { getSeuCompetencyRequirements } from "../src/routes/seu/core/participantEligibility.js";
import { transitionObligation } from "../src/routes/seu/core/obligations.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import type { CommandRow, DeliverableRow, EventRow, ObligationRow, ProfileRow, SeuRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry, TemplateRow } from "../src/dblayer/seuTypes.js";

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
  purpose?: string;
  mandatoryPackCodes: string[];
  deliverableCatalogue: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
}

type ProfileSeed = ProfileSeedInput;

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
// Rewritten for the event-driven Execution Engine pipeline (CommandGenerated
// -> WorkItemGenerated -> Dispatch, all async consumers now — see
// executionEngine.ts/dispatchEngine.ts's own header comments). transitionDeliverable
// itself only reports "governance cleared, Command requested" (fromState/
// toState) — it can no longer report workItemId/dispatched/participantId
// synchronously, since those facts don't exist yet when it returns. This
// polls for the real Command this call produced to reach Dispatched
// (commandsDB.findInFlight already returns exactly one non-terminal Command
// per (entityType, entityId, fromState, toState) — the duplicate-dispatch
// guard's own invariant makes this a safe, unambiguous lookup), then
// completes its Work Item the same way a Participant's real callback would.
// Lower-level than transitionDeliverableSync: requests the transition and
// polls for the real Command/Work Item the async pipeline produced, WITHOUT
// completing it — for tests that need to inspect the Work Item (execution
// context, dispatch_strategy, pool) before/instead of finishing it.
// Recognises both a successful dispatch (Dispatched) and a deferred one
// (Deferred, e.g. an empty eligible-Participant pool) — both leave a real
// Work Item behind; only a Failed (rejected) Command has none worth finding.
export async function waitForDispatchedWorkItem(deliverableId: string, fromState: string, toState: string): Promise<{ command: CommandRow; workItem: import("../src/dblayer/seuTypes.js").WorkItemRow }> {
  console.log(`[waitForDispatchedWorkItem] stage 1: polling for Command ${deliverableId} ${fromState} -> ${toState} to reach Dispatched/Deferred`);
  let command: CommandRow | null = null;
  await waitUntilAsync(async () => {
    const { data } = await commandsDB.findInFlight("Deliverable", deliverableId, fromState, toState);
    command = data;
    return data?.status === "Dispatched" || data?.status === "Deferred";
  });
  console.log(`[waitForDispatchedWorkItem] stage 1 result: command=${command ? `${(command as CommandRow).id} status=${(command as CommandRow).status}` : "null (not found / timed out)"}`);
  if (!command) throw new Error(`waitForDispatchedWorkItem: no Command reached Dispatched/Deferred for ${deliverableId} ${fromState} -> ${toState}`);

  // dispatchEngine.dispatch() writes the Command's own status to "Dispatched"
  // (dispatchEngine.ts:153) several awaited DB writes BEFORE it writes the
  // Work Item's own status to "Dispatched" too (dispatchEngine.ts:187) — a
  // real window where the Command already reads Dispatched but its Work Item
  // hasn't caught up yet. A Deferred Command never assigns a Participant at
  // all (dispatchEngine.ts's own Case 4), so its Work Item legitimately never
  // reaches "Dispatched" — only wait for that when the Command itself did.
  console.log(`[waitForDispatchedWorkItem] stage 2: polling for Work Item under Command ${(command as CommandRow).id}`);
  let workItem: import("../src/dblayer/seuTypes.js").WorkItemRow | undefined;
  await waitUntilAsync(async () => {
    const { data: workItems } = await workItemsDB.findByCommandIds([(command as CommandRow).id]);
    workItem = (workItems ?? [])[0];
    if ((command as CommandRow).status === "Deferred") return !!workItem;
    return workItem?.status === "Dispatched";
  });
  console.log(`[waitForDispatchedWorkItem] stage 2 result: workItem=${workItem ? `${workItem.id} status=${workItem.status}` : "undefined (not found / timed out)"}`);
  if (!workItem) throw new Error(`waitForDispatchedWorkItem: no Work Item found for Command ${(command as CommandRow).id}`);
  return { command: command as CommandRow, workItem };
}

export async function transitionDeliverableSync(input: {
  deliverableId: string;
  targetState: string;
  actorRole?: string;
  actorId?: string;
  actingBadgeType?: string;
  requestedBy?: number | null;
}): Promise<{ ok: true; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } } | Extract<TransitionDeliverableResult, { ok: false }>> {
  // Captured before the request, not read off its own ok:true result — so
  // this still has a real fromState even when deliverableKickoffHandler's
  // own automatic rescan (off SEUOperational) already has this exact hop in
  // flight and this call comes back already_in_flight instead of ok:true.
  const { data: deliverableBefore } = await deliverablesDB.findById(input.deliverableId);
  const fromState = deliverableBefore!.lifecycle_state;

  // already_in_flight only means SOME Command already exists for this hop —
  // not that it will reach Dispatched. The automatic rescan's own first
  // attempt reliably hits an empty eligible-Participant pool and goes
  // Failed (terminal), same as this file's own header comment already
  // covers — so "in flight" can resolve away with nothing dispatched. Retry
  // this exact request a few times: once the blocking Command leaves
  // Generated/Dispatched/Deferred without ever reaching Dispatched, this
  // hop is free again and a fresh request should succeed for real.
  let command: CommandRow | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const requested = await transitionDeliverable({ ...input, actorId: input.actorId ?? TESTER_ALL_ID });
    if (!requested.ok && requested.reason !== "already_in_flight") return requested;
    const waitingOnSomeoneElse = !requested.ok; // reason === "already_in_flight"

    command = null;
    await waitUntilAsync(async () => {
      const { data } = await commandsDB.findInFlight("Deliverable", input.deliverableId, fromState, input.targetState);
      command = data;
      if (data?.status === "Dispatched") return true;
      // Only bail early to retry when we know SOMEONE ELSE's Command is what
      // we're waiting on — it can resolve away (Failed) with nothing ever
      // dispatched. Never bail on our own freshly requested Command just
      // because it briefly reads null before CommandGenerated's own handler
      // has written the row yet — that's the normal, no-retry-needed path.
      return waitingOnSomeoneElse && data === null;
    });
    if ((command as CommandRow | null)?.status === "Dispatched") break;
    if (!waitingOnSomeoneElse) break;
  }
  if (!command || (command as CommandRow).status !== "Dispatched") {
    throw new Error(`test transitionDeliverableSync: Command for ${input.deliverableId} ${fromState} -> ${input.targetState} did not reach Dispatched in time (status: ${(command as CommandRow | null)?.status ?? "not found"})`);
  }
  // See waitForDispatchedWorkItem's own comment above: the Command's own
  // status reaches "Dispatched" several awaited writes before its Work
  // Item's own status does (dispatchEngine.ts:153 vs :187) — wait for the
  // Work Item itself, not just the Command, before handing it to completeWorkItem.
  let workItem: import("../src/dblayer/seuTypes.js").WorkItemRow | undefined;
  await waitUntilAsync(async () => {
    const { data: workItems } = await workItemsDB.findByCommandIds([(command as CommandRow).id]);
    workItem = (workItems ?? [])[0];
    return workItem?.status === "Dispatched";
  });
  if (!workItem) throw new Error(`test transitionDeliverableSync: no Work Item found for Command ${(command as CommandRow).id}`);

  const completed = await completeWorkItem({
    workItemId: workItem.id,
    outcome: "done",
    reference: `vcs://test/${input.deliverableId}@${input.targetState}`,
  });
  if (!completed.ok || completed.outcome !== "done") {
    throw new Error(`test transitionDeliverableSync: completion failed: ${completed.ok ? completed.outcome : completed.detail}`);
  }
  // completeWorkItem just published DeliverableTransitioned, fire-and-forget
  // — deliverableKickoffHandler (subscribed to it, same handler SEUOperational
  // uses) is about to unprompted-attempt whichever next hop this unblocked,
  // same race every earlier hop already ran. Give it a moment to actually
  // fire, then sweep whatever stray artifact it left, before this call hands
  // control back to the test's own next scenario step.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await resolveDispatchRejectionObligations(completed.deliverable.seu_id);
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

// CR-104 — 5000ms was marginal under real concurrent suite load (several
// test files each driving multiple full commissioning cycles against one
// shared, ever-growing dev database at once): a background handler
// (validateRequestHandler/compositionCompletedHandler/ebmActivatedHandler)
// occasionally didn't finish within the old window, producing a real, if
// spurious, "no CommissionValidated event found" failure. This only ever
// extends how long a genuinely slow/stuck case waits before reporting
// failure — a condition that resolves quickly still returns immediately,
// so this doesn't slow down any passing run.
export async function waitUntilAsync(condition: () => Promise<boolean>, timeoutMs = 15000, intervalMs = 25): Promise<void> {
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

export async function driveCommissioningToActive(input: {
  seuId: string;
  actorRole: string;
  actorId?: string;
  // CR-104 — per-call override for the three internal waitUntilAsync polls
  // below, for callers that drive several full commissioning cycles in one
  // file (heavier than the "one SEU per test" norm this fixture was sized
  // for) and need more headroom under real concurrent suite load than the
  // shared default affords. Defaults to waitUntilAsync's own default when
  // omitted — every existing caller is unaffected.
  timeoutMs?: number;
  // Called as soon as polling observes the SEU has reached "Activated" —
  // Create Engineering Assets (Ch.8 §12: Capabilities + Deliverables) has
  // already run by then, but the Execution Engine's own automatic
  // Activated -> Operational attempt (executionEngineKickoff, off the same
  // SEUActivated event this polls for) hasn't necessarily reached Dispatch
  // yet. Lets a caller fulfil the producing Capability here, before that
  // automatic attempt, so it dispatches for real instead of racing an
  // as-yet-unfulfilled Capability into a spurious empty_eligible_pool
  // Obligation (dispatchEngine.ts Case 1) that then pollutes every later
  // Obligation/Attention-Item count in the test. executionEngineKickoff is
  // itself fire-and-forget off SEUActivated, so this is still a race, just
  // entered from the winning side (this poll's own first check, synchronous
  // with no DB round trip of its own) instead of always losing it (the old
  // shape: fulfil only after already polling all the way to Operational).
  beforeCommenceWork?: (seuId: string) => Promise<void>;
}): Promise<DriveCommissioningResult> {
  await ensureEventSubscriptionsLoaded();
  // CR-104 — Quality Gates are now materialised onto the EBM once, at
  // creation (compositionCompleted.ts), from whichever Packs are actually
  // composed at that exact moment — not re-derived live on every later
  // transition attempt. ensureCoreEngineeringQualityGates() must therefore
  // run BEFORE the EBM this call is about to drive into existence, not
  // whenever a test happens to call it — some test files called it after
  // commissionFromFormSync, which was harmless under the old live-query
  // match but would now silently leave those 2 gates off the EBM entirely.
  // Idempotent + cached (coreGatesCached), so calling it unconditionally
  // here is free for every test that doesn't care about these gates.
  await ensureCoreEngineeringQualityGates();

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
  }, input.timeoutMs);
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
  }, input.timeoutMs);

  if (!seuAfterCompose?.active_ebm_id) {
    const payload = failedEvent?.payload as { conflicts?: string[]; reason?: string } | undefined;
    const reason = payload?.conflicts?.join(" | ") ?? payload?.reason ?? "Compose EBM did not complete in time";
    return { ok: false, stage: "compose_ebm", reason, seuId: input.seuId };
  }

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — "Validate" and
  // "Activate" are two separate, independently human-triggered transitions
  // on the EBM (owner: "Validate and Activate are 2 separate events. I can
  // validate an EBM and not yet activate it"), same shape as the SEU detail
  // page's own real "Apply" form (detail.ejs).
  const validateResult = await transitionEbm({ ebmId: seuAfterCompose.active_ebm_id, targetState: "Validated", actorRole: input.actorRole, actorId: input.actorId });
  if (!validateResult.ok) {
    return { ok: false, stage: "validate_engineering_model", reason: validateResult.reason === "not_found" ? "EBM not found" : validateResult.detail, seuId: input.seuId };
  }

  const activateResult = await transitionEbm({ ebmId: seuAfterCompose.active_ebm_id, targetState: "Active", actorRole: input.actorRole, actorId: input.actorId });
  if (!activateResult.ok) {
    return { ok: false, stage: "activate", reason: activateResult.reason === "not_found" ? "EBM not found" : activateResult.detail, seuId: input.seuId };
  }

  if (input.beforeCommenceWork) {
    // Poll for the SEU's own required-Capabilities rows (seuCapabilitiesDB),
    // not lifecycle_state — finalizeCommissioning writes those (Ch.8 §12
    // Create Engineering Assets) several awaited DB writes BEFORE it
    // publishes SEUActivated, the event executionEngineKickoff's own
    // automatic commence-work attempt is subscribed to. Racing lifecycle_state
    // == "Activated" itself lost every time under real suite load — that
    // state write and the SEUActivated publish are adjacent statements, no
    // real buffer between them. Capabilities existing has a real buffer
    // (Deliverable creation + CommissioningReport write still sit between it
    // and SEUActivated), so this actually wins the race instead of guessing.
    // Deliverables (with their own producing_capability_id already resolved)
    // are created a few statements AFTER seuCapabilitiesDB, still inside the
    // same finalizeCommissioning call, still well before SEUActivated —
    // waiting on capabilities alone let this hook fire before any caller
    // that looks the Capability up via the Deliverable (deliverablesDB.
    // findBySeuId, as badge-model.test.ts's own fulfilRequirementsAnalysis
    // does) had anything to find, so it silently fulfilled nothing.
    let seu: SeuRow | null = null;
    await waitUntilAsync(async () => {
      const { data: found } = await seusDB.findById(input.seuId);
      seu = found ?? null;
      if (seu?.lifecycle_state === "Failed") return true;
      const { data: deliverables } = await deliverablesDB.findBySeuId(input.seuId);
      return !!deliverables && deliverables.length > 0;
    }, input.timeoutMs);
    console.log(`[driveCommissioningToActive] beforeCommenceWork firing seuId=${input.seuId} lifecycle_state=${seu?.lifecycle_state} at t=${Date.now()}`);
    await input.beforeCommenceWork(input.seuId);
    console.log(`[driveCommissioningToActive] beforeCommenceWork done seuId=${input.seuId} at t=${Date.now()}`);
  }

  // CR-102 — Activate only publishes EBMActivated now; finalizeCommissioning
  // (Configured -> Commissioned -> Activated, Create Engineering Assets,
  // Activated -> Operational) runs asynchronously in ebmActivatedHandler, off
  // the bus, no longer inline inside transitionEbm's own return. Wait for the
  // REAL, already-dispatched handler to finish — same pattern as Compose
  // EBM's own wait above — never invoke it ourselves.
  // CR-104 — commissioning.ts's own finalizeCommissioning writes
  // seus.lifecycle_state = 'Operational' (updateLifecycleState) several
  // awaits before it publishes the real SEUOperational event
  // (setCommissioningReport, a findById reload, then eventBus.publish) — a
  // real, if narrow, window where lifecycle_state already reads Operational
  // but the event doesn't exist in the events table yet. A caller polling
  // only on lifecycle_state (as this used to) can race ahead of it and
  // declare success before SEUOperational is actually recorded — exactly
  // what seu-ebm-event-lifecycle-table.test.ts's own "DRIVEN" test caught.
  // Wait for the real event too, not just the state flip.
  let finalSeu: SeuRow | null = null;
  let activateFailedEvent: EventRow | undefined;
  let seuOperationalEvent: EventRow | undefined;
  let blockingObligation: ObligationRow | undefined;
  await waitUntilAsync(async () => {
    const { data: seu } = await seusDB.findById(input.seuId);
    finalSeu = seu ?? null;
    if (seu?.lifecycle_state === "Operational") {
      const { data: eventsAfter } = await eventsDB.findByOriginatingObject("SEU", input.seuId);
      seuOperationalEvent = (eventsAfter ?? []).find((e) => e.event_type === "SEUOperational");
      return !!seuOperationalEvent;
    }
    if (seu?.lifecycle_state === "Failed") {
      const { data: eventsAfter } = await eventsDB.findByOriginatingObject("SEU", input.seuId);
      activateFailedEvent = (eventsAfter ?? []).find((e) => e.event_type === "CommissionFailed" && (e.payload as { stage?: string } | null)?.stage === "finalize_commissioning");
      return true;
    }
    // CR-106 Option C — a Policy block at the SEU's own commence-work hop
    // leaves the SEU at "Activated" forever (never Operational, never
    // Failed — Chapter 8's own closed event vocabulary has no "blocked"
    // event, and once Activated, Chapter 2's own real transition table
    // names exactly one next event, SEUOperational; nothing invented in
    // between). The real, already-existing Obligation mechanism is the
    // actual signal: raiseObligationForBlockedTransition records
    // blocked_to_state on the Obligation it raises.
    if (seu?.lifecycle_state === "Activated") {
      const { data: obligations } = await obligationsDB.findByRelatedObject("SEU", input.seuId);
      blockingObligation = (obligations ?? []).find((o) => o.blocked_to_state === "Operational");
      return !!blockingObligation;
    }
    return false;
  }, input.timeoutMs);

  if (blockingObligation) {
    return { ok: false, stage: "blocked", reason: `blocked, Obligation raised: ${blockingObligation.title}`, seuId: input.seuId };
  }
  if (!finalSeu || finalSeu.lifecycle_state !== "Operational") {
    const payload = activateFailedEvent?.payload as { reason?: string } | undefined;
    const reason = payload?.reason ?? `expected Operational after Activate, got ${finalSeu?.lifecycle_state ?? "SEU not found"}`;
    return { ok: false, stage: "activate", reason, seuId: input.seuId };
  }
  return { ok: true, seu: finalSeu };
}

// Test-only fixture: a real participants_master row guaranteed eligible for
// the given Capability codes on this exact SEU, regardless of whichever
// shared, finite fixture pool (seedParticipantsMaster.ts) is doing under
// concurrent test load — no core eligibility logic is touched or relaxed;
// this participant genuinely satisfies findEligibleParticipants' own real
// checks (capabilities @> code, competency held for every required
// dimension) by construction. Reads the SEU's own real, already-materialised
// competencyRequirements (participantEligibility.ts, the same source
// findEligibleParticipants itself reads) and holds every one of their
// acceptable values, so matchesCompetency's `values.some(v => held.includes(v))`
// is trivially true for every dimension this SEU's own EBM actually requires.
export async function ensureEligibleParticipant(seuId: string, capabilityCodes: string[]): Promise<string> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) throw new Error(`ensureEligibleParticipant: SEU not found: ${seuId}`);
  const competencyRequirements = await getSeuCompetencyRequirements(seu);
  // getSeuCompetencyRequirements returns the REQUIRED shape (bare codes,
  // Record<string, string[]>) — participants_master.competency is now the
  // HELD shape (Record<string, {code, proficiency}[]>, this session's own
  // proficiency addition). "Expert" so this fixture participant definitely
  // qualifies for any Specialist-Preference-style Dispatch Strategy too.
  const heldCompetency: Record<string, Array<{ code: string; proficiency: string }>> = {};
  for (const [dimension, codes] of Object.entries(competencyRequirements)) {
    heldCompetency[dimension] = codes.map((code) => ({ code, proficiency: "Expert" }));
  }
  const { data: participant, error } = await participantsMasterDB.create({
    tenantId: seu.tenant_id,
    type: "Human",
    displayName: `Test Fixture Participant ${randomUUID()}`,
    capabilities: capabilityCodes,
    competency: heldCompetency,
  });
  if (error || !participant) throw error ?? new Error("ensureEligibleParticipant: failed to create participants_master row");
  return participant.id;
}

// This is a real, event-driven platform (pub/sub, not a linear call chain):
// deliverableKickoffHandler's own automatic rescan (off SEUOperational) and
// a test's own later fulfilCapability call are two independent chains with
// no ordering guarantee between them, and nothing ever retries a Case 1
// dispatch rejection (CapabilityFulfilled has zero subscribers) — so the
// automatic rescan reliably hits an empty eligible-Participant pool on the
// SEU's own head-of-chain Deliverable and raises a real, by-design
// Obligation + Attention Item (dispatchEngine.ts's own Case 1) before any
// test can possibly fulfil the Capability first. Not a bug, not a race to
// win — just a fact of this SEU's history a test must account for before
// asserting an exact Obligation count or an exact Quality Gate message.
// Walks any such stray, still-open Obligation on the given Deliverable to
// Verified (the same governed walk governance-depth.test.ts's own
// verifyObligation already uses), leaving only Obligations the test itself
// created.
async function resolveDispatchRejectionObligationsForDeliverable(deliverableId: string, actorId: string): Promise<void> {
  const { data: obligations } = await obligationsDB.findByRelatedObject("Deliverable", deliverableId);
  const strayObligations = (obligations ?? []).filter(
    (o) => o.status !== "Verified" && o.status !== "Closed" && /empty_eligible_pool/.test(o.title)
  );
  for (const obligation of strayObligations) {
    for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
      const result = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId });
      if (!result.ok) throw new Error(`resolveDispatchRejectionObligations: ${obligation.id} -> ${targetState} failed: ${JSON.stringify(result)}`);
    }
  }

  // dispatchEngine.ts's own Case 1 raises a matching "Action Required"
  // Attention Item alongside the Obligation above — dismiss that too, or it
  // sits in AM-002 dedup counts/titles this test never created.
  const { data: attentionItems } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", deliverableId);
  const strayAttentionItems = (attentionItems ?? []).filter((a) => /could not be dispatched/.test(a.title));
  for (const item of strayAttentionItems) {
    for (const targetState of ["Delivered", "Acknowledged", "In Progress", "Resolved", "Closed"]) {
      const result = await transitionAttentionItem({ attentionItemId: item.id, targetState, actorRole: "super", actorId });
      if (!result.ok) throw new Error(`resolveDispatchRejectionObligations: attention item ${item.id} -> ${targetState} failed: ${JSON.stringify(result)}`);
    }
  }
}

// Owner: "Why raise an obligation when a policy has none?" — settled:
// raiseObligationForBlockedTransition (core/obligations.ts) now raises
// nothing at all when the blocking Policy's own Definition declared no
// relatedObligations[]. Every test Policy created via a bare policiesDB.upsert
// call has no matching policy_definitions row at all (raiseObligationForBlockedTransition
// reads relatedObligations off policyDefinitionsDB.findActiveByCodeVisibleTo,
// a separate table from the materialized `policies` row), so it needs a real,
// Active Policy Definition alongside it to get a real Obligation raised.
// `code` must match the plain code of the materialized `policies` row a test
// separately creates via policiesDB.upsert (same code, no "::" suffix — an
// unfanned Policy resolves conditionIndex 0, so exactly one condition here).
export async function ensurePolicyDefinitionWithObligation(input: {
  code: string;
  name: string;
  category: string;
  title: string;
}): Promise<void> {
  const blankEvidence = { title: "", category: "", description: "", collectionMethod: "" };
  // CR-114 follow-on — policyDefinitionsDB.createDraft's schemaDefinitionId
  // is now mandatory.
  const { data: policySchema } = await schemaDefinitionsDB.findLatest("Policy");
  if (!policySchema) throw new Error("no schema_definitions grammar for Policy");
  const { data: draft, error } = await policyDefinitionsDB.createDraft({
    code: input.code,
    name: input.name,
    category: input.category,
    scope: "Transition",
    schemaDefinitionId: policySchema.id,
    conditions: [
      {
        statement: input.title,
        severity: "High",
        applicabilityDeliverables: [],
        requiredEvidence: blankEvidence,
        relatedObligations: [
          {
            category: "Compliance",
            title: input.title,
            description: input.title,
            origin: "Policies",
            priority: "Medium",
            severity: "High",
            completionCriteria: input.title,
            requiredEvidence: blankEvidence,
          },
        ],
        exceptionRules: [],
      },
    ],
  });
  if (error || !draft) throw error ?? new Error(`ensurePolicyDefinitionWithObligation: failed to create draft for ${input.code}`);
  await policyDefinitionsDB.updateStatus(draft.id, "Active");
}

// This is a real, event-driven platform: deliverableKickoffHandler re-fires
// on EVERY DeliverableTransitioned, not just SEUOperational (Ch.32/33's own
// "succession mechanism" — see eventSubscriptions.json's own description).
// So it isn't only the SEU's head-of-chain Deliverable that can race an
// unfulfilled Capability into a stray empty_eligible_pool Obligation before
// a test's own explicit call — any Deliverable the automatic rescan reaches
// right after a completed hop can too. Sweeps every Deliverable on the SEU,
// not just one — call this right before a test's own scenario-specific
// assertions (Obligation/Attention-Item counts, Quality Gate messages), and
// again after driving any hop whose own completion could unblock the next
// one the automatic rescan will immediately, unprompted, attempt.
export async function resolveDispatchRejectionObligations(seuId: string, actorId = "1001"): Promise<void> {
  const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);
  for (const deliverable of deliverables ?? []) {
    await resolveDispatchRejectionObligationsForDeliverable(deliverable.id, actorId);
  }
}

// Drop-in replacement for the old, fully-synchronous commissionFromForm
// contract — the ~25 test files that use it purely as a "get me a working
// SEU" fixture (not to test commissioning's own mechanics) should call this
// instead. commissionFromForm itself now only gets through the shallow gate
// (see its own header comment); this drives the rest through.
export async function commissionFromFormSync(
  input: Parameters<typeof commissionFromForm>[0],
  beforeCommenceWork?: (seuId: string) => Promise<void>
): Promise<DriveCommissioningResult> {
  await ensureEventSubscriptionsLoaded();
  const requested = await commissionFromForm(input);
  if (!requested.ok) return requested;
  return driveCommissioningToActive({ seuId: requested.seu.id, actorRole: input.actorRole, actorId: input.actorId, beforeCommenceWork });
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

  // design/design whiteboards.md/schema_implementation.md — templatesDB.upsert
  // above never writes draft_content, so `purpose` (schema-required since
  // migration 061) never lands on this fixture's row; inheritedTemplateContent
  // reads it straight off draft_content, so CR-026 inheritance off this
  // Template fails write-time validation without it. setDraftContent is the
  // real, validated write path — same fix as publishTemplate's own.
  if (!(template.draft_content as Record<string, unknown> | null)?.purpose && templateSeed.purpose) {
    const { error: purposeErr } = await templatesDB.setDraftContent(template.id, { purpose: templateSeed.purpose });
    if (purposeErr) throw purposeErr;
  }

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

  // Real authoring path (publishProfile), not a raw profilesDB.upsert — the
  // raw insert only ever wrote code/name/base_template_id/environment,
  // silently dropping every draft_content-only field (dispatchStrategyPreference,
  // redispatchMaxAttempts/redispatchAttentionThreshold, etc.) the seed JSON
  // declares. Idempotent (findByCodeAndVersion + materialiseProfileDraft on
  // an existing row), same as ensureWebAppTemplateFixture's own memoization —
  // code AND profileVersion both stay fixed (the seed JSON's own "1.0.0") so
  // every caller sharing this fixture (e.g. dependency-definition-engine.test.ts's
  // own profilesDB.findByCode("test-profile-default-development")) keeps
  // resolving the same stable, Active row all run. A per-process-unique
  // version was tried instead and reverted: publishProfile's own
  // Draft->...->Active walk auto-Deprecates whatever Profile previously held
  // Active for that code (profiles.ts's own supersede step), so every new
  // version minted mid-suite silently deprecated another file's already-in-
  // flight reference underneath it ("Profile ... status: Deprecated" /
  // "does not target any of the given Templates" failures, output.txt).
  //
  // publishProfile's own idempotency (findByCodeAndVersion then createDraft)
  // is find-then-create, not atomic — two `node --test` processes racing
  // seed() for the very first time can both miss the find and collide on
  // createDraft's (code, profile_version, tenant_id) unique constraint. Retry
  // once on exactly that: by the time the retry's own findByCodeAndVersion
  // runs, the winner's row exists, so this becomes the ordinary "already
  // exists" branch (materialiseProfileDraft on the existing row) instead of a
  // second create attempt.
  // design/design whiteboards.md/schema_implementation.md — createDraft's new
  // write-time validator (profileWriteValidator.ts) now runs its own
  // uniqueness SELECT before the INSERT, so the loser of the same race can
  // surface this clean "already exists" message instead of ever reaching the
  // raw profiles_code_version_tenant_key constraint — match both.
  let profileResult = await publishProfile({ seed: profileSeed, actorRole: "super", actorId: "1" });
  if (!profileResult.ok && profileResult.errors.some((e) => e.includes("profiles_code_version_tenant_key") || e.includes("already exists at version"))) {
    profileResult = await publishProfile({ seed: profileSeed, actorRole: "super", actorId: "1" });
  }
  if (!profileResult.ok) throw new Error(`profile publish failed: ${profileSeed.code}: ${profileResult.errors.join("; ")}`);
  const { data: profile, error: profileErr } = await profilesDB.findById(profileResult.profileId);
  if (profileErr || !profile) throw profileErr ?? new Error(`profile not found after publish: ${profileSeed.code}`);

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
