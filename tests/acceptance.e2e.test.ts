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
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
let request: ReturnType<typeof fetchCookie>;

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
  await ensureWebAppTemplateFixture();
  await appConfig.init();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  baseUrl = `http://127.0.0.1:${address.port}/aisworg/api/seu`;
  const jarFetch = fetchCookie(fetch, new CookieJar());
  request = (async (input: any, init?: any) =>
    jarFetch(input, { ...init, headers: { ...(init?.headers ?? {}), "x-test-user-id": String(TESTER_ALL_ID) } })) as unknown as typeof jarFetch;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await pool.end();
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
      requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
      tier: "Engineering",
      parentObjectiveId: root.id,
    }),
  });
  const objective = await objectiveRes.json();
  assert.equal(objectiveRes.status, 201, JSON.stringify(objective));
  assert.equal(objective.requiredCapabilities.length, 3);

  // 2 — select/validate a Template against the Objective's required Capabilities (Ch.6 §11)
  const templatesRes = await request(`${baseUrl}/templates?capabilityCodes=requirements-analysis,architecture,development`);
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
  assert.equal(commissioning.lifecycleState, "Operational");
  assert.ok(commissioning.commissioningReport.composition.packsUsed.includes("development"));

  const seuId = commissioning.seuId;

  const statusRes = await request(`${baseUrl}/seus/${seuId}`);
  assert.equal(statusRes.status, 200);
  const status = await statusRes.json();
  assert.equal(status.seu.lifecycle_state, "Operational");
  assert.ok(status.deliverables.length >= 1, "expected the Template's Deliverable Catalogue to have been seeded at commissioning");

  const requirementsCapability = status.capabilities.find((c: { code: string }) => c.code === "requirements-analysis");
  assert.ok(requirementsCapability);
  assert.equal(requirementsCapability.status, "Unfulfilled");

  // 6 — assign a Participant to a Capability (Ch.12, direct assignment — no Dispatch Engine)
  const fulfilRes = await request(`${baseUrl}/seus/${seuId}/capabilities/${requirementsCapability.capabilityId}/fulfil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participant: { type: "AI", displayName: "Acceptance Test Requirements Analyst" } }),
  });
  const fulfilment = await fulfilRes.json();
  assert.equal(fulfilRes.status, 200, JSON.stringify(fulfilment));
  assert.equal(fulfilment.seuCapability.status, "Fulfilled");

  // 7/8 — progress a Deliverable through its lifecycle (Ch.15/Ch.29), gated by dependency readiness + Authority/Policy
  const requirementsSpec = status.deliverables.find((d: { name: string }) => d.name === "Requirements Specification");
  assert.ok(requirementsSpec, "expected the seeded 'Requirements Specification' Deliverable");
  assert.equal(requirementsSpec.lifecycleState, "Defined");

  const transitionRes = await request(`${baseUrl}/deliverables/${requirementsSpec.id}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetState: "In Progress" }),
  });
  const transitioned = await transitionRes.json();
  // Model A (Participant Integration Plan): a successful transition is a
  // *dispatch* (202 Accepted, outstanding), not an applied state change.
  assert.equal(transitionRes.status, 202, JSON.stringify(transitioned));
  assert.equal(transitioned.dispatched, true);
  assert.ok(transitioned.workItemId, "expected a Work Item id to report a result against");

  // The Participant reports the result to the result-in callback, which drives
  // the governed transition.
  const resultRes = await request(`${baseUrl}/work-items/${transitioned.workItemId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "done", reference: "vcs://acceptance/req-spec@1" }),
  });
  const resulted = await resultRes.json();
  assert.equal(resultRes.status, 200, JSON.stringify(resulted));
  assert.equal(resulted.deliverable.lifecycle_state, "In Progress");

  // Result-in callback contract (Participant Integration Plan): the same Work
  // Item is no longer outstanding, so a replayed result is rejected (409),
  // an unknown Work Item is a 404, and an invalid outcome is a 400 — the edge
  // adapter's error surface a real Participant integration depends on.
  const replayRes = await request(`${baseUrl}/work-items/${transitioned.workItemId}/result`, {
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

  const badOutcomeRes = await request(`${baseUrl}/work-items/${transitioned.workItemId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "totally-not-valid" }),
  });
  assert.equal(badOutcomeRes.status, 400);

  // Dependency gating is real, not decorative: the downstream Deliverable must
  // still be blocked, since its upstream dependency hasn't reached 'Approved' yet.
  const architectureDoc = status.deliverables.find((d: { name: string }) => d.name === "Architecture Document");
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
