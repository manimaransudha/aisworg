import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pool, { query } from "../src/utils/db.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { publishTemplate, PACK_SELECTION_SLOTS, advanceTemplateToActive } from "../src/routes/seu/core/templates.js";
import { transitionDeliverable, type TransitionDeliverableResult } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { seedAllTestFixturePacks } from "../src/dblayer/seed/seedTestFixturePacks.js";
import { BIRTH_STATE, getPlatformTenantId, getTesterId, INITIAL_VERSION, BABYLON_TENANT_NAME } from "../src/dblayer/constants.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { userDB } from "../src/dblayer/userDB.js";
import { commissionFromForm, validateEbm, validateSeu, initiateSeu, previewCommissioningValidation, attemptSeuCommenceWork } from "../src/routes/seu/core/commissioning.js";
import { publishProfile, type ProfileSeedInput } from "../src/routes/seu/core/profiles.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { transitionRequiresAttestation } from "../src/domain/engine/transitionEngine.js";
import type { ObjectiveRow, TransitionEntityType } from "../src/dblayer/seuTypes.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { lookupRouteAuthority } from "../src/domain/identity/routeAuthorityCache.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { requestCapabilityFulfilment } from "../src/routes/seu/core/capabilities.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../src/dblayer/capabilityFulfilmentsDB.js";
import type { CapabilityFulfilmentRow, ParticipantRow, SchemaDefinitionEntityKind } from "../src/dblayer/seuTypes.js";
import { publishAuthoringDraft, entityTypeForKind } from "../src/routes/seu/core/sdkAuthoring.js";
import { nextActionsFor, transitionEntity, publishTransition, type TransitionEntityResult } from "../src/domain/engine/entityTransition.js";
import { getEntityAdapter } from "../src/domain/engine/entityAdapters.js";
import { createEvidence } from "../src/routes/seu/core/evidence.js";
import { createReview } from "../src/routes/seu/core/reviews.js";
import { createFinding } from "../src/routes/seu/core/findings.js";
import { reviewsDB } from "../src/dblayer/reviewsDB.js";
import { getSeuCompetencyRequirements } from "../src/routes/seu/core/participantEligibility.js";
import { transitionObligation, createObligation, resolveSeuIdFromRelatedObject } from "../src/routes/seu/core/obligations.js";
import { policyDefinitionsDB } from "../src/dblayer/policyDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import type { CommandRow, DeliverableRow, EventRow, ObligationRow, ProfileRow, SeuLifecycleState, SeuRow, TemplateDeliverableSeed, TemplateDependencyGraphEntry, TemplateRow } from "../src/dblayer/seuTypes.js";
// get platform tenant id
export const PLATFORM_TENANT_ID = await getPlatformTenantId();
  
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

