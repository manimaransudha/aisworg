// M5 — the MVP acceptance test: the full commissioning journey from the Build
// Plan §4 table, run over real HTTP against the real Express app (booted here
// on an ephemeral port, not the dev server) and a real Postgres database.
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
import { appConfig } from "../src/config/appconfig.js";
import { ensureWebAppTemplateFixture, driveCommissioningToActive, ensureEventSubscriptionsLoaded, ensureEligibleParticipant, waitForDispatchedWorkItem } from "./testFixtures.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
let webBaseUrl: string;
let request: ReturnType<typeof fetchCookie>;

// Capability Fulfilment has no JSON API surface for a real participants_master
// Participant — only src/routes/seu/api/seus.ts's own ad-hoc {type,displayName}
// shape, which dispatchStrategies.ts's loadAvailableCandidates can never
// select (it requires a real participant_id master reference by design, not a
// bug — an ad-hoc Participant was never meant to be dispatchable). The web
// form route is the real, documented Capability Fulfilment path (Integration
// Test Handoff Brief.md) and already accepts participantMasterIds, so this
// one step goes through it instead of the JSON API.
function extractCsrf(html: string): string {
  const field = html.match(/name="_csrf" value="([^"]+)"/);
  if (field) return field[1];
  const meta = html.match(/name="csrf-token" content="([^"]+)"/);
  if (meta) return meta[1];
  throw new Error("no _csrf token found on the page — page markup may have changed since this test was written");
}

// (owner: "root was used in legacy test suite as we did not build the
// demarcation between tenants etc.") — this file used the NODE_ENV=test
// auto-login shim's implicit root fallback (no x-test-user-id header sent),
// same as web-flow.e2e.test.ts did before that fix. root bypasses every
// badge/tenant check by design (CR-076's own requireBadge/requireTenantScope
// included), so a suite that only ever runs as root can't actually exercise
// those gates. TESTER_ALL_ID (1001, seedIdentityBaseline.ts) is a real,
// non-root, tenant-scoped seeded user who holds every objective_*/deliverable_*/
// seu_*/... badge (every noun_verb this journey needs), so this journey now
// runs as a real, authorised identity instead of an implicit bypass.
const TESTER_ALL_ID = 1001;

