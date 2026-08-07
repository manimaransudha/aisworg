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

before(async () => {
  await ensureWebAppTemplateFixture();
  await appConfig.init();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  baseUrl = `http://127.0.0.1:${address.port}/aisworg/api/seu`;
  request = fetchCookie(fetch, new CookieJar());
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await pool.end();
});

test("MVP acceptance: commission an SEU via the API, reach Operational, fulfil a Capability, progress a Deliverable", async () => {
  // 1 — create an Objective (Ch.1)
  const objectiveRes = await request(`${baseUrl}/objectives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      statement: "Acceptance test: stand up a customer web portal",
      requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
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
  assert.ok(commissioning.commissioningReport.composition.packsUsed.includes("platform-core-engineering"));

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
  assert.equal(transitionRes.status, 200, JSON.stringify(transitioned));
  assert.equal(transitioned.deliverable.lifecycle_state, "In Progress");

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