// seedAllTestFixturePacks checks for an existing Pack and then publishes, which is not atomic, so test files running in
// separate processes can both miss the check and collide on packs_code_version_tenant_key. Only this seed is serialised
// across processes, by a session-level Postgres advisory lock; the later holder finds every Pack already Active.
const TEST_FIXTURE_PACKS_LOCK_KEY = 7_310_046;
async function withSeedLock(seed: () => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [TEST_FIXTURE_PACKS_LOCK_KEY]);
    await seed();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [TEST_FIXTURE_PACKS_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

export function ensureTestFixturePacks(): Promise<void> {
  if (!testFixturePacksCached) testFixturePacksCached = withSeedLock(seedAllTestFixturePacks);
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
export const TESTER_ALL_ID = await getTesterId("tester-all@test.local");
export const TESTER_CREATOR_ID = await getTesterId("tester-creator@test.local");
export const TESTER_APPROVER_ID = await getTesterId("tester-approver@test.local");

// userDB.getSuperuserId() — the one real, governed resolution of the
// SUPERUSER_EMAIL-provisioned "root" actor (participants_master id +
// authorBadge "root"), same mechanism every src/dblayer/seed/*.ts script
// already uses. The *AsRoot fixture helpers below author as this actor, not
// as TESTER_ALL_ID (a badge-holding tester, not root).
export const { userId: ROOT_USER_ID, actorId: ROOT_ACTOR_ID, actorBadge: ROOT_ACTOR_BADGE } = await userDB.getSuperuserId();

// CR-079's own permanent-concept pattern (conflict-a/conflict-b,
// test-enterprise-web-application) applied to a one-off test Pack that needs
// a real publish -> retire lifecycle: it can't reuse a shared test-fixture
// twin (seedAllTestFixturePacks) without retiring that twin out from under
// every other test that depends on it staying Active. Lazily,
// idempotently inserted — same self-healing idiom as ensureTestFixturePacks
// above — so these codes resolve against a DB that hasn't had a fresh
// clean-slate/seedOntologyConcepts run, not just after one.
let staleTestPackConceptsCached: Promise<void> | null = null;
const STALE_TEST_PACK_CONCEPTS: Array<{ code: string; label: string }> = [
  { code: "retry-stale-pack-test", label: "Test: Retry Stale Pack" },
  { code: "stale-pack-test", label: "Test: Stale Pack" },
];

export function ensureStaleTestPackConcepts(): Promise<void> {
  if (!staleTestPackConceptsCached) staleTestPackConceptsCached = (async () => {
    const { rows: existing } = await query<{ code: string }>(
      "SELECT code FROM ontology_concepts WHERE concept_type = 'organisation-name' AND code = ANY($1)",
      [STALE_TEST_PACK_CONCEPTS.map((c) => c.code)]
    );
    const existingCodes = new Set(existing.map((r) => r.code));
    const missing = STALE_TEST_PACK_CONCEPTS.filter((c) => !existingCodes.has(c.code));
    if (missing.length === 0) return;
    const { error } = await ontologyDB.bulkInsertConceptVersions(
      missing.map((c) => ({
        conceptType: "organisation-name", code: c.code, defaultLabel: c.label, description: null,
        tenantId: PLATFORM_TENANT_ID, isMandatory: null, textType: "markdown" as const, uiGrouping: null,
        authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
      }))
    );
    if (error) throw error;
  })();
  return staleTestPackConceptsCached;
}

// web-flow.e2e.test.ts's own cross-tenant Objective fixtures — genuinely
// scoped, non-root identities (seedIdentityBaseline.ts), one per real tenant,
// each holding every real objective_* noun_verb badge so those tests
// exercise the actual badge + tenant-reach gates instead of bypassing them
// via root. userId is the raw users.id (for the x-test-user-id dev-login
// shim / newSession); participantId is the participants_master id (for
// direct actorId/requestedBy core-function calls).
async function getTesterIdentity(email: string): Promise<{ userId: string; participantId: string }> {
  const user = await userDB.findByEmail(email);
  if (!user) throw new Error(`${email} not provisioned — is db:clean-slate seeded?`);
  const participantId = await getTesterId(email);
  return { userId: user.id, participantId };
}
export const TESTER_OBJECTIVE_ATHENS = await getTesterIdentity("tester-objective-athens@test.local");
export const TESTER_OBJECTIVE_BABYLON = await getTesterIdentity("tester-objective-babylon@test.local");

// Grants a badge directly onto a holder's own participants_master.authorised_badges
// row, at test-run time — not a seed-data change (seedIdentityBaseline.ts's
// fixtures stay scoped to what they're documented to hold; a test that drives
// a step outside that scope grants itself the one badge it needs, right
// before it needs it, same mechanism sdk-authoring.test.ts's own grant()
// helper already established). Idempotent — a holder who already has the
// badge is left untouched.
export async function grantBadge(participantId: string, badge: string): Promise<void> {
  const { data: master } = await participantsMasterDB.findById(participantId);
  if (!master) throw new Error(`grantBadge: no participants_master row ${participantId}`);
  if (master.authorised_badges.some((b) => b.badge === badge)) return;
  const { error } = await participantsMasterDB.setAuthorisedBadges(participantId, [...master.authorised_badges, { badge, effective_till: "9999-12-31", seu_ids: [] }]);
  if (error) throw error;
}

// Grants whatever badge(s) route_authority itself actually declares for this
// method+path (CR-110 — the one real source of a web route's required
// badge), instead of a literal badge string guessed at the call site. `path`
// is the full path routeAuthorityGate matches against (including /aisworg
// and the real param values, e.g. /aisworg/seu/objectives/<id>/commission).
export async function grantRouteBadges(participantId: string, method: string, path: string): Promise<void> {
  const found = lookupRouteAuthority(method, path);
  if (!found) throw new Error(`grantRouteBadges: no route_authority row for ${method} ${path}`);
  for (const badge of found.badges) await grantBadge(participantId, badge);
}

// Grants the badge a real transition_definitions row's own `verb` resolves
// to (transitionEngine's `${entityType.toLowerCase()}_${verb}` convention),
// instead of a literal badge string guessed at the call site. No-op for an
// ungoverned row (verb null) — there is no badge to grant.
export async function grantTransitionBadge(participantId: string, entityType: TransitionEntityType, fromState: string, toState: string): Promise<void> {
  const { data: definition } = await transitionDefinitionsDB.find(entityType, fromState, toState);
  if (!definition) throw new Error(`grantTransitionBadge: no transition_definitions row for ${entityType} ${fromState} -> ${toState}`);
  if (!definition.verb) return;
  await grantBadge(participantId, `${entityType.toLowerCase()}_${definition.verb}`);
}
// Holds objective_achieve only, deliberately NOT objective_propose — proves
// a real create/edit denial, not just a hidden button.
export const TESTER_OBJECTIVE_ACHIEVE_ONLY = await getTesterIdentity("tester-objective-achieve-only@test.local");
// tests/acceptance.e2e.test.ts's own full-journey actor — non-root,
// tenant-scoped, holds every real noun_verb badge (seedIdentityBaseline.ts's
// allNounVerbBadges()).
export const TESTER_ACCEPTANCE_JOURNEY = await getTesterIdentity("tester-acceptance-journey@test.local");

// Polls for the producing Command and its Work Item that the Execution Engine generates once a Deliverable is In
// Progress (CommandGenerated -> WorkItemGenerated -> Dispatch, all asynchronous consumers). It does not complete the
// Work Item, so a test can inspect it (execution context, dispatch_strategy, pool) or complete it with
// completeWorkItem, which records the reference and changes no state. commandsDB.findInFlight returns exactly one
// non-terminal Command per (entityType, entityId, fromState, toState), so the lookup is unambiguous. A Dispatched
// and a Deferred Command both leave a Work Item; a Failed Command leaves none.
export async function waitForDispatchedWorkItem(deliverableId: string, fromState: string, toState: string): Promise<{ command: CommandRow; workItem: import("../src/dblayer/seuTypes.js").WorkItemRow }> {
  console.log(`[waitForDispatchedWorkItem] stage 1: polling for Command ${deliverableId} ${fromState} -> ${toState} to reach Dispatched/Deferred`);
  let command: CommandRow | null = null;
  await waitUntilAsync(async () => {
    const { data } = await commandsDB.findInFlight("Deliverable", deliverableId, fromState, toState);
    command = data ?? null;
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

// The Execution Engine now governs a Deliverable Command and makes the transition itself (CR-121 third pass), so
// the request is synchronous: it returns the moved Deliverable, or the governance failure verbatim. A hop the
// engine already made on its own (the governed Defined -> In Progress kickoff) counts as done.
export async function transitionDeliverableSync(input: {
  deliverableId: string;
  targetState: string;
  actorId: string;
}): Promise<{ ok: true; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } } | Extract<TransitionDeliverableResult, { ok: false }>> {
  const { data: deliverableBefore } = await deliverablesDB.findById(input.deliverableId);
  const fromState = deliverableBefore!.lifecycle_state;
  // An acceptance transition mints an attestation for the requester, which needs the requester's participants row.
  const { data: hopDefinition } = await transitionDefinitionsDB.find("Deliverable", fromState, input.targetState);
  if (hopDefinition && (await transitionRequiresAttestation(hopDefinition))) await ensureActorParticipant(deliverableBefore!.seu_id, input.actorId);

  const requested = await transitionDeliverable({ ...input, requestedBy: input.actorId });
  if (!requested.ok) {
    const { data: current } = await deliverablesDB.findById(input.deliverableId);
    if ((requested.reason === "no_transition_definition" || requested.reason === "already_in_flight") && current?.lifecycle_state === input.targetState) {
      return { ok: true, deliverable: current, appliedTransition: { fromState, toState: input.targetState } };
    }
    return requested as Extract<TransitionDeliverableResult, { ok: false }>;
  }

  const { data: moved } = await deliverablesDB.findById(input.deliverableId);
  // DeliverableTransitioned is handled asynchronously (the governed-hop rescan and the production Command).
  await new Promise((resolve) => setTimeout(resolve, 250));
  await resolveDispatchRejectionObligations(moved!.seu_id);
  return { ok: true, deliverable: moved!, appliedTransition: { fromState, toState: input.targetState } };
}

// Produces a Deliverable the way the platform does: the Execution Engine moves it to In Progress and generates the
// producing Command, and the Participant completes that Command's Work Item with the reference. Completing the Work
// Item records the reference and changes no state. An approval needs this reference (the empty-centre check).
// Needs the producing Capability to be fulfilled before the Deliverable reaches In Progress, or by CapabilityFulfilled.
// Simulates a person clicking a transition button some time after the engine's own governed kickoff. If the engine
// has already made the hop by then, the click finds the Deliverable at the target state and counts as done.
export async function clickTransitionAfterLag(input: { deliverableId: string; targetState: string; actorId: string; lagMs?: number }): Promise<{ ok: true } | { ok: false; reason: string }> {
  await new Promise((resolve) => setTimeout(resolve, input.lagMs ?? 1500));
  const result = await transitionDeliverable({ deliverableId: input.deliverableId, targetState: input.targetState, actorId: input.actorId, requestedBy: input.actorId });
  if (result.ok) return { ok: true };
  const { data: current } = await deliverablesDB.findById(input.deliverableId);
  if ((result.reason === "no_transition_definition" || result.reason === "already_in_flight") && current?.lifecycle_state === input.targetState) return { ok: true };
  return { ok: false, reason: result.reason };
}

export async function produceDeliverable(deliverableId: string, actorId: string, reference: string | null = "vcs://test/produced@1"): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // the person's click lands after the engine's own kickoff
  const moved = await transitionDeliverableSync({ deliverableId, targetState: "In Progress", actorId });
  if (!moved.ok) throw new Error(`produceDeliverable: could not move ${deliverableId} to In Progress: ${JSON.stringify(moved)}`);
  const { workItem } = await waitForDispatchedWorkItem(deliverableId, "In Progress", "In Progress");
  const completed = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference });
  if (!completed.ok) throw new Error(`produceDeliverable: completing Work Item ${workItem.id} failed: ${JSON.stringify(completed)}`);
  return workItem.id;
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

// Each commissioning step took 4-5 s with ~6 SEUs active in parallel (EBMActivated -> SEUOperational reached 26 s).
const COMMISSIONING_WAIT_MS = 60000;

export async function driveCommissioningToActive(input: {
  seuId: string;
  actorId: string;
  // CR-104 — per-call override for the three internal waitUntilAsync polls
  // below, for callers that drive several full commissioning cycles in one
  // file (heavier than the "one SEU per test" norm this fixture was sized
  // for) and need more headroom under real concurrent suite load than the
  // shared default affords. Defaults to waitUntilAsync's own default when
  // omitted — COMMISSIONING_WAIT_MS, sized for several SEUs commissioning at once across parallel test files.
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
  // Deterministic alternative to beforeCommenceWork's race: the acting actor is deliberately NOT granted the SEU
  // Activated -> Operational badge up front, so the engine's own commence-work attempt (attemptSeuCommenceWork, off
  // SEUActivated) fails to resolve the badge (the throw is caught and logged by the event bus) and leaves the SEU at Activated. This callback runs once the SEU is Activated,
  // with the Deliverables and Capabilities already created and the engine's governed hops not yet made. The badge is
  // granted after it returns and commence-work is attempted again, as a human would.
  holdAtActivated?: (seuId: string) => Promise<void>;
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

  // finalizeCommissioning (commissioning.ts) runs these SEU hops as this actor, each gated by
  // the hop's own noun_verb badge — granted here, from the real transition rows, before the
  // first hop runs.
  for (const [from, to] of [["Validated", "Configured"], ["Configured", "Commissioned"], ["Commissioned", "Activated"]] as const) {
    await grantTransitionBadge(input.actorId, "SEU", from, to);
  }

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
  }, input.timeoutMs ?? COMMISSIONING_WAIT_MS);
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
  // compositionCompleted.ts's resolveAuthorParticipantId requires the
  // commissioning actor to already hold a SEU-scoped participants engagement
  // row — ensure it exists right before publishing, for whichever actor this
  // call is commissioning as (not just root).
  await ensureActorParticipant(input.seuId, input.actorId);
  await grantTransitionBadge(input.actorId, "EBM", BIRTH_STATE, "Composed");

  await eventBus.publish({
    eventType: "CompositionCompleted",
    originatingObjectType: "SEU",
    originatingObjectId: input.seuId,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    payload: { seuId: input.seuId, authorBadge: "root" },
    actorId: input.actorId,
    authorityBadge: "root",
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
  }, input.timeoutMs ?? COMMISSIONING_WAIT_MS);

  // TS narrows a `let` reassigned inside an async closure (the
  // waitUntilAsync callback above) to `never` at every read site after the
  // closure returns — a known compiler limitation, not an actual runtime
  // possibility. A local cast, same workaround `command` already uses above,
  // sidesteps it without weakening the real null check.
  const composedSeu = seuAfterCompose as SeuRow | null;
  if (!composedSeu?.active_ebm_id) {
    const payload = failedEvent?.payload as { conflicts?: string[]; reason?: string } | undefined;
    const reason = payload?.conflicts?.join(" | ") ?? payload?.reason ?? "Compose EBM did not complete in time";
    return { ok: false, stage: "compose_ebm", reason, seuId: input.seuId };
  }

  // design/mvp-build-plan/SEU Composition.md, 2026-09-07 — "Validate" and
  // "Activate" are two separate, independently human-triggered transitions
  // on the EBM (owner: "Validate and Activate are 2 separate events. I can
  // validate an EBM and not yet activate it"), same shape as the SEU detail
  // page's own real "Apply" form (detail.ejs).
  // This helper is the one place driving every governed hop below (Validate,
  // Activate, and the SEU's own Activated -> Operational hop executionEngine
  // Kickoff attempts once Active is reached) — it grants whatever badge each
  // real transition_definitions row's own `verb` requires itself, rather than
  // leaving every caller to guess and pre-grant badge names at the call site.
  await grantTransitionBadge(input.actorId, "EBM", "Composed", "Validated");
  const validateResult = await validateEbm({ ebmId: composedSeu.active_ebm_id, actorId: input.actorId });
  if (!validateResult.ok) {
    return { ok: false, stage: "validate_engineering_model", reason: validateResult.reason === "not_found" ? "EBM not found" : validateResult.detail, seuId: input.seuId };
  }

  await grantTransitionBadge(input.actorId, "EBM", "Validated", "Active");
  if (!input.holdAtActivated) await grantTransitionBadge(input.actorId, "SEU", "Activated", "Operational");
  const activateResult = await transitionAndPublish({ entityType: "EBM", entityId: composedSeu.active_ebm_id, targetState: "Active", actorId: input.actorId, seuId: input.seuId });
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
    }, input.timeoutMs ?? COMMISSIONING_WAIT_MS);
    console.log(`[driveCommissioningToActive] beforeCommenceWork firing seuId=${input.seuId} lifecycle_state=${(seu as SeuRow | null)?.lifecycle_state} at t=${Date.now()}`);
    await input.beforeCommenceWork(input.seuId);
    console.log(`[driveCommissioningToActive] beforeCommenceWork done seuId=${input.seuId} at t=${Date.now()}`);
  }

  if (input.holdAtActivated) {
    let activatedEvent: EventRow | undefined;
    await waitUntilAsync(async () => {
      const { data: events } = await eventsDB.findByOriginatingObject("SEU", input.seuId);
      activatedEvent = (events ?? []).find((e) => e.event_type === "SEUActivated");
      return !!activatedEvent;
    }, input.timeoutMs ?? COMMISSIONING_WAIT_MS);
    const activated = activatedEvent as EventRow | undefined;
    if (!activated) return { ok: false, stage: "activate", reason: "SEUActivated was not published in time", seuId: input.seuId };
    await input.holdAtActivated(input.seuId);
    await grantTransitionBadge(input.actorId, "SEU", "Activated", "Operational");
    await attemptSeuCommenceWork({ seuId: input.seuId, correlationId: activated.correlation_id, causationId: activated.id, actorId: input.actorId });
  }

  // CR-102 — Activate only publishes EBMActivated now; finalizeCommissioning
  // (Configured -> Commissioned -> Activated, Create Engineering Assets,
  // Activated -> Operational) runs asynchronously in ebmActivatedHandler, off
  // the bus, no longer inline inside the EBM transition's own return. Wait for the
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
  }, input.timeoutMs ?? COMMISSIONING_WAIT_MS);

  if (blockingObligation) {
    return { ok: false, stage: "blocked", reason: `blocked, Obligation raised: ${blockingObligation.title}`, seuId: input.seuId };
  }
  // Same async-closure narrowing workaround as composedSeu above.
  const resolvedSeu = finalSeu as SeuRow | null;
  if (!resolvedSeu || resolvedSeu.lifecycle_state !== "Operational") {
    const payload = activateFailedEvent?.payload as { reason?: string } | undefined;
    const reason = payload?.reason ?? `expected Operational after Activate, got ${resolvedSeu?.lifecycle_state ?? "SEU not found"}`;
    return { ok: false, stage: "activate", reason, seuId: input.seuId };
  }
  return { ok: true, seu: resolvedSeu };
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
    tenantId: seu.tenant_id ?? PLATFORM_TENANT_ID,
    type: "Human",
    displayName: `Test Fixture Participant ${randomUUID()}`,
    capabilities: capabilityCodes,
    competency: heldCompetency,
    userId: null,
  });
  if (error || !participant) throw error ?? new Error("ensureEligibleParticipant: failed to create participants_master row");
  return participant.id;
}

