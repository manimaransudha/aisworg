// M5 — the MVP acceptance test: the full commissioning journey from the Build
// Plan §4 table, run through the core functions, plus the web form for Capability Fulfilment, against the real
// Express app (booted here on an ephemeral port, not the dev server) and a real Postgres database.
// Nothing in the engine/core/dblayer layers is mocked. Session auth is carried
// via fetch-cookie + tough-cookie, exactly like a real browser/API client
// would — NODE_ENV=test still leaves app.js's dev-mode auto-login middleware
// active (it's gated on NODE_ENV !== 'production', not on 'development'
// specifically), which is what lets this run unattended without a real OAuth
// or local-password login flow.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";

import pool from "../src/utils/db.js";
import app from "../src/app.js";
import { objectiveInitialState, createObjective } from "../src/routes/seu/core/objectives.js";
import { transitionEntity, publishTransition } from "../src/domain/engine/entityTransition.js";
import { getSeuStatus } from "../src/routes/seu/core/seus.js";
import { getSeuEvents } from "../src/routes/seu/core/events.js";
import { transitionDeliverable } from "../src/routes/seu/core/deliverables.js";
import { completeWorkItem } from "../src/routes/seu/core/workItems.js";
import { grantTransitionBadge, waitForCapabilityFulfilled, ensureWebAppTemplateFixture, driveCommissioningToActive, ensureEventSubscriptionsLoaded, ensureEligibleParticipant, ensureActorParticipant, grantRole, waitForDispatchedWorkItem, grantRouteBadges, countCapabilityRequests, deactivateParticipants, extractCsrf, TESTER_ACCEPTANCE_JOURNEY_BABYLON } from "./testFixtures.js";
import { initiateAndValidateSeu, PLATFORM_TENANT_ID } from "./testFixtures.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";

let server: ReturnType<typeof app.listen>;
let webBaseUrl: string;
// Node's own fetch/Response ambient types (no "DOM" lib configured) declare
// json()/text() as Promise<unknown> — every real caller here destructures
// real, known response shapes straight off it, so narrow to Promise<any> at
// the one boundary instead of casting at each call site.
interface FetchResponse extends Response {
  json(): Promise<any>;
  text(): Promise<string>;
}
let request: (input: string, init?: RequestInit) => Promise<FetchResponse>;

// Capability Fulfilment has no JSON API surface for a real participants_master
// Participant — only src/routes/seu/api/seus.ts's own ad-hoc {type,displayName}
// shape, which dispatchStrategies.ts's loadAvailableCandidates can never
// select (it requires a real participant_id master reference by design, not a
// bug — an ad-hoc Participant was never meant to be dispatchable). The web
// form route is the real, documented Capability Fulfilment path (Integration
// Test Handoff Brief.md) and already accepts participantMasterIds, so this
// one step goes through it instead of the JSON API.
// (owner: "root was used in legacy test suite as we did not build the
// demarcation between tenants etc.") — this file used the NODE_ENV=test
// auto-login shim's implicit root fallback (no x-test-user-id header sent),
// same as web-flow.e2e.test.ts did before that fix. root bypasses every
// badge/tenant check by design (CR-076's own requireBadge/requireTenantScope
// included), so a suite that only ever runs as root can't actually exercise
// those gates. TESTER_ACCEPTANCE_JOURNEY_BABYLON (testFixtures.ts,
// seedIdentityBaseline.ts) is a real, non-root, tenant-scoped seeded user who
// holds every real noun_verb badge (every verb this journey needs), so this
// journey now runs as a real, authorised identity instead of an implicit
// bypass.

before(async () => {
  // Must run before this file's own commission POST — see
  // ensureEventSubscriptionsLoaded's own header comment (testFixtures.ts).
  await ensureEventSubscriptionsLoaded();
  await ensureWebAppTemplateFixture();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  webBaseUrl = `http://127.0.0.1:${address.port}/aisworg/seu`;
  const jarFetch = fetchCookie(fetch, new CookieJar());
  request = (async (input: any, init?: any) =>
    jarFetch(input, { ...init, headers: { ...(init?.headers ?? {}), "x-test-user-id": TESTER_ACCEPTANCE_JOURNEY_BABYLON.userId } })) as unknown as typeof jarFetch;
});

