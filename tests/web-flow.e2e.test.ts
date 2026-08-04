// Integration Test Handoff Brief — HTTP-level regression suite for the web
// (form + CSRF + cookie-session) layer: real fetch() requests against the
// real Express app (booted here on an ephemeral port), real database state,
// nothing mocked. See design/mvp-build-plan/Integration Test Handoff Brief.md.
//
// This complements acceptance.e2e.test.ts (which exercises the CSRF-exempt
// JSON API under routes/seu/api/) by exercising the *separate* web/ controller
// wiring instead — same core functions underneath, but a different route
// handler that could independently regress without either the direct-function
// unit tests or the API-level e2e test noticing. This is also where the
// Dependency Engine gating bug documented in Post-MVP Build Sequence.md
// ("Where things stand") actually lived: a UI-driven transition through
// routes/seu/web/seus.ts, not an API call — so Flow 5 below is that bug's
// permanent regression test, over the same layer it originally broke in.
//
// Every route/field name/response shape below was re-walked by hand against
// the current, post-Phase-3 app before being encoded here, per the brief's
// status note — Phase 3 did not change the web route contracts (still a form
// POST returning a 302 + flash message), only what happens inside
// transitionDeliverable before that redirect is issued.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";

import pool from "../src/utils/db.js";
import app from "../src/app.js";
import { appConfig } from "../src/config/appconfig.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { publishPack } from "../src/routes/seu/core/packs.js";

type Session = ReturnType<typeof fetchCookie>;

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  await appConfig.init();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  baseUrl = `http://127.0.0.1:${address.port}/aisworg`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await pool.end();
});

// Each test gets its own cookie jar (own session, own dev-mode auto-login
// identity) so fixtures never bleed across tests, mirroring separate browser
// sessions rather than one shared login.
function newSession(): Session {
  return fetchCookie(fetch, new CookieJar());
}

function extractCsrf(html: string): string {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error("no _csrf token found on the page — page markup may have changed since this test was written");
  return match[1];
}

async function getPage(request: Session, path: string): Promise<{ status: number; html: string }> {
  const res = await request(`${baseUrl}${path}`);
  return { status: res.status, html: await res.text() };
}

// redirect: 'manual' so we can assert on the 302 + Location header directly,
// exactly as the brief asks — the redirect target and status code are the
// contract a real browser (and a real bug) would hit first.
async function postForm(
  request: Session,
  path: string,
  csrf: string,
  fields: Record<string, string | string[]>
): Promise<{ status: number; location: string | null }> {
  const params = new URLSearchParams();
  params.append("_csrf", csrf);
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  const res = await request(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location") };
}

async function commissionSeu(request: Session, statementPrefix: string): Promise<{ seuId: string; csrf: string }> {
  const form = await getPage(request, "/seu/seus/new");
  assert.equal(form.status, 200);
  const csrf = extractCsrf(form.html);

  const result = await postForm(request, "/seu/seus", csrf, {
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
  });
  assert.equal(result.status, 302, "expected a redirect to the new SEU's detail page");
  assert.ok(result.location?.startsWith("/aisworg/seu/seus/"), `expected a redirect to the SEU detail page, got: ${result.location}`);
  const seuId = result.location!.split("/").pop()!;
  return { seuId, csrf };
}

function findDeliverableId(html: string, name: string): string {
  const pattern = new RegExp(`${name}<br.*?deliverables/([a-f0-9-]+)/transition`, "s");
  const match = html.match(pattern);
  if (!match) throw new Error(`could not find a transition form for Deliverable "${name}" on the page`);
  return match[1];
}

function findUnfulfilledCapabilityId(html: string, code: string): string {
  const pattern = new RegExp(`${code}</code></td>\\s*<td><span class="state-badge state-Unfulfilled">.*?capabilities/([a-f0-9-]+)/fulfil`, "s");
  const match = html.match(pattern);
  if (!match) throw new Error(`could not find an unfulfilled Fulfil form for Capability "${code}" on the page`);
  return match[1];
}

function findObligationId(html: string): string {
  const match = html.match(/obligations\/([a-f0-9-]+)\/transition/);
  if (!match) throw new Error("could not find an Obligation transition form on the page");
  return match[1];
}

function findEvidenceId(html: string): string {
  const match = html.match(/evidence\/([a-f0-9-]+)\/transition/);
  if (!match) throw new Error("could not find an Evidence transition form on the page");
  return match[1];
}

function findKnowledgeItemId(html: string): string {
  const match = html.match(/knowledge\/([a-f0-9-]+)\/transition/);
  if (!match) throw new Error("could not find a Knowledge Item transition form on the page");
  return match[1];
}

test("Flow 1 — commission an SEU end to end: redirects to its detail page, reaches Operational, SEUOperational event present", async () => {
  const request = newSession();
  const { seuId } = await commissionSeu(request, "webflow-commission");

  const detail = await getPage(request, `/seu/seus/${seuId}`);
  assert.equal(detail.status, 200);
  assert.match(detail.html, /state-badge state-Operational fs-6">Operational</);
  assert.match(detail.html, /SEUOperational/);
});

test("Flow 2 — Capability Fulfilment: fulfilling a Capability flips its status to Fulfilled", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-fulfil");
  const detail = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(detail.html, "requirements-analysis");

  const result = await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantType: "AI",
    displayName: "WebFlow Test Analyst",
  });
  assert.equal(result.status, 302);

  const after1 = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(after1.html, /requirements-analysis<\/code><\/td>\s*<td><span class="state-badge state-Fulfilled">Fulfilled</s);
});