// Babylon AI-Native onboards no Participant that holds an engineering Capability, so a Capability required by an SEU
// commissioned there has an empty eligible pool and ends in CapabilityUnavailable. No Participant of any shared pool
// is ever toggled, so parallel test files cannot disturb each other. A test that later fulfils a Capability there
// with a fixture Participant releases it through deactivateParticipants when it finishes.
export async function getEmptyPoolTenantId(): Promise<string> {
  const { data: tenant } = await tenantsDB.findByName(BABYLON_TENANT_NAME);
  if (!tenant) throw new Error(`getEmptyPoolTenantId: tenant "${BABYLON_TENANT_NAME}" not found — is db:clean-slate seeded?`);
  return tenant.id;
}

export async function deactivateParticipants(participantMasterIds: string[]): Promise<void> {
  await query("UPDATE participants_master SET is_active = FALSE WHERE id = ANY($1::uuid[])", [participantMasterIds]);
}

// capability_fulfilments.author_id is a real Ch.13 participants(id) FK
// (schema recovery pass, capability_fulfilments_schema_recovery.sql) —
// fulfilCapability now resolves it via resolveAuthor(seuId, actorId), which
// needs a real participants_master row for the acting user_id AND a real
// participants row for that master inside this exact SEU. Root (user_id 1)
// already has the participants_master row (012_badge_model seeds its
// authorised_badges); this ensures the per-SEU participants row a test's
// root actor needs, then hands back the "1"/"root" pair every test call
// site can use directly instead of re-deriving this per test.
export async function ensureActorParticipant(seuId: string, actorId: string): Promise<void> {
  const { data: master, error: masterErr } = await participantsMasterDB.findById(actorId);
  if (masterErr || !master) throw masterErr ?? new Error(`ensureActorParticipant: no participants_master row for actor ${actorId} — is db:clean-slate seeded?`);
  const { data: existing } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (existing) return;
  const { error } = await participantsDB.create({ seuId, type: master.type, displayName: master.display_name, participantId: master.id });
  if (error) throw error;
}