// The fixture Participant is released when the file finishes, so Babylon's pool is empty again for the next run.
const fixtureParticipantMasterIds: string[] = [];
// The roles granted to the journey user for the web routes, put back when the file finishes.
const restoreRoles: Array<() => Promise<void>> = [];
after(async () => {
  for (const restore of restoreRoles) await restore();
  await deactivateParticipants(fixtureParticipantMasterIds);
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

test("MVP acceptance: commission an SEU through the core and web paths, reach Operational, fulfil a Capability, progress a Deliverable", async () => {
  // 0 — CR-009: an Engineering Objective needs a Strategic parent (only
  // Strategic may be a root). Create the root first. An Objective is born into
  // the initial state of its birth row, and a child can be added under it there.
  const actorId = TESTER_ACCEPTANCE_JOURNEY_BABYLON.participantId;
  const { objective: root } = await createObjective({
    statement: "Acceptance test: customer portal programme",
    requiredCapabilityCodes: ["requirements-analysis"],
    tier: "Strategic",
    requestedBy: actorId,
  });

  // 1 — create an Objective (Ch.1) — an Engineering leaf under the root
  const { objective, requiredCapabilities } = await createObjective({
    statement: "Acceptance test: stand up a customer web portal",
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    requestedBy: actorId,
  });
  assert.equal(requiredCapabilities.length, 3);

  // Commissioning needs an Active Objective: the leaf is activated through its governed hop.
  await grantTransitionBadge(actorId, "Objective", await objectiveInitialState(), "Active");
  const activated = await transitionEntity({ entityType: "Objective", entityId: objective.id, targetState: "Active", actorId });
  assert.equal(activated.ok, true, JSON.stringify(activated));
  if (activated.ok) await publishTransition(activated);

  // 2/3 — select a Template against the Objective's required Capabilities
  // (Ch.6 §11) and apply a Profile (Ch.7). There is no JSON API for either
  // step (core/profiles.ts's own createProfile/findOrCreateDefaultProfile
  // are retired — see the "API fulfil route commented out" precedent): the
  // real authoring path is publishTemplate/publishProfile, exercised once by
  // ensureWebAppTemplateFixture (testFixtures.ts, already run in before()),
  // same as web-flow.e2e.test.ts's own commissionSeu helper.
  const { template, profile } = await ensureWebAppTemplateFixture();

  // 4 — commission: Save (the birth row) and Validate, then the Composition Engine and the hops to Operational (Ch.8, Ch.37).
  // The API route POST /commission is commented out: an SEU is initiated only through the Save and Validate buttons.
  const commissioned = await initiateAndValidateSeu({ objectiveId: objective.id, profileId: profile.id, actorId: TESTER_ACCEPTANCE_JOURNEY_BABYLON.participantId, tenantId: PLATFORM_TENANT_ID });
  assert.equal(commissioned.ok, true, !commissioned.ok ? JSON.stringify(commissioned) : "assertion failed");
  if (!commissioned.ok) throw new Error("unreachable");
  const seuId = commissioned.seu.id;
  assert.equal(commissioned.seu.lifecycle_state, "Validated");
  const driven = await driveCommissioningToActive({ seuId, actorId: TESTER_ACCEPTANCE_JOURNEY_BABYLON.participantId });
  assert.equal(driven.ok, true, !driven.ok ? `commissioning failed: ${driven.reason}` : "assertion failed");
  assert.equal(driven.ok && driven.seu.lifecycle_state, "Operational");
  const { data: ebm } = driven.ok && driven.seu.active_ebm_id ? await ebmsDB.findById(driven.seu.active_ebm_id) : { data: null };
  assert.ok(ebm?.composed_packs.some((p) => p.packCode === "development"), "expected the fixture Template's own mandatory Pack to have been composed");

  const status = await getSeuStatus(seuId);
  assert.ok(status);
  assert.equal(status.seu.lifecycle_state, "Operational");
  assert.ok(status.deliverables.length >= 1, "expected the Template's Deliverable Catalogue to have been seeded at commissioning");

  const requirementsCapability = status.capabilities.find((c: { code: string }) => c.code === "requirements-analysis");
  assert.ok(requirementsCapability);
  assert.equal(requirementsCapability.status, "Unfulfilled");

  // 6 — assign a Participant to a Capability (Ch.12, direct assignment — no Dispatch Engine).
  // A real participants_master Participant, not an ad-hoc one (dispatchEngine's
  // loadAvailableCandidates requires a real master reference to ever select a
  // candidate) — via the web form route, the real documented Fulfilment path.
  const participantMasterId = await ensureEligibleParticipant(seuId, ["requirements-analysis"]);
  fixtureParticipantMasterIds.push(participantMasterId);
  // resolveAuthor (core/attentionItems.ts, reused by fulfilCapabilityWithParticipants)
  // needs a participants row for this actor's own participants_master id inside
  // this exact SEU — same requirement ensureRootActorParticipant exists to satisfy
  // for the root actor; TESTER_ACCEPTANCE_JOURNEY_BABYLON needs the same thing here.
  await ensureActorParticipant(seuId, TESTER_ACCEPTANCE_JOURNEY_BABYLON.participantId);
  // The web detail page and the fulfil form require the participant role (route_authority); the seeded user holds general only.
  restoreRoles.push(await grantRole(TESTER_ACCEPTANCE_JOURNEY_BABYLON.participantId, "participant"));
  await grantRouteBadges(TESTER_ACCEPTANCE_JOURNEY_BABYLON.participantId, "POST", `/aisworg/seu/seus/${seuId}/capabilities/${requirementsCapability.capabilityId}/fulfil`);
  const detailPage = await request(`${webBaseUrl}/seus/${seuId}`);
  assert.equal(detailPage.status, 200);
  const csrf = extractCsrf(await detailPage.text());
  const requestsBefore = await countCapabilityRequests(seuId, requirementsCapability.capabilityId);
  const fulfilParams = new URLSearchParams({ _csrf: csrf, participantMasterIds: participantMasterId });
  const fulfilRes = await request(`${webBaseUrl}/seus/${seuId}/capabilities/${requirementsCapability.capabilityId}/fulfil`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fulfilParams.toString(),
    redirect: "manual",
  });
  assert.equal(fulfilRes.status, 302, "the web fulfil form must redirect, success or error");
  await waitForCapabilityFulfilled(seuId, requirementsCapability.capabilityId, requestsBefore);

  const statusAfterFulfilBody = await getSeuStatus(seuId);
  assert.ok(statusAfterFulfilBody);
  const requirementsCapabilityAfterFulfil = statusAfterFulfilBody.capabilities.find((c: { code: string }) => c.code === "requirements-analysis");
  assert.ok(requirementsCapabilityAfterFulfil);
  assert.equal(requirementsCapabilityAfterFulfil.status, "Fulfilled", JSON.stringify(requirementsCapabilityAfterFulfil));

  // 7/8 — progress a Deliverable through its lifecycle (Ch.15/Ch.29), gated by dependency readiness + Authority/Policy
  const requirementsSpec = status.deliverables.find((d: { name: string }) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec, "expected the seeded 'Requirements Analysis Model' Deliverable");
  // The engine starts the first Deliverable off the kickoff, so this read may land before or after that hop.
  assert.ok(["Defined", "In Progress"].includes(requirementsSpec.lifecycleState), requirementsSpec.lifecycleState);

  const transitioned = await transitionDeliverable({ deliverableId: requirementsSpec.id, targetState: "In Progress", actorId, requestedBy: actorId });
  // Defined -> In Progress is a governed hop. The Execution Engine makes it off the kickoff, so this manual request
  // either makes it or finds the Deliverable already In Progress (no_transition_definition or already_in_flight). The producing
  // Command (In Progress -> In Progress) is then polled for.
  if (transitioned.ok) {
    assert.equal(transitioned.fromState, "Defined");
    assert.equal(transitioned.toState, "In Progress");
  } else {
    assert.ok(transitioned.reason === "no_transition_definition" || transitioned.reason === "already_in_flight", JSON.stringify(transitioned));
  }
  const { command: dispatchedCommand, workItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "In Progress", "In Progress");
  console.log("[DEBUG dispatched]", JSON.stringify({ commandId: dispatchedCommand.id, commandStatus: dispatchedCommand.status, workItemId: workItem.id, workItemStatus: workItem.status }));

  // The Participant reports the result, which drives the governed transition.
  const resulted = await completeWorkItem({ workItemId: workItem.id, outcome: "done", reference: "vcs://acceptance/req-spec@1" });
  console.log("[DEBUG result]", resulted.ok, JSON.stringify(resulted.ok ? resulted.outcome : resulted));
  assert.equal(resulted.ok, true, JSON.stringify(resulted));
  assert.ok(resulted.ok && resulted.outcome === "done");
  assert.equal(resulted.deliverable.lifecycle_state, "In Progress");

  // Result-in contract: the same Work Item is no longer outstanding, so a replayed result is rejected,
  // and an unknown Work Item is not found.
  const replayed = await completeWorkItem({ workItemId: workItem.id, outcome: "done" });
  assert.equal(replayed.ok, false, "a replayed result on a disposed Work Item must be a conflict, not a re-apply");
  assert.equal(!replayed.ok && replayed.reason, "not_outstanding");

  const unknown = await completeWorkItem({ workItemId: "00000000-0000-0000-0000-000000000000", outcome: "done" });
  assert.equal(unknown.ok, false);
  assert.equal(!unknown.ok && unknown.reason, "not_found");

  // Dependency gating is real, not decorative: the downstream Deliverable must
  // still be blocked, since its upstream dependency hasn't reached 'Approved' yet.
  const architectureDoc = status.deliverables.find((d: { name: string }) => d.name === "Architecture Decision Record");
  assert.ok(architectureDoc);
  const blocked = await transitionDeliverable({ deliverableId: architectureDoc.id, targetState: "In Progress", actorId, requestedBy: actorId });
  assert.equal(blocked.ok, false);
  assert.equal(!blocked.ok && blocked.reason, "dependency_not_satisfied");

  // Final assertion — the brief's own definition of "MVP done."
  const finalStatus = await getSeuStatus(seuId);
  assert.ok(finalStatus);
  assert.equal(finalStatus.seu.lifecycle_state, "Operational");
  assert.ok(finalStatus.capabilities.some((c: { status: string }) => c.status === "Fulfilled"), "expected at least one Capability Fulfilled");
  assert.ok(
    finalStatus.deliverables.some((d: { lifecycleState: string }) => d.lifecycleState !== "Defined"),
    "expected at least one Deliverable to have moved beyond Defined"
  );

  const events = await getSeuEvents(seuId);
  const eventTypes = events.map((e: { event_type: string }) => e.event_type);
  assert.ok(eventTypes.includes("SEUOperational"));
  assert.ok(eventTypes.includes("CapabilityFulfilled"));
  assert.ok(eventTypes.includes("DeliverableTransitioned"));
});