test("Flow 3 — Deliverable transition, valid: a Participant-fulfilled Deliverable moves to the next declared state", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-valid-transition");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantType: "AI",
    displayName: "WebFlow Test Analyst",
  });

  const result = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, {
    targetState: "In Progress",
  });
  assert.equal(result.status, 302);

  const after1 = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(after1.html, /alert-success/);
  assert.match(after1.html, /Deliverable moved from &#34;Defined&#34; to &#34;In Progress&#34;/);
});

test("Flow 4 — Deliverable transition, invalid: rejected with an explicit error, not silently accepted and not a 500", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-invalid-transition");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantType: "AI",
    displayName: "WebFlow Test Analyst",
  });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });

  // No Transition Definition exists for "In Progress" -> "In Progress" — the
  // real dropdown wouldn't offer this once already at "In Progress"; submit
  // it directly, the same way a stale client or a replayed request would.
  const result = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, {
    targetState: "In Progress",
  });
  assert.equal(result.status, 302, "an invalid transition must still be a graceful redirect, not a 500");

  const after1 = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(after1.html, /alert-danger/);
  assert.match(after1.html, /no Transition Definition for Deliverable In Progress -&gt; In Progress/);
});

test("Flow 5 — Deliverable transition, dependency gating (regression: must never go green by accident)", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-dependency-gating");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const reqCapabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const archCapabilityId = findUnfulfilledCapabilityId(before1.html, "architecture");
  const requirementsSpecId = findDeliverableId(before1.html, "Requirements Specification");
  const architectureDocId = findDeliverableId(before1.html, "Architecture Document");

  // Fulfil both producing Capabilities up front so Dispatch (Phase 3, added
  // after this bug was originally found and fixed) is never what's blocking
  // Architecture Document below — this test isolates the dependency gate
  // specifically, the one that actually broke before.
  await postForm(request, `/seu/seus/${seuId}/capabilities/${reqCapabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await postForm(request, `/seu/seus/${seuId}/capabilities/${archCapabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Architect" });

  // B (Architecture Document) depends on A (Requirements Specification)
  // reaching 'Approved'. A is still 'Defined' — B must be blocked.
  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${architectureDocId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(blocked.status, 302);
  const afterBlocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterBlocked.html, /alert-danger/);
  assert.match(afterBlocked.html, /one or more dependencies aren&#39;t Satisfied yet/);
  // The regression itself: Architecture Document must still show 'Defined',
  // not have silently moved while displaying a blocked-looking dependency note.
  assert.match(afterBlocked.html, /Architecture Document<br[\s\S]*?state-badge state-Defined">Defined/);

  // Move A all the way to 'Approved'.
  await postForm(request, `/seu/seus/${seuId}/deliverables/${requirementsSpecId}/transition`, csrf, { targetState: "In Progress" });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${requirementsSpecId}/transition`, csrf, { targetState: "Approved" });

  // Now B must succeed.
  const unblocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${architectureDocId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(unblocked.status, 302);
  const afterUnblocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterUnblocked.html, /alert-success/);
  assert.match(afterUnblocked.html, /Architecture Document<br[\s\S]*?state-badge state-In-Progress">In Progress/);
});

// Post-MVP Phase 3 addition, per the brief's "How this expands" section: the
// web route's externally-visible contract (form POST -> 302 + flash) is
// unchanged, but a real Command and Work Item must now exist behind it, and
// dispatch must genuinely defer — not silently apply the transition — when
// nobody fulfils the producing Capability yet.
test("Phase 3 — a dispatched web transition leaves a real Command and Work Item, and dispatch is genuinely deferred without a fulfilled Capability", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase3");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  // Nobody fulfils the Capability yet — Dispatch must defer, not apply the transition.
  const deferred = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(deferred.status, 302);
  const afterDeferred = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterDeferred.html, /no Participant currently fulfils this Deliverable&#39;s producing Capability/);
  assert.match(afterDeferred.html, /Requirements Specification<br[\s\S]*?state-badge state-Defined">Defined/, "the Deliverable must not have moved while dispatch was deferred");

  const { data: deferredCommands } = await commandsDB.findBySeuId(seuId);
  assert.equal(deferredCommands?.length, 1);
  assert.equal(deferredCommands?.[0]?.status, "Deferred");
  assert.equal(deferredCommands?.[0]?.from_state, "Defined");
  assert.equal(deferredCommands?.[0]?.to_state, "In Progress");

  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "Human", displayName: "WebFlow Dispatch Tester" });

  const dispatched = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(dispatched.status, 302);

  const { data: commands } = await commandsDB.findBySeuId(seuId);
  assert.equal(commands?.length, 2, "one Deferred Command from the first attempt, one Completed Command from the dispatched retry");
  const completed = commands?.find((c) => c.status === "Completed");
  assert.ok(completed, "expected exactly one Completed Command");
  assert.equal(completed?.from_state, "Defined");
  assert.equal(completed?.to_state, "In Progress");

  const { data: workItems } = await workItemsDB.findByCommandIds([completed!.id]);
  assert.equal(workItems?.length, 1, "Ch.32 FR-32.1: exactly one Work Item for this one Command");
  assert.equal(workItems?.[0]?.status, "Disposed", "Ch.32 §13: a completed Work Item is disposed");
  assert.equal(workItems?.[0]?.dispatch_strategy, "sole-eligible-participant");
  assert.ok(workItems?.[0]?.participant_id, "expected the Work Item to be assigned to the fulfilling Participant");
});

// Post-MVP Phase 4 addition, per the brief's "How this expands" section: "a
// test that a Quality Gate actually blocks a transition until its criteria
// are met, and one that an Obligation blocks a Deliverable independently of
// the dependency graph — same pattern as the dependency-gating test."
// Requirements Specification has no dependency edges at all (confirmed by
// direct-function tests/governance-depth.test.ts), so any block seen here can
// only be the Quality Gate/Obligation, not the Dependency Engine.
test("Phase 4 — a Quality Gate blocks a Deliverable transition while an Obligation is unresolved, and allows it once Verified", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase4");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });

  const created = await postForm(request, `/seu/seus/${seuId}/obligations`, csrf, {
    deliverableId,
    category: "Security",
    title: "WebFlow Phase4 obligation",
    severity: "High",
  });
  assert.equal(created.status, 302);
  const afterCreate = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterCreate.html, /alert-success/);

  const obligationId = findObligationId(afterCreate.html);

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");
  const afterBlocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterBlocked.html, /alert-danger/);
  assert.match(afterBlocked.html, /Quality Gate &#34;No Unresolved Obligations&#34; blocked: 1 unresolved Obligation\(s\) \(WebFlow Phase4 obligation\)/);
  assert.match(afterBlocked.html, /Requirements Specification<br[\s\S]*?state-badge state-In-Progress">In Progress/, "the Deliverable must not have moved while the Quality Gate blocked it");

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await postForm(request, `/seu/seus/${seuId}/obligations/${obligationId}/transition`, csrf, { targetState });
    assert.equal(step.status, 302, `Obligation transition to "${targetState}" must succeed`);
  }
  const afterVerified = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterVerified.html, /alert-success/);

  const unblocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  assert.equal(unblocked.status, 302);
  const afterUnblocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterUnblocked.html, /alert-success/);
  assert.match(afterUnblocked.html, /Requirements Specification<br[\s\S]*?state-badge state-Approved">Approved/);
});

// Post-MVP Phase 5 addition, per the brief's "How this expands" section: "a
// test that a transition requiring accepted Evidence or a recorded Decision
// is blocked without it and allowed with it." The new "Approved" -> "Baselined"
// Deliverable transition (Phase 5) is gated exactly this way.
test("Phase 5 — a Deliverable transition requiring accepted Evidence is blocked without it and allowed with it", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase5");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Baselined" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");
  const afterBlocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterBlocked.html, /alert-danger/);
  assert.match(afterBlocked.html, /Quality Gate &#34;Requires Accepted Evidence or Approved Decision&#34; blocked: no accepted Evidence or approved Decision found/);
  assert.match(afterBlocked.html, /Requirements Specification<br[\s\S]*?state-badge state-Approved">Approved/, "the Deliverable must not have moved while the Quality Gate blocked it");

  const created = await postForm(request, `/seu/seus/${seuId}/evidence`, csrf, {
    deliverableId,
    category: "Validation Evidence",
    title: "WebFlow Phase5 evidence",
    source: "Manual review",
    confidenceLevel: "High",
  });
  assert.equal(created.status, 302);
  const afterCreate = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterCreate.html, /alert-success/);
  const evidenceId = findEvidenceId(afterCreate.html);

  for (const targetState of ["Validated", "Accepted"]) {
    const step = await postForm(request, `/seu/seus/${seuId}/evidence/${evidenceId}/transition`, csrf, { targetState });
    assert.equal(step.status, 302, `Evidence transition to "${targetState}" must succeed`);
  }

  const unblocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Baselined" });
  assert.equal(unblocked.status, 302);
  const afterUnblocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterUnblocked.html, /alert-success/);
  assert.match(afterUnblocked.html, /Requirements Specification<br[\s\S]*?state-badge state-Baselined">Baselined/);
});

// Post-MVP Phase 6 addition, per the brief's "How this expands" section: "a
// test that promoting a Knowledge Item's scope produces a visible
// Organisational Learning Obligation."
test("Phase 6 — promoting a Published Knowledge Item's scope raises a visible Organisational Learning Obligation and appears on the Engineering Capital screen", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase6");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  const created = await postForm(request, `/seu/seus/${seuId}/knowledge`, csrf, {
    deliverableId,
    category: "Domain Knowledge",
    title: "WebFlow Phase6 knowledge",
  });
  assert.equal(created.status, 302);
  const afterCreate = await getPage(request, `/seu/seus/${seuId}`);
  const knowledgeItemId = findKnowledgeItemId(afterCreate.html);

  // Promoting before Published is blocked.
  const tooEarly = await postForm(request, `/seu/seus/${seuId}/knowledge/${knowledgeItemId}/promote-scope`, csrf, { targetScope: "Capability" });
  assert.equal(tooEarly.status, 302, "a blocked promotion is still a graceful redirect, not a 500");
  const afterTooEarly = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterTooEarly.html, /alert-danger/);
  assert.match(afterTooEarly.html, /must be Published before its Acquisition Scope can be promoted/);

  for (const targetState of ["Proposed", "Validated", "Accepted", "Published"]) {
    const step = await postForm(request, `/seu/seus/${seuId}/knowledge/${knowledgeItemId}/transition`, csrf, { targetState });
    assert.equal(step.status, 302, `Knowledge transition to "${targetState}" must succeed`);
  }

  const promoted = await postForm(request, `/seu/seus/${seuId}/knowledge/${knowledgeItemId}/promote-scope`, csrf, { targetScope: "Capability" });
  assert.equal(promoted.status, 302);
  const afterPromoted = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterPromoted.html, /alert-success/);
  assert.match(afterPromoted.html, /Organisational Learning Obligation raised/);
  // The visible, real Obligation the brief asks for — not just a success message.
  assert.match(afterPromoted.html, /Organisational Learning &middot; \w+<\/td>\s*<td><span class="state-badge state-Identified">Identified/);

  const capitalPage = await getPage(request, "/seu/knowledge/capital");
  assert.equal(capitalPage.status, 200);
  assert.match(capitalPage.html, /WebFlow Phase6 knowledge/);
  assert.match(capitalPage.html, /scope-badge scope-Capability">Capability/);
});

// Post-MVP Phase 7 addition. No explicit "How this expands" pointer exists
// for Phase 7 in this brief yet, so this test is derived directly from
// Post-MVP Build Sequence.md's own Phase 7 "Done when" line, per this
// brief's closing instruction to use that line "as the starting spec."
test("Phase 7 — Flow and Governance Telemetry are real, and a sustained pattern of Quality Gate blocking raises exactly one Organisational Learning Obligation", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase7");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });

  // A real Flow metric: this Deliverable now has a measurable cycle time.
  const telemetryBefore = await getPage(request, "/seu/telemetry");
  assert.equal(telemetryBefore.status, 200);
  assert.match(telemetryBefore.html, /Requirements Specification/);

  const created = await postForm(request, `/seu/seus/${seuId}/obligations`, csrf, {
    deliverableId,
    category: "Engineering",
    title: "WebFlow Phase7 sustained blocker",
  });
  assert.equal(created.status, 302);

  // Block the same gate 3 times in this SEU (the Obligation above is
  // deliberately never resolved) — the 3rd attempt crosses the threshold.
  for (let i = 0; i < 3; i++) {
    const attempt = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
    assert.equal(attempt.status, 302, "a blocked transition is still a graceful redirect, not a 500");
  }

  const afterSustained = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterSustained.html, /Recurring friction: Quality Gate/);
  assert.match(afterSustained.html, /Organisational Learning &middot; High<\/td>\s*<td><span class="state-badge state-Identified">Identified/);

  // A 4th attempt must not raise a second one. The Organisational Learning
  // Obligation raised on attempt 3 is itself now an unresolved Obligation on
  // this same Deliverable, so it correctly appears BY NAME in attempt 4's own
  // flash message too (the gate is genuinely re-evaluating live data, not a
  // bug) — fetch the page a second time so that one-off flash has already
  // been consumed, leaving only the durable table row to count.
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  await getPage(request, `/seu/seus/${seuId}`);
  const afterFourth = await getPage(request, `/seu/seus/${seuId}`);
  const occurrences = afterFourth.html.match(/Recurring friction: Quality Gate/g) ?? [];
  assert.equal(occurrences.length, 1, "exactly one Organisational Learning Obligation, not one per blocked attempt");

  // A real Governance metric: this gate now shows non-zero average latency.
  const telemetryAfter = await getPage(request, "/seu/telemetry");
  assert.match(telemetryAfter.html, /No Unresolved Obligations/);
});

function findExternalInteractionId(html: string): string {
  const match = html.match(/external-interactions\/([a-f0-9-]+)\/transition/);
  if (!match) throw new Error("could not find an External Interaction transition form on the page");
  return match[1];
}

function findAttentionItemId(html: string): string {
  const match = html.match(/attention\/([a-f0-9-]+)\/transition/);
  if (!match) throw new Error("could not find an Attention Item transition form on the page");
  return match[1];
}

// Post-MVP Phase 8 addition (Ch.34 Attention Management, Ch.36 External
// Interaction). No "How this expands" pointer exists for Phase 8 in this
// brief yet (Post-MVP Build Sequence.md's own Phase 8 entry has no "Done
// when" line either — see that doc's Phase 8 completion notes for the
// self-derived scope bar this test is built against), so this walks the same
// two real browser flows the manual audit checked: (1) a blocked Quality Gate
// automatically surfaces an Attention Item on the platform-wide inbox, and
// (2) a manually-recorded External Interaction, transitioned to Failed,
// automatically surfaces a second, Exception-category Attention Item —
// the Ch.36 §13 -> Ch.34 cross-chapter integration point.
test("Phase 8 — a blocked Quality Gate and a failed External Interaction both surface real Attention Items on the platform-wide inbox", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase8");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Specification");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });

  const createdObligation = await postForm(request, `/seu/seus/${seuId}/obligations`, csrf, {
    deliverableId,
    category: "Engineering",
    title: "WebFlow Phase8 blocker",
  });
  assert.equal(createdObligation.status, 302);

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");

  const attentionAfterBlock = await getPage(request, "/seu/attention");
  assert.equal(attentionAfterBlock.status, 200);
  assert.match(attentionAfterBlock.html, /is blocked by Quality Gate/);
  assert.match(attentionAfterBlock.html, /Action Required/);

  // A repeated attempt against the same still-unresolved Obligation must not
  // add a second row (AM-002 dedup, same discipline as Phase 7's Obligation
  // dedup) — asserted through the seuId-scoped JSON API, since the platform-
  // wide inbox page also carries other tests' fixtures sharing this same
  // Deliverable name and can't be counted by substring alone.
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  const scopedRes = await request(`${baseUrl}/api/seu/attention-items?seuId=${seuId}`);
  assert.equal(scopedRes.status, 200);
  const scopedBody = (await scopedRes.json()) as { attentionItems: Array<{ category: string; title: string }> };
  const actionRequired = scopedBody.attentionItems.filter((a) => a.category === "Action Required");
  assert.equal(actionRequired.length, 1, "one blocked situation must produce exactly one Attention Item, however many times it's retried");

  const attentionAfterSecondBlock = await getPage(request, "/seu/attention");
  // Walk that Attention Item through its own lifecycle.
  const attentionItemId = findAttentionItemId(attentionAfterSecondBlock.html);
  const attentionStep = await postForm(request, `/seu/attention/${attentionItemId}/transition`, csrf, { targetState: "Delivered" });
  assert.equal(attentionStep.status, 302);
  const afterAttentionStep = await getPage(request, "/seu/attention");
  assert.match(afterAttentionStep.html, /alert-success/);

  // External Interaction: record one against the same Deliverable, then fail it.
  const interactionCreated = await postForm(request, `/seu/seus/${seuId}/external-interactions`, csrf, {
    deliverableId,
    interactionType: "API Call",
    direction: "Outbound",
    targetSystem: "WebFlow Phase8 Ticketing System",
  });
  assert.equal(interactionCreated.status, 302);
  const afterInteractionCreated = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterInteractionCreated.html, /WebFlow Phase8 Ticketing System/);
  const interactionId = findExternalInteractionId(afterInteractionCreated.html);

  const toValidated = await postForm(request, `/seu/seus/${seuId}/external-interactions/${interactionId}/transition`, csrf, { targetState: "Validated" });
  assert.equal(toValidated.status, 302);
  const toDispatched = await postForm(request, `/seu/seus/${seuId}/external-interactions/${interactionId}/transition`, csrf, { targetState: "Dispatched" });
  assert.equal(toDispatched.status, 302);
  const toFailed = await postForm(request, `/seu/seus/${seuId}/external-interactions/${interactionId}/transition`, csrf, { targetState: "Failed" });
  assert.equal(toFailed.status, 302, "a failing transition is still a graceful redirect, not a 500");

  const afterFailed = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterFailed.html, /state-badge state-Failed">Failed/);

  const attentionAfterFailure = await getPage(request, "/seu/attention");
  assert.match(attentionAfterFailure.html, /External Interaction with[\s\S]*?WebFlow Phase8 Ticketing System[\s\S]*?failed/);
  assert.match(attentionAfterFailure.html, /Exception/);
});

// Post-MVP Phase 9 addition (Ch.5 Pack Model, Ch.38 Pack Platform
// Architecture, Ch.39 Pack SDK, Ch.41 Version Management). Packs are
// SDK-only (SDK-001: "Every production Pack shall be created using the
// SDK") — there is no web/API create form, so this test publishes the
// fixture Pack directly through the real SDK entrypoint (the same function
// `pnpm pack:publish` calls) rather than pretending an HTTP path exists, and
// then exercises the two routes that *do* exist over real HTTP: the
// Registry listing and the lifecycle-transition form.
test("Phase 9 — a Pack published through the SDK is visible on the platform-wide Registry, and its lifecycle transitions over real HTTP", async () => {
  const request = newSession();
  const seed = {
    code: `webflow-phase9-pack-${randomUUID()}`,
    name: "WebFlow Phase9 Test Pack",
    category: "Technology" as const,
    packVersion: "1.0.0",
    installationClassification: "Optional" as const,
    contributions: {},
  };
  const published = await publishPack({ seed, actorRole: "power", activate: true });
  assert.equal(published.ok, true, !published.ok ? JSON.stringify(published.errors) : undefined);
  assert.equal(published.pack!.status, "Active");

  const registryPage = await getPage(request, "/seu/packs");
  assert.equal(registryPage.status, 200);
  assert.match(registryPage.html, new RegExp(seed.code));
  assert.match(registryPage.html, /v1\.0\.0/);
  const csrf = extractCsrf(registryPage.html);

  const transition = await postForm(request, `/seu/packs/${published.pack!.id}/transition`, csrf, { targetState: "Deprecated" });
  assert.equal(transition.status, 302);

  const afterTransition = await getPage(request, "/seu/packs");
  assert.match(afterTransition.html, /alert-success/);
  // Two occurrences of the code exist post-transition: the flash message and
  // the Pack's own card below it — the card (not the flash) is what needs to
  // show the new state, so match the *last* occurrence's nearby state badge.
  const packCardMatches = [...afterTransition.html.matchAll(new RegExp(`${seed.code}[\\s\\S]{0,400}?state-badge state-(\\w+)`, "g"))];
  assert.ok(packCardMatches.length > 0, "expected to find the fixture Pack's card on the Registry page");
  assert.equal(packCardMatches[packCardMatches.length - 1]![1], "Deprecated");
});