async function ensureRootActorParticipant(seuId: string): Promise<void> {
  return ensureActorParticipant(seuId, ROOT_ACTOR_ID);
}

// resolveSystemActor (routes/seu/core/attentionItems.ts), used by Create
// Engineering Assets inside finalizeCommissioning, resolves its acting
// participant from the SEU's own requested_by column — whoever's HTTP
// session actually posted the commission, which is not necessarily any
// actorId a caller later drives further transitions as (a web-flow test may
// commission over a root-authenticated session while handing a separate,
// badge-holding actor's id to core-function calls downstream). Reads
// requested_by off the real row and ensures a participants row for THAT
// actor, instead of a caller guessing which identity it was.
export async function ensureSeuRequesterParticipant(seuId: string): Promise<void> {
  const { data: seu, error } = await seusDB.findById(seuId);
  if (error || !seu) throw error ?? new Error(`ensureSeuRequesterParticipant: SEU not found: ${seuId}`);
  if (!seu.requested_by) throw new Error(`ensureSeuRequesterParticipant: SEU ${seuId} has no requested_by`);
  await ensureActorParticipant(seuId, seu.requested_by);
}

// CapabilityRequested is consumed by a handler that fulfils in the background, so this requests and then waits
// until the Participant's active Capability Fulfilment exists.
export async function fulfilCapabilityAsRoot(input: {
  seuId: string;
  capabilityId: string;
  // Either an existing Participant, or the codes a fixture Participant is created with. The codes form creates it
  // only when the Capability is still Unfulfilled after the on-Ready request has settled, so it never joins that pool.
  participantMasterId?: string;
  capabilityCodes?: string[];
}): Promise<{ participant: ParticipantRow; fulfilment: CapabilityFulfilmentRow; seuCapabilityId: string }> {
  await ensureEventSubscriptionsLoaded();
  await ensureRootActorParticipant(input.seuId);
  // Commissioning requests fulfilment itself. Fulfilling by hand is needed only when that request ended unfulfilled.
  await settleCapabilityRequests(input.seuId, input.capabilityId);
  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(input.seuId);
  const seuCapability = (seuCapabilities ?? []).find((c) => c.capability_id === input.capabilityId);
  if (!seuCapability) throw new Error(`fulfilCapabilityAsRoot: capability ${input.capabilityId} is not required by SEU ${input.seuId}`);
  let participantMasterId = input.participantMasterId;
  if (seuCapability.status === "Unfulfilled") {
    if (!participantMasterId) {
      if (!input.capabilityCodes) throw new Error("fulfilCapabilityAsRoot: pass participantMasterId or capabilityCodes");
      participantMasterId = await ensureEligibleParticipant(input.seuId, input.capabilityCodes);
    }
    await requestCapabilityFulfilment({ seuId: input.seuId, capabilityId: input.capabilityId, participantMasterIds: [participantMasterId], actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
    await waitForCapabilityFulfilled(input.seuId, input.capabilityId);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    const { data: fulfilments } = await capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId(seuCapability.id);
    const own = (fulfilments ?? []);
    for (const fulfilment of own) {
      const { data: participant } = await participantsDB.findById(fulfilment.participant_id);
      if (participant && participant.participant_id === participantMasterId) return { participant, fulfilment, seuCapabilityId: seuCapability.id };
    }
    if (seuCapability.status === "Fulfilled" && own.length > 0) {
      const { data: participant } = await participantsDB.findById(own[0].participant_id);
      if (participant) return { participant, fulfilment: own[0], seuCapabilityId: seuCapability.id };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`fulfilCapabilityAsRoot: no active fulfilment for Capability ${input.capabilityId} of SEU ${input.seuId} after 10s`);
}

// Waits until no CapabilityRequested of this Capability is still waiting for its handler. Returns at once when none
// was ever published. A failed handler throws with its recorded error.
export async function settleCapabilityRequests(seuId: string, capabilityId: string): Promise<void> {
  for (let attempt = 0; attempt < 900; attempt++) {
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", seuId);
    const requests = (events ?? []).filter((e) => e.event_type === "CapabilityRequested" && (e.payload as { capabilityId?: string }).capabilityId === capabilityId);
    const failed = requests.find((e) => e.consumption_state?.capabilityRequested?.status === "failed");
    if (failed) throw new Error(`settleCapabilityRequests: CapabilityRequested ${failed.id} failed: ${(failed.consumption_state.capabilityRequested as { error?: string }).error}`);
    if (requests.every((e) => e.consumption_state?.capabilityRequested?.status === "consumed")) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`settleCapabilityRequests: a CapabilityRequested for Capability ${capabilityId} of SEU ${seuId} was not consumed after 90s`);
}

// Fulfilment runs in the CapabilityRequested handler after the request returns, so a test that requested it waits
// here until the handler has consumed the latest CapabilityRequested of that Capability, including the events the
// handler publishes. A failed handler throws with its recorded error.
export async function waitForCapabilityFulfilled(seuId: string, capabilityId: string): Promise<void> {
  const latestRequest = async () => {
    const { data: events } = await eventsDB.findByOriginatingObject("SEU", seuId);
    return (events ?? [])
      .filter((e) => e.event_type === "CapabilityRequested" && (e.payload as { capabilityId?: string }).capabilityId === capabilityId)
      .sort((x, y) => new Date(x.occurred_at).getTime() - new Date(y.occurred_at).getTime())
      .pop();
  };
  // An empty-named request fulfils the whole eligible pool, which accumulates fixture Participants across runs.
  for (let attempt = 0; attempt < 900; attempt++) {
    const request = await latestRequest();
    const consumption = request?.consumption_state?.capabilityRequested;
    if (consumption?.status === "failed") throw new Error(`waitForCapabilityFulfilled: CapabilityRequested ${request!.id} failed: ${(consumption as { error?: string }).error}`);
    if (consumption?.status === "consumed") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`waitForCapabilityFulfilled: no consumed CapabilityRequested for Capability ${capabilityId} of SEU ${seuId} after 90s`);
}

// evidence.author_id/author_badge (schema recovery pass, evidenceDB.ts) —
// createEvidence now resolves author_id via the same seuId+participants_master
// two-hop as fulfilCapability's author_id. Same root/"1" convention as above.
export async function createEvidenceAsRoot(
  input: Omit<Parameters<typeof createEvidence>[0], "actorId" | "authorBadge">
): ReturnType<typeof createEvidence> {
  await ensureRootActorParticipant(input.seuId);
  return createEvidence({ ...input, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
}

// A Knowledge Item references supporting Evidence on save (CR-132): collects one Evidence item on the Deliverable and
// returns the reference to pass as evidenceReferences.
export async function supportingEvidenceReferences(seuId: string, deliverableId: string): Promise<{ supports: string[] }> {
  const evidence = await createEvidenceAsRoot({ seuId, relatedObjectType: "Deliverable", relatedObjectId: deliverableId, category: "Analytical Evidence", title: `Knowledge support ${randomUUID()}` });
  return { supports: [evidence.id] };
}

// reviews.author_id/author_badge (schema recovery pass, reviewsDB.ts) — same
// root/"1" convention as createEvidenceAsRoot above.
export async function createReviewAsRoot(
  input: Omit<Parameters<typeof createReview>[0], "actorId">
): ReturnType<typeof createReview> {
  await ensureRootActorParticipant(input.seuId);
  return createReview({ ...input, actorId: ROOT_ACTOR_ID });
}

// findings.author_id/author_badge (schema recovery pass, findingsDB.ts) —
// same root/"1" convention as createReviewAsRoot above. createFinding has no
// seuId param of its own (it derives one internally from the Review), so
// this resolves the Review's seu_id first before ensuring root's participants
// row in it.
export async function createFindingAsRoot(
  input: Omit<Parameters<typeof createFinding>[0], "actorId">
): ReturnType<typeof createFinding> {
  const { data: review } = await reviewsDB.findById(input.reviewId);
  if (!review) throw new Error(`review not found: ${input.reviewId}`);
  await ensureRootActorParticipant(review.seu_id);
  return createFinding({ ...input, actorId: ROOT_ACTOR_ID });
}

// obligations.author_id/author_badge (schema recovery pass, obligationsDB.ts)
// — same root/"1" convention as above. createObligation has no seuId param
// of its own (it derives one internally from relatedObjectType/relatedObjectId,
// resolveSeuIdFromRelatedObject), so this resolves the same way before
// ensuring root's participants row in it.
export async function createObligationAsRoot(
  input: Omit<Parameters<typeof createObligation>[0], "actorId" | "authorBadge">
): ReturnType<typeof createObligation> {
  const seuId = await resolveSeuIdFromRelatedObject(input.relatedObjectType, input.relatedObjectId);
  await ensureRootActorParticipant(seuId);
  return createObligation({ ...input, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
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
      const result = await transitionObligation({ obligationId: obligation.id, targetState, actorId });
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
      const result = await transitionAttentionItem({ attentionItemId: item.id, targetState, actorId });
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
  const { data: rootMaster, error: rootMasterErr } = await participantsMasterDB.findById(ROOT_ACTOR_ID);
  if (rootMasterErr || !rootMaster) throw rootMasterErr ?? new Error("ensurePolicyDefinitionWithObligation(): no participants_master row for the superuser — is db:clean-slate seeded?");
  const { data: birth } = await transitionDefinitionsDB.findBirth("Policy");
  if (!birth) throw new Error("ensurePolicyDefinitionWithObligation(): no birth Transition Definition for Policy");
  const { data: draft, error } = await policyDefinitionsDB.createDraft({ tenantId: PLATFORM_TENANT_ID,
    code: input.code,
    name: input.name,
    category: input.category,
    scope: "Transition",
    status: birth.to_state as never,
    authoredBy: rootMaster.id,
    authorBadge: "root",
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
export async function resolveDispatchRejectionObligations(seuId: string, actorId = ROOT_ACTOR_ID): Promise<void> {
  await ensureRootActorParticipant(seuId);
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
  return driveCommissioningToActive({ seuId: requested.seu.id, actorId: input.actorId, beforeCommenceWork });
}

let cached: Promise<{ template: TemplateRow; profile: ProfileRow }> | null = null;

export function ensureWebAppTemplateFixture(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  // Memoized per test process — repeat calls within the same file (or via
  // Promise identity across files that happen to share a process) don't
  // re-run the publish, but a second process (a separate `node --test` file
  // run) safely finds and reuses the same already-published rows.
  if (!cached) cached = seed();
  return cached;
}

// Polls findByCodeAndVersion until the row reaches Active or `timeoutMs`
// elapses — the losing side of the templates_code_version_tenant_key race
// (seed(), below) must wait out the winner's own Draft -> Validated ->
// Published -> Active walk (3 sequential DB writes in a concurrent
// process), not just wait for the row to exist.
async function waitForTemplateActive(code: string, templateVersion: string, tenantId: string, timeoutMs = 10_000): Promise<TemplateRow | null> {
  const deadline = Date.now() + timeoutMs;
  let last: TemplateRow | null = null;
  while (Date.now() < deadline) {
    const { data } = await templatesDB.findByCodeAndVersion(code, templateVersion, tenantId);
    last = data ?? null;
    if (last?.status === "Active") return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return last;
}

// Template.code is Ontology-governed (template-categories, schema-declared
// x-ontology-composable, migration 054) — "test-enterprise-web-application"
// is a real, permanent concept (ontologyConcepts.json), same treatment as
// cr104-demo-minimal: marked "(test fixture)", not a real business category.
// Published through the real, validated publishTemplate/publishProfile entry
// points (templates.ts/profiles.ts), exactly like seedSdlcStandardTemplates.ts
// seeds every real Standard Template — no raw upsert, no bypass of the
// Ontology/schema validation every other Template goes through.
const TERMINAL_TEMPLATE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

async function seed(): Promise<{ template: TemplateRow; profile: ProfileRow }> {
  const templateSeed = loadJson<TemplateSeed>("web-application.template.json");
  const profileSeed = loadJson<ProfileSeed>("default-development.profile.json");
  const templateVersion = INITIAL_VERSION;
  if (!templateSeed.purpose) throw new Error(`seed(): web-application.template.json is missing "purpose" (required by publishTemplate)`);

  const packSelections: Partial<Record<"compliancePackCodes" | "domainPackCodes" | "engineeringPackCodes" | "integrationPackCodes" | "organisationPackCodes" | "technologyPackCodes", string[]>> = {};
  for (const code of templateSeed.mandatoryPackCodes) {
    const { data: pack } = await packsDB.findByCode(code);
    if (!pack) throw new Error(`seed(): template ${templateSeed.code} requires unknown pack ${code} — is db:clean-slate seeded?`);
    const slot = PACK_SELECTION_SLOTS.find((s) => s.packCategory === pack.category);
    if (!slot) throw new Error(`seed(): template ${templateSeed.code}'s mandatory pack "${code}" has category "${pack.category}", which has no matching Template pack-selection slot`);
    const field = slot.field as keyof typeof packSelections;
    (packSelections[field] ??= []).push(code);
  }

  // Version Management: each version-hop transition bumps the row's version, so the
  // Active row no longer sits at the seed's starting version — look it up by code and
  // Active status first, then fall back to the starting version.
  let template = (await templatesDB.findActiveByCode(templateSeed.code, PLATFORM_TENANT_ID)).data
    ?? (await templatesDB.findByCodeAndVersion(templateSeed.code, templateVersion, PLATFORM_TENANT_ID)).data
    ?? null;
  if (!template) {
    const templateResult = await publishTemplate({
      seed: {
        code: templateSeed.code,
        name: templateSeed.name,
        templateVersion,
        deliverableCatalogue: templateSeed.deliverableCatalogue,
        dependencyGraph: templateSeed.dependencyGraph,
        purpose: templateSeed.purpose,
        tenantId: PLATFORM_TENANT_ID,
        ...packSelections,
      },
      actorId: ROOT_ACTOR_ID,
    });
    // publishTemplate's own idempotency (findByCodeAndVersion above, then
    // create) is find-then-create, not atomic — two `node --test` processes
    // racing seed() for the very first time can both miss the find and
    // collide on templates_code_version_tenant_key, same race already
    // handled below for publishProfile. Re-find instead of re-publishing:
    // the winner's row exists by now.
    if (!templateResult.ok && templateResult.errors.some((e) => e.includes("templates_code_version_tenant_key") || e.includes("already exists at version"))) {
      // The winner's row exists by now, but its own publishTemplate call is
      // still walking Draft -> Validated -> Published -> Active in its own
      // process (advanceTemplateToActive, templates.ts) — grabbing it the
      // instant it's findable can catch it mid-walk, still non-Active, which
      // the commissioning picker's own status='Active' filter then silently
      // excludes (picker test failures with no DB error at all). Poll for
      // Active instead of accepting the first non-null find.
      const existing = await waitForTemplateActive(templateSeed.code, templateVersion, PLATFORM_TENANT_ID);
      if (existing?.status === "Active") {
        template = existing;
      } else if (existing) {
        throw new Error(`seed(): template "${templateSeed.code}" exists but never reached Active (stuck at "${existing.status}") — the winning process's publishTemplate call may have failed partway through its Draft -> Active walk`);
      } else {
        throw new Error(`seed(): failed to publish template "${templateSeed.code}": ${templateResult.errors.join("; ")}`);
      }
    } else if (!templateResult.ok) {
      throw new Error(`seed(): failed to publish template "${templateSeed.code}": ${templateResult.errors.join("; ")}`);
    } else {
      const { data: published, error: publishedErr } = await templatesDB.findById(templateResult.templateId);
      if (publishedErr || !published) throw publishedErr ?? new Error(`template not found after publish: ${templateSeed.code}`);
      template = published;
    }
  }

  // Re-run of a long-lived, never-clean-slated DB: findByCodeAndVersion above
  // can hand back an already-existing row that isn't Active any more — a
  // later full-suite run elsewhere activated a newer patch of this same
  // (code, tenant) and superseded this 1.0.0 row to Deprecated (same
  // advanceTemplateToActive "Published -> Active supersedes the previous
  // holder" step, templates.ts), or it's still sitting mid-walk at
  // Draft/Validated/Published from a prior run that never finished. Neither
  // is "found" in any sense a caller expecting an Active Template can use —
  // self-heal here instead of handing back a non-Active row silently.
  if (template.status !== "Active") {
    // A Template past Active cannot be reactivated (CR-128 removed the reactivation rows). Run db:clean-slate.
    if (TERMINAL_TEMPLATE_STATES.has(template.status)) {
      throw new Error(`seed(): template "${templateSeed.code}" is "${template.status}" and cannot be reactivated — run db:clean-slate`);
    }
    // Parallel test processes share this (code, version) row: another one may have activated it since it was read.
    const { data: fresh } = await templatesDB.findById(template.id);
    if (fresh?.status === "Active") {
      template = fresh;
    } else {
      const advanced = await advanceTemplateToActive(fresh ?? template, ROOT_ACTOR_ID);
      if (advanced.ok) {
        template = advanced.template;
      } else {
        const { data: settled } = await templatesDB.findById(template.id);
        if (settled?.status !== "Active") throw new Error(`seed(): could not advance template "${templateSeed.code}" past "${template.status}": ${advanced.errors.join("; ")}`);
        template = settled;
      }
    }
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
  const activeProfile = (await profilesDB.findActiveByCode(profileSeed.code, PLATFORM_TENANT_ID)).data ?? null;
  if (activeProfile) return { template, profile: activeProfile };
  const profileResult = await publishProfile({ seed: profileSeed, actorId: ROOT_ACTOR_ID });
  if (!profileResult.ok && profileResult.errors.some((e) => e.includes("profiles_code_version_tenant_key") || e.includes("already exists at version"))) {
    // Another `node --test` process won the publish race. Publish is not idempotent, so wait for the
    // winner's own walk to reach Active and use that row.
    const winner: { profile: ProfileRow | null } = { profile: null };
    await waitUntilAsync(async () => {
      winner.profile = (await profilesDB.findActiveByCode(profileSeed.code, PLATFORM_TENANT_ID)).data ?? null;
      return winner.profile !== null;
    });
    if (winner.profile) return { template, profile: winner.profile };
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
    authorId: corePack.authored_by,
    authorBadge: corePack.author_badge,
  });

  await qualityGatesDB.upsert({
    name: "Requires Accepted Evidence or Approved Decision",
    category: "Validation Evidence",
    entityType: "Deliverable",
    fromState: "Approved",
    toState: "Baselined",
    criteria: { type: "requires_accepted_evidence_or_approved_decision" },
    originatingPackId: corePack.id,
    authorId: corePack.authored_by,
    authorBadge: corePack.author_badge,
  });
}

// The id of the Active Platform Service Definition a seeded Service code names, for a Pack contributionServices[] entry.
export async function serviceDefinitionIdFor(code: string): Promise<string> {
  const { data, error } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(code, await getPlatformTenantId());
  if (error || !data) throw error ?? new Error(`no Active Service Definition "${code}" -- run db:clean-slate`);
  return data.id;
}

// publishAuthoringDraft advances one governed hop and refuses to choose where a state has two next steps. Validated has the
// forward hop and the reject hop, so a holder of both is moved on the hop that needs no comment, and the loop goes on.
export async function advanceAuthoringDraftToActive(kind: SchemaDefinitionEntityKind, id: string, actorId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const entityType = entityTypeForKind(kind);
  for (let i = 0; i < 10; i++) {
    const result = await publishAuthoringDraft({ kind, id, actorId });
    if (result.ok) {
      if (result.status === "Active") return { ok: true };
      continue;
    }
    if (!result.errors.some((e) => /more than one next step/.test(e))) return result;
    const adapter = getEntityAdapter(entityType);
    const row = await adapter.findById(id);
    if (!row) return { ok: false, errors: [`${kind} ${id} not found`] };
    const forward = (await nextActionsFor(entityType, adapter.getState(row), actorId)).filter((a) => !a.requiresComment);
    if (forward.length !== 1) return result;
    const moved = await transitionAndPublish({ entityType, entityId: id, targetState: forward[0].toState, actorId });
    if (!moved.ok) return { ok: false, errors: ["detail" in moved ? moved.detail : moved.reason] };
  }
  return { ok: false, errors: ["did not reach Active within 10 hops"] };
}

// An Objective is born into the initial state of its birth row. A test that needs an Active one walks it through the governed hop.
export async function createActiveObjective(input: Parameters<typeof createObjective>[0]): Promise<Awaited<ReturnType<typeof createObjective>>> {
  const created = await createObjective(input);
  const moved = await transitionAndPublish({ entityType: "Objective", entityId: created.objective.id, targetState: "Active", actorId: input.requestedBy });
  if (!moved.ok) throw new Error(`createActiveObjective: ${"detail" in moved ? moved.detail : moved.reason}`);
  return { ...created, objective: moved.row as ObjectiveRow };
}

// The old per-entity transition call, over the generic function, for tests written against it.
export async function transitionObjective(input: { objectiveId: string; targetState: string; actorId: string; comment?: string; supersedingObjectiveId?: string }) {
  const result = await transitionAndPublish({
    entityType: "Objective",
    entityId: input.objectiveId,
    targetState: input.targetState,
    actorId: input.actorId,
    context: { comment: input.comment, supersedingObjectiveId: input.supersedingObjectiveId },
  });
  return result.ok ? { ...result, objective: result.row as ObjectiveRow } : result;
}


// The new commissioning path for tests: Save (initiateSeu), then Validate (validateSeu), as the two buttons do. The SEU is
// Validated when this returns ok; a dead reference leaves it Failed.
export async function initiateAndValidateSeu(input: { objectiveId: string; profileId: string; actorId: string; tenantId?: string | null }): Promise<{ ok: true; seu: SeuRow } | { ok: false; stage: string; reason: string; seuId?: string }> {
  const initiated = await initiateSeu(input);
  if (!initiated.ok) return { ok: false, stage: "initiate_seu", reason: initiated.reason };
  const validated = await validateSeu({ seuId: initiated.seu.id, actorId: input.actorId });
  if (!validated.ok) return { ok: false, stage: "validate_request", reason: "detail" in validated ? validated.detail : validated.reason, seuId: initiated.seu.id };
  return { ok: true, seu: validated.seu };
}

// The starting state of an SEU: the to-state of its birth row.
export async function seuBirthState(): Promise<SeuLifecycleState> {
  const { data: birth } = await transitionDefinitionsDB.findBirth("SEU");
  if (!birth) throw new Error("no birth Transition Definition for SEU");
  return birth.to_state as SeuLifecycleState;
}

// Calls transitionEntity and publishes the returned event after a successful hop, as every production caller does.
export async function transitionAndPublish(input: Parameters<typeof transitionEntity>[0]): Promise<TransitionEntityResult> {
  const result = await transitionEntity(input);
  if (result.ok) await publishTransition(result);
  return result;
}