before(async () => {
  // Must run before this file's own commission POST — see
  // ensureEventSubscriptionsLoaded's own header comment (testFixtures.ts).
  await ensureEventSubscriptionsLoaded();
  await ensureWebAppTemplateFixture();
  await appConfig.init();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  baseUrl = `http://127.0.0.1:${address.port}/aisworg/api/seu`;
  webBaseUrl = `http://127.0.0.1:${address.port}/aisworg/seu`;
  const jarFetch = fetchCookie(fetch, new CookieJar());
  request = (async (input: any, init?: any) =>
    jarFetch(input, { ...init, headers: { ...(init?.headers ?? {}), "x-test-user-id": String(TESTER_ALL_ID) } })) as unknown as typeof jarFetch;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

test("MVP acceptance: commission an SEU via the API, reach Operational, fulfil a Capability, progress a Deliverable", async () => {
  // 0 — CR-009: an Engineering Objective needs a Strategic parent (only
  // Strategic may be a root). Create the root first. CR-075 — adding a child
  // is only allowed while the parent is Proposed (createObjective's own
  // default status, with none given, is Active — this root needs it explicit).
  const rootRes = await request(`${baseUrl}/objectives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      statement: "Acceptance test: customer portal programme",
      requiredCapabilityCodes: ["requirements-analysis"],
      tier: "Strategic",
      status: "Proposed",
    }),
  });
  const root = await rootRes.json();
  assert.equal(rootRes.status, 201, JSON.stringify(root));

  // 1 — create an Objective (Ch.1) — an Engineering leaf under the root
  const objectiveRes = await request(`${baseUrl}/objectives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      statement: "Acceptance test: stand up a customer web portal",
      requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
      tier: "Engineering",
      parentObjectiveId: root.id,
    }),
  });
  const objective = await objectiveRes.json();
  assert.equal(objectiveRes.status, 201, JSON.stringify(objective));
  assert.equal(objective.requiredCapabilities.length, 3);

  // 2 — select/validate a Template against the Objective's required Capabilities (Ch.6 §11)
  const templatesRes = await request(`${baseUrl}/templates?capabilityCodes=requirements-analysis,architecture-design,software-construction`);
  assert.equal(templatesRes.status, 200);
  const { candidates } = await templatesRes.json();
  const template = candidates.find((c: { satisfies: boolean }) => c.satisfies);
  assert.ok(template, "expected at least one Template satisfying every required Capability");

  // 3 — apply a Profile (Ch.7)
  const profileRes = await request(`${baseUrl}/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId: template.id, environment: "development" }),
  });
  const profile = await profileRes.json();
  assert.equal(profileRes.status, 201, JSON.stringify(profile));

  // 4 — commission: Composition Engine runs, SEU walks Pending -> ... -> Operational (Ch.8, Ch.37)
  const commissionRes = await request(`${baseUrl}/commission`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectiveId: objective.id, templateId: template.id, profileId: profile.id }),
  });
  const commissioning = await commissionRes.json();
  assert.equal(commissionRes.status, 201, JSON.stringify(commissioning));

  const seuId = commissioning.seuId;

  // design/mvp-build-plan/SEU Composition.md — commissionSeu (and so this
  // API route) now only gets through the shallow "Validate Request" gate;
  // it returns 'Pending', not 'Operational'. Compose EBM runs asynchronously
  // off the CommissionValidated event it just published (the EBM Composer),
  // and reaching Operational needs two further, separate manual actions
  // (Validate, Activate) on top of that — driven through deterministically
  // here, same as every other test exercising the outcome of commissioning
  // rather than these new async/manual mechanics.
  assert.equal(commissioning.lifecycleState, "Pending");
  const driven = await driveCommissioningToActive({ seuId, actorRole: "general", actorId: String(TESTER_ALL_ID) });
  assert.equal(driven.ok, true, !driven.ok ? `commissioning failed: ${driven.reason}` : undefined);
  assert.equal(driven.ok && driven.seu.lifecycle_state, "Operational");
  const { data: ebm } = driven.ok && driven.seu.active_ebm_id ? await ebmsDB.findById(driven.seu.active_ebm_id) : { data: null };
  assert.ok(ebm?.composed_packs.some((p) => p.packCode === "development"), "expected the fixture Template's own mandatory Pack to have been composed");

  const statusRes = await request(`${baseUrl}/seus/${seuId}`);
  assert.equal(statusRes.status, 200);
  const status = await statusRes.json();
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
  const detailPage = await request(`${webBaseUrl}/seus/${seuId}`);
  assert.equal(detailPage.status, 200);
  const csrf = extractCsrf(await detailPage.text());
  const fulfilParams = new URLSearchParams({ _csrf: csrf, participantMasterIds: participantMasterId });
  const fulfilRes = await request(`${webBaseUrl}/seus/${seuId}/capabilities/${requirementsCapability.capabilityId}/fulfil`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fulfilParams.toString(),
    redirect: "manual",
  });
  assert.equal(fulfilRes.status, 302, "the web fulfil form must redirect, success or error");

  const statusAfterFulfil = await request(`${baseUrl}/seus/${seuId}`);
  assert.equal(statusAfterFulfil.status, 200);
  const statusAfterFulfilBody = await statusAfterFulfil.json();
  const requirementsCapabilityAfterFulfil = statusAfterFulfilBody.capabilities.find((c: { code: string }) => c.code === "requirements-analysis");
  assert.equal(requirementsCapabilityAfterFulfil.status, "Fulfilled", JSON.stringify(requirementsCapabilityAfterFulfil));

  // 7/8 — progress a Deliverable through its lifecycle (Ch.15/Ch.29), gated by dependency readiness + Authority/Policy
  const requirementsSpec = status.deliverables.find((d: { name: string }) => d.name === "Requirements Analysis Model");
  assert.ok(requirementsSpec, "expected the seeded 'Requirements Analysis Model' Deliverable");
  assert.equal(requirementsSpec.lifecycleState, "Defined");

  const transitionRes = await request(`${baseUrl}/deliverables/${requirementsSpec.id}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetState: "In Progress" }),
  });
  const transitioned = await transitionRes.json();
  // Model A (Participant Integration Plan): a successful transition is
  // "governance cleared, Command requested" (202 Accepted), not an applied
  // state change — dispatch outcome is decided later, asynchronously
  // (CommandGenerated -> WorkItemGenerated -> dispatchEngine), so the HTTP
  // response itself carries no workItemId/dispatched any more; poll for it.
  //
  // The "manual" trigger tag on this row only controls whether it renders as
  // a clickable button — it is not a restriction on who/what may attempt the
  // transition. The Execution Engine is the sole governance arbiter, and it
  // re-attempts every Deliverable's own next governed transition on its own
  // initiative too (deliverableKickoffHandler, off SEUOperational, same
  // governed check this manual POST runs). For a head-of-chain Deliverable
  // like this one (no incoming dependency), that automatic attempt can
  // legitimately win the race and already have a Command in flight before
  // this call lands — a real 202 ("Command requested" by this call) and a
  // real 409 already_in_flight ("Command requested" by the platform's own
  // kickoff) are both a correct outcome of the SAME governed transition,
  // differing only in who got there first. Any other block reason is a real
  // failure here.
  if (transitionRes.status === 202) {
    assert.equal(transitioned.fromState, "Defined");
    assert.equal(transitioned.toState, "In Progress");
  } else {
    assert.equal(transitionRes.status, 409, JSON.stringify(transitioned));
    assert.equal(transitioned.reason, "already_in_flight", JSON.stringify(transitioned));
  }
  const { command: dispatchedCommand, workItem } = await waitForDispatchedWorkItem(requirementsSpec.id, "Defined", "In Progress");
  console.log("[DEBUG dispatched]", JSON.stringify({ commandId: dispatchedCommand.id, commandStatus: dispatchedCommand.status, workItemId: workItem.id, workItemStatus: workItem.status }));

  // The Participant reports the result to the result-in callback, which drives
  // the governed transition.
  const resultRes = await request(`${baseUrl}/work-items/${workItem.id}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "done", reference: "vcs://acceptance/req-spec@1" }),
  });
  const resulted = await resultRes.json();
  console.log("[DEBUG result response]", resultRes.status, JSON.stringify(resulted));
  assert.equal(resultRes.status, 200, JSON.stringify(resulted));
  assert.equal(resulted.deliverable.lifecycle_state, "In Progress");

  // Result-in callback contract (Participant Integration Plan): the same Work
  // Item is no longer outstanding, so a replayed result is rejected (409),
  // an unknown Work Item is a 404, and an invalid outcome is a 400 — the edge
  // adapter's error surface a real Participant integration depends on.
  const replayRes = await request(`${baseUrl}/work-items/${workItem.id}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "done" }),
  });
  assert.equal(replayRes.status, 409, "a replayed result on a disposed Work Item must be a conflict, not a re-apply");
  assert.equal((await replayRes.json()).reason, "not_outstanding");

  const unknownRes = await request(`${baseUrl}/work-items/00000000-0000-0000-0000-000000000000/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "done" }),
  });
  assert.equal(unknownRes.status, 404);

  const badOutcomeRes = await request(`${baseUrl}/work-items/${workItem.id}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "totally-not-valid" }),
  });
  assert.equal(badOutcomeRes.status, 400);

  // Dependency gating is real, not decorative: the downstream Deliverable must
  // still be blocked, since its upstream dependency hasn't reached 'Approved' yet.
  const architectureDoc = status.deliverables.find((d: { name: string }) => d.name === "Architecture Decision Record");
  assert.ok(architectureDoc);
  const blockedRes = await request(`${baseUrl}/deliverables/${architectureDoc.id}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetState: "In Progress" }),
  });
  assert.equal(blockedRes.status, 409);
  const blocked = await blockedRes.json();
  assert.equal(blocked.reason, "dependency_not_satisfied");

  // Final assertion — the brief's own definition of "MVP done."
  const finalStatusRes = await request(`${baseUrl}/seus/${seuId}`);
  const finalStatus = await finalStatusRes.json();
  assert.equal(finalStatus.seu.lifecycle_state, "Operational");
  assert.ok(finalStatus.capabilities.some((c: { status: string }) => c.status === "Fulfilled"), "expected at least one Capability Fulfilled");
  assert.ok(
    finalStatus.deliverables.some((d: { lifecycleState: string }) => d.lifecycleState !== "Defined"),
    "expected at least one Deliverable to have moved beyond Defined"
  );

  const eventsRes = await request(`${baseUrl}/seus/${seuId}/events`);
  const { events } = await eventsRes.json();
  const eventTypes = events.map((e: { event_type: string }) => e.event_type);
  assert.ok(eventTypes.includes("SEUOperational"));
  assert.ok(eventTypes.includes("CapabilityFulfilled"));
  assert.ok(eventTypes.includes("DeliverableTransitioned"));
});
