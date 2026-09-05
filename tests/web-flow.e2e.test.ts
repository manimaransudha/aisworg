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
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { ensureWebAppTemplateFixture, uniqueTestPackVersion } from "./testFixtures.js";

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
//
// (owner: "root was used in legacy test suite as we did not build the
// demarcation between tenants etc.") — root bypasses every tenant/badge
// check (badgeAuthorityEngine's own root bypass + the "isRoot" branch in
// every tenant-reach gate this session built), so a test that only ever logs
// in as root can never actually notice a broken scoping check. Passing a
// real seeded user id here (app.js's NODE_ENV=test shim, extended this
// session to read an `x-test-user-id` header) logs the session in as that
// real row for real — real tenant_id, real badge_grants, via the same
// buildSessionUser/ensureBadgeBootstrap/getPlatformBadges path a genuine
// Google-OAuth login uses. Omit it for flows this file exercises that have
// nothing to do with tenant/badge demarcation (Deliverable/SEU/Pack
// lifecycle mechanics) — those still run as root, unchanged.
function newSession(testUserId?: number): Session {
  if (testUserId === undefined) return fetchCookie(fetch, new CookieJar());
  const jarFetch = fetchCookie(fetch, new CookieJar());
  return (async (input: any, init?: any) =>
    jarFetch(input, { ...init, headers: { ...(init?.headers ?? {}), "x-test-user-id": String(testUserId) } })) as unknown as Session;
}

// A hidden form field is the primary source (matches what a real form submit
// actually sends), but every form this file has relied on so far happens to
// be badge-gated — a badge-less viewer (CR-076's own ATHENS_NO_PROPOSE tests)
// can land on a real page with none of them rendered at all. partials/head.ejs's
// own <meta name="csrf-token"> is unconditional on every page regardless of
// badges, so it's the fallback, not the primary (keeps every other, already-
// passing test's real-form-token behavior unchanged).
function extractCsrf(html: string): string {
  const field = html.match(/name="_csrf" value="([^"]+)"/);
  if (field) return field[1];
  const meta = html.match(/name="csrf-token" content="([^"]+)"/);
  if (meta) return meta[1];
  throw new Error("no _csrf token found on the page — page markup may have changed since this test was written");
}

async function getPage(request: Session, path: string): Promise<{ status: number; html: string }> {
  const res = await request(`${baseUrl}${path}`);
  return { status: res.status, html: await res.text() };
}

// redirect: 'manual' GET counterpart to postForm, for the same reason: a
// denied GET (requireBadge's own redirect) followed by getPage's own
// default auto-follow lands on the right page but — a real, observed gap in
// this fetch-cookie/undici combination specifically for a GET-to-GET
// redirect chain, not exercised by any other test in this file (every other
// flash check here is POST-then-separate-GET) — loses the session cookie
// somewhere in the auto-followed hop, so the flash set right before the
// redirect never shows up on the followed page. Every flash check reuses the
// same safe two-step shape postForm's own tests already rely on: capture the
// Location header manually, then re-fetch it as its own separate request.
async function getRedirect(request: Session, path: string): Promise<{ status: number; location: string | null }> {
  const res = await request(`${baseUrl}${path}`, { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
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
  await ensureWebAppTemplateFixture();
  const form = await getPage(request, "/seu/seus/new");
  assert.equal(form.status, 200);
  const csrf = extractCsrf(form.html);

  const result = await postForm(request, "/seu/seus", csrf, {
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
  });
  assert.equal(result.status, 302, "expected a redirect to the new SEU's detail page");
  assert.ok(result.location?.startsWith("/aisworg/seu/seus/"), `expected a redirect to the SEU detail page, got: ${result.location}`);
  const seuId = result.location!.split("/").pop()!;
  return { seuId, csrf };
}

// Model A (Participant Integration Plan): a web transition form POST now
// *dispatches* a Work Item — the Deliverable only moves once a Participant
// reports a result. These flows stub the Participant by immediately reporting
// `done` to the CSRF-exempt result-in callback (POST /api/seu/work-items/:id/
// result), collapsing the real two-step round-trip into one call so each flow
// can focus on the governed outcome it's actually testing. Only call this for
// a transition that passes governance (and so genuinely dispatches); a
// governance-blocked transition creates no Work Item and is asserted directly
// on the form POST instead.
async function completeOutstanding(request: Session, seuId: string, deliverableId: string, targetState: string): Promise<void> {
  const { data: commands } = await commandsDB.findBySeuId(seuId);
  const command = (commands ?? []).find((c) => c.entity_id === deliverableId && c.to_state === targetState && c.status === "Dispatched");
  assert.ok(command, `expected a Dispatched Command for ${deliverableId} -> ${targetState} (did governance block it?)`);
  const { data: workItems } = await workItemsDB.findByCommandIds([command!.id]);
  const workItem = (workItems ?? []).find((w) => w.status === "Dispatched");
  assert.ok(workItem, `expected an outstanding Work Item for ${targetState}`);
  const res = await request(`${baseUrl}/api/seu/work-items/${workItem!.id}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "done", reference: `vcs://webflow/${deliverableId}@${targetState}` }),
  });
  assert.equal(res.status, 200, `result-in callback should apply the transition: ${await res.text()}`);
}

// Dispatch (web form) + complete (result callback) in one call, for flows that
// just need the Deliverable actually moved before their real assertions.
async function webTransitionAndComplete(request: Session, seuId: string, csrf: string, deliverableId: string, targetState: string): Promise<void> {
  const posted = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState });
  assert.equal(posted.status, 302, `transition dispatch to ${targetState} should redirect`);
  await completeOutstanding(request, seuId, deliverableId, targetState);
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
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantType: "AI",
    displayName: "WebFlow Test Analyst",
  });

  const result = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, {
    targetState: "In Progress",
  });
  assert.equal(result.status, 302);

  // Model A: the form POST dispatches — the flash reports it as dispatched-and-
  // outstanding, and the Deliverable is still "Defined" until a result lands.
  const afterDispatch = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterDispatch.html, /alert-success/);
  assert.match(afterDispatch.html, /dispatched to a Participant/);
  assert.match(afterDispatch.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-Defined">Defined/, "dispatched, not yet applied");

  // The Participant reports `done` -> the result-in callback drives the move.
  await completeOutstanding(request, seuId, deliverableId, "In Progress");
  const after1 = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(after1.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-In-Progress">In Progress/);
});

test("Flow 4 — Deliverable transition, invalid: rejected with an explicit error, not silently accepted and not a 500", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-invalid-transition");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantType: "AI",
    displayName: "WebFlow Test Analyst",
  });
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

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
  const archCapabilityId = findUnfulfilledCapabilityId(before1.html, "architecture-design");
  const requirementsSpecId = findDeliverableId(before1.html, "Requirements Analysis Model");
  const architectureDocId = findDeliverableId(before1.html, "Architecture Decision Record");

  // Fulfil both producing Capabilities up front so Dispatch (Phase 3, added
  // after this bug was originally found and fixed) is never what's blocking
  // Architecture Decision Record below — this test isolates the dependency gate
  // specifically, the one that actually broke before.
  await postForm(request, `/seu/seus/${seuId}/capabilities/${reqCapabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await postForm(request, `/seu/seus/${seuId}/capabilities/${archCapabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Architect" });

  // B (Architecture Decision Record) depends on A (Requirements Analysis Model)
  // reaching 'Approved'. A is still 'Defined' — B must be blocked.
  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${architectureDocId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(blocked.status, 302);
  const afterBlocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterBlocked.html, /alert-danger/);
  assert.match(afterBlocked.html, /one or more dependencies aren&#39;t Satisfied yet/);
  // The regression itself: Architecture Decision Record must still show 'Defined',
  // not have silently moved while displaying a blocked-looking dependency note.
  assert.match(afterBlocked.html, /Architecture Decision Record<br[\s\S]*?state-badge state-Defined">Defined/);

  // Move A all the way to 'Approved' (each transition dispatched + reported).
  await webTransitionAndComplete(request, seuId, csrf, requirementsSpecId, "In Progress");
  await webTransitionAndComplete(request, seuId, csrf, requirementsSpecId, "Approved");

  // Now B must succeed.
  await webTransitionAndComplete(request, seuId, csrf, architectureDocId, "In Progress");
  const afterUnblocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterUnblocked.html, /alert-success/);
  assert.match(afterUnblocked.html, /Architecture Decision Record<br[\s\S]*?state-badge state-In-Progress">In Progress/);
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
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  // Nobody fulfils the Capability yet — Dispatch must defer, not apply the transition.
  const deferred = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(deferred.status, 302);
  const afterDeferred = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterDeferred.html, /no Participant currently fulfils this Deliverable&#39;s producing Capability/);
  assert.match(afterDeferred.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-Defined">Defined/, "the Deliverable must not have moved while dispatch was deferred");

  const { data: deferredCommands } = await commandsDB.findBySeuId(seuId);
  assert.equal(deferredCommands?.length, 1);
  assert.equal(deferredCommands?.[0]?.status, "Deferred");
  assert.equal(deferredCommands?.[0]?.from_state, "Defined");
  assert.equal(deferredCommands?.[0]?.to_state, "In Progress");

  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "Human", displayName: "WebFlow Dispatch Tester" });

  const dispatched = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(dispatched.status, 302);

  // Model A: the retry dispatches; the Participant then reports `done`, which
  // drives the Command to Completed and disposes its Work Item.
  await completeOutstanding(request, seuId, deliverableId, "In Progress");

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
// Requirements Analysis Model has no dependency edges at all (confirmed by
// direct-function tests/governance-depth.test.ts), so any block seen here can
// only be the Quality Gate/Obligation, not the Dependency Engine.
test("Phase 4 — a Quality Gate blocks a Deliverable transition while an Obligation is unresolved, and allows it once Verified", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase4");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

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
  assert.match(afterBlocked.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-In-Progress">In Progress/, "the Deliverable must not have moved while the Quality Gate blocked it");

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await postForm(request, `/seu/seus/${seuId}/obligations/${obligationId}/transition`, csrf, { targetState });
    assert.equal(step.status, 302, `Obligation transition to "${targetState}" must succeed`);
  }
  const afterVerified = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterVerified.html, /alert-success/);

  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "Approved");
  const afterUnblocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterUnblocked.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-Approved">Approved/);
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
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "Approved");

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Baselined" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");
  const afterBlocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterBlocked.html, /alert-danger/);
  assert.match(
    afterBlocked.html,
    /Quality Gate &#34;Requires Accepted Evidence or Approved Decision&#34; blocked: no accepted Evidence of category &#34;Validation Evidence&#34; or approved Decision found for this entity/
  );
  assert.match(afterBlocked.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-Approved">Approved/, "the Deliverable must not have moved while the Quality Gate blocked it");

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

  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "Baselined");
  const afterUnblocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterUnblocked.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-Baselined">Baselined/);
});

// Post-MVP Phase 6 addition, per the brief's "How this expands" section: "a
// test that promoting a Knowledge Item's scope produces a visible
// Organisational Learning Obligation."
test("Phase 6 — promoting a Published Knowledge Item's scope raises a visible Organisational Learning Obligation and appears on the Engineering Capital screen", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase6");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

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
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

  // A real Flow metric: this Deliverable now has a measurable cycle time.
  const telemetryBefore = await getPage(request, "/seu/telemetry");
  assert.equal(telemetryBefore.status, 200);
  assert.match(telemetryBefore.html, /Requirements Analysis Model/);

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
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantType: "AI", displayName: "WebFlow Analyst" });
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

  const createdObligation = await postForm(request, `/seu/seus/${seuId}/obligations`, csrf, {
    deliverableId,
    category: "Engineering",
    title: "WebFlow Phase8 blocker",
  });
  assert.equal(createdObligation.status, 302);

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");

  const attentionAfterBlock = await getPage(request, "/seu/attention?pageSize=500");
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

  const attentionAfterSecondBlock = await getPage(request, "/seu/attention?pageSize=500");
  // Walk that Attention Item through its own lifecycle.
  const attentionItemId = findAttentionItemId(attentionAfterSecondBlock.html);
  const attentionStep = await postForm(request, `/seu/attention/${attentionItemId}/transition`, csrf, { targetState: "Delivered" });
  assert.equal(attentionStep.status, 302);
  const afterAttentionStep = await getPage(request, "/seu/attention?pageSize=500");
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

  const attentionAfterFailure = await getPage(request, "/seu/attention?pageSize=500");
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
  // CR-079 bug fix — `code` used to be a freshly-registered, random-UUID-
  // suffixed capability-name concept per run. Owner: "the ontology was
  // updated with what test fixture needs. This should be removed. The
  // source of truth is what we fed through the migration files." Now a
  // stable, migration-seeded engineering-name concept (migration 134);
  // per-run uniqueness moves to packVersion instead, which also means this
  // code's own Registry history now accumulates across runs — every
  // assertion below that scopes to "this run's own card" matches on the
  // specific version too, not the code alone.
  const packCode = "webflow-phase9-pack";
  const packVersion = uniqueTestPackVersion();
  const escapedVersion = packVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const seed = {
    code: packCode,
    name: "WebFlow Phase9 Test Pack",
    category: "Engineering" as const,
    packVersion,
    installationClassification: "Optional" as const,
    contributions: {},
  };
  const published = await publishPack({ seed, actorRole: "power", actorId: "1001", activate: true });
  assert.equal(published.ok, true, !published.ok ? JSON.stringify(published.errors) : undefined);
  assert.equal(published.pack!.status, "Active");

  // The Registry list is paginated (List UI Requirements) — scope the page to
  // this fixture Pack via the search box so it isn't hidden past page 1 among
  // accumulated Packs.
  const registryPage = await getPage(request, `/seu/packs?q=${seed.code}`);
  assert.equal(registryPage.status, 200);
  assert.match(registryPage.html, new RegExp(seed.code));
  assert.match(registryPage.html, new RegExp(`v${escapedVersion}`));

  // Registry governance relocated to the Authoring page (owner, 2026-08-19:
  // Registry is view-only now — filters + a badge-gated Copy button, no
  // transition control). The Pack Authoring detail page is where the
  // lifecycle transition itself happens now.
  const authoringPage = await getPage(request, `/seu/sdk/pack-authoring/${published.pack!.id}`);
  assert.equal(authoringPage.status, 200);
  const csrf = extractCsrf(authoringPage.html);

  // CR-080 — Deprecated dropped from Pack's lifecycle (Active -> Retired
  // directly now); Retired is what this transition exercises instead.
  const transition = await postForm(request, `/seu/sdk/pack-authoring/${published.pack!.id}/transition`, csrf, { targetState: "Retired" });
  assert.equal(transition.status, 302);

  const afterTransition = await getPage(request, `/seu/sdk/pack-authoring/${published.pack!.id}`);
  assert.match(afterTransition.html, /alert-success/);
  assert.match(afterTransition.html, /state-badge state-Retired/);

  // The Registry (view-only) reflects the new state too. `code` is now
  // stable/reused across runs (see above), so its own card history
  // accumulates — match on the specific version too, not the code alone, so
  // this only ever finds THIS run's own card, not an older run's leftover.
  const registryAfter = await getPage(request, `/seu/packs?q=${seed.code}`);
  const packCardMatches = [...registryAfter.html.matchAll(new RegExp(`${seed.code}[\\s\\S]{0,100}?v${escapedVersion}[\\s\\S]{0,400}?state-badge state-(\\w+)`, "g"))];
  assert.ok(packCardMatches.length > 0, "expected to find the fixture Pack's card on the Registry page");
  assert.equal(packCardMatches[packCardMatches.length - 1]![1], "Retired");
});

function findReplaceParticipantId(html: string, capabilityCode: string): string {
  const pattern = new RegExp(`${capabilityCode}</code></td>[\\s\\S]*?participant/([a-f0-9-]+)/replace`);
  const match = html.match(pattern);
  if (!match) throw new Error(`could not find a Replace form for Capability "${capabilityCode}" on the page`);
  return match[1];
}

test("Participant Lifecycle Governance, Build order step 5 — replacing a fulfilled Capability's Participant over real HTTP", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-participant-replace");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantType: "AI",
    displayName: "WebFlow Original Analyst",
  });

  const afterFulfil = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterFulfil.html, /WebFlow Original Analyst/);
  const participantId = findReplaceParticipantId(afterFulfil.html, "requirements-analysis");

  const result = await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/participant/${participantId}/replace`, csrf, {
    participantType: "Human",
    displayName: "WebFlow Replacement Analyst",
  });
  assert.equal(result.status, 302);

  const afterReplace = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterReplace.html, /alert-success/);
  assert.match(afterReplace.html, /Participant replaced/);
  assert.match(afterReplace.html, /WebFlow Replacement Analyst/);
  // Scoped to the Capabilities table row itself (stops at the row's own
  // </tr>, via the negative lookahead) — the page legitimately still lists
  // "WebFlow Original Analyst" further down, in the Evidence-provenance
  // participant <select> (detail.ejs), which correctly shows every
  // Participant ever attached to the SEU, replaced ones included.
  assert.doesNotMatch(
    afterReplace.html,
    /requirements-analysis<\/code><\/td>(?:(?!<\/tr>)[\s\S])*?WebFlow Original Analyst/,
    "the old Participant must no longer be shown as this Capability's fulfilling Participant"
  );
});

// Finds a list row's Objective id by its (unique, randomUUID-suffixed)
// statement text — needed because CR-075 made Create redirect to the list
// rather than the new Objective's own detail page, so the id can no longer
// be read off the create redirect's Location header.
function findObjectiveIdByStatement(html: string, statement: string): string {
  const escaped = statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`href="/aisworg/seu/objectives/([a-f0-9-]+)"[^>]*>(?:(?!</a>)[\\s\\S])*?${escaped}`));
  if (!match) throw new Error(`could not find an Objective list row for statement: ${statement}`);
  return match[1];
}

// CR-075 (owner: "The Save should take me to the list page. On the list
// there should be view and edit button" / "The create strategic objective
// is not taking me to the list page") — this is web-route/rendered-HTML
// behavior (a redirect Location header, an <a href> on a list row); neither
// is observable through objective-lifecycle.test.ts's direct core-function
// calls, so it needs its own coverage at this layer, same as every other
// flow in this file.
// TEST_USER_ALL_BADGES (1001) — real seeded row, tenant
// 17db886a-3c7a-4b17-8863-5783dc40e1ea, holds every objective_* badge
// (objective-lifecycle.test.ts's own cross-tenant fixture set) — a real,
// scoped identity, not root, so this flow actually exercises the
// objective_propose gate and the tenant-reach checks rather than bypassing
// them.
const TEST_USER_ALL_BADGES = 1001;

test("Objectives — Create and the Edit page's Save both redirect to the list, which offers both View and Edit on each row", async () => {
  const request = newSession(TEST_USER_ALL_BADGES);

  const newForm = await getPage(request, "/seu/objectives/new");
  assert.equal(newForm.status, 200);
  const newCsrf = extractCsrf(newForm.html);

  const originalStatement = `webflow-edit-flow-${randomUUID()}`;
  const created = await postForm(request, "/seu/objectives", newCsrf, {
    statement: originalStatement,
    tier: "Strategic",
    requiredCapabilityCodes: ["architecture-design"],
  });
  assert.equal(created.status, 302);
  assert.equal(created.location, "/aisworg/seu/objectives", `expected Create to redirect to the list page, got: ${created.location}`);

  // Browse mode sorts newest-first, so the fresh root is guaranteed to be on
  // page 1 regardless of how many other Objectives already exist.
  const listBefore = await getPage(request, "/seu/objectives");
  assert.equal(listBefore.status, 200);
  assert.match(listBefore.html, new RegExp(originalStatement));
  const objectiveId = findObjectiveIdByStatement(listBefore.html, originalStatement);
  assert.match(
    listBefore.html,
    new RegExp(`href="/aisworg/seu/objectives/${objectiveId}/edit"`),
    "expected an Edit link on the list row, not just View"
  );

  const editPage = await getPage(request, `/seu/objectives/${objectiveId}/edit`);
  assert.equal(editPage.status, 200);
  const editCsrf = extractCsrf(editPage.html);

  const updatedStatement = `webflow-edit-flow-updated-${randomUUID()}`;
  const saved = await postForm(request, `/seu/objectives/${objectiveId}/update`, editCsrf, {
    action: "save",
    statement: updatedStatement,
    requiredCapabilityCodes: ["architecture-design"],
  });
  assert.equal(saved.status, 302);
  assert.equal(saved.location, "/aisworg/seu/objectives", `expected Save to redirect to the list page, got: ${saved.location}`);

  const listAfter = await getPage(request, "/seu/objectives");
  assert.match(listAfter.html, new RegExp(updatedStatement), "the list must reflect the saved edit");
  assert.doesNotMatch(listAfter.html, new RegExp(originalStatement), "the pre-edit statement text must no longer appear");
});

// CR-075 — the list is the one real UI gate for a locked (submitted-for-
// activation) Objective: its Edit link simply doesn't appear (owner: "just
// disable the button on the list so edit is blocked"). The Edit page itself
// has no separate locked display — Comments (a different rule, postable any
// time regardless of status) works normally there either way, while the
// actual mutation (updateObjective) still refuses for real if reached
// directly, same as objective-lifecycle.test.ts already covers at the core
// level — this just confirms the web-layer wiring end to end.
test("Objectives — the list hides Edit once locked; Comments still works; a direct Save attempt is still refused for real", async () => {
  const request = newSession(TEST_USER_ALL_BADGES);

  const newForm = await getPage(request, "/seu/objectives/new");
  const newCsrf = extractCsrf(newForm.html);
  const originalStatement = `webflow-locked-edit-${randomUUID()}`;
  const created = await postForm(request, "/seu/objectives", newCsrf, {
    statement: originalStatement,
    tier: "Strategic",
    requiredCapabilityCodes: ["architecture-design"],
  });
  assert.equal(created.status, 302);
  assert.equal(created.location, "/aisworg/seu/objectives");

  const list = await getPage(request, "/seu/objectives");
  const objectiveId = findObjectiveIdByStatement(list.html, originalStatement);

  // Queue it (submit for activation) from the detail/view page's own form —
  // unaffected by this change, still the right place for a lifecycle action.
  const detailPage = await getPage(request, `/seu/objectives/${objectiveId}`);
  assert.equal(detailPage.status, 200);
  const submitCsrf = extractCsrf(detailPage.html);
  const submitted = await postForm(request, `/seu/objectives/${objectiveId}/submit`, submitCsrf, {});
  assert.equal(submitted.status, 302);

  const listAfterSubmit = await getPage(request, "/seu/objectives");
  assert.doesNotMatch(
    listAfterSubmit.html,
    new RegExp(`href="/aisworg/seu/objectives/${objectiveId}/edit"`),
    "the list must not offer Edit once this Objective is locked"
  );

  // Comments must still work — a separate rule from the lock above.
  const lockedEdit = await getPage(request, `/seu/objectives/${objectiveId}/edit`);
  assert.equal(lockedEdit.status, 200);
  const commentCsrf = extractCsrf(lockedEdit.html);
  const commentText = `webflow-locked-comment-${randomUUID()}`;
  const posted = await postForm(request, `/seu/objectives/${objectiveId}/comments`, commentCsrf, { comment: commentText });
  assert.equal(posted.status, 302);
  const afterComment = await getPage(request, `/seu/objectives/${objectiveId}/edit`);
  assert.match(afterComment.html, new RegExp(commentText), "the posted comment must appear");

  // A direct Save attempt (bypassing the now-hidden list link) must still be
  // refused for real, not just hidden.
  const saveAttempt = await postForm(request, `/seu/objectives/${objectiveId}/update`, commentCsrf, {
    action: "save",
    statement: "should-not-apply",
    requiredCapabilityCodes: ["architecture-design"],
  });
  assert.equal(saveAttempt.status, 302);
  assert.equal(saveAttempt.location, `/aisworg/seu/objectives/${objectiveId}/edit`);
  const afterSaveAttempt = await getPage(request, `/seu/objectives/${objectiveId}`);
  assert.doesNotMatch(afterSaveAttempt.html, /should-not-apply/, "the blocked Save must not have applied");
});

// ATHENS_NO_PROPOSE (2001) — real seeded row, tenant
// adfbc3d0-d00e-440b-a115-6b7988ca2865, holds objective_achieve only, NOT
// objective_propose. Deliberately used here instead of root/1001 so this
// test proves the real denial (owner: "Only Objective_propose badges are...
// allowed to add them"), not just the button being hidden.
const ATHENS_NO_PROPOSE = 2001;

test("Objectives — GET /new, a direct POST create, and GET /:id/edit all real-refuse a viewer without objective_propose", async () => {
  const request = newSession(ATHENS_NO_PROPOSE);

  // The list itself is still viewable — this gate is about adding/editing,
  // not viewing — and it must not offer the buttons this viewer can't use.
  const list = await getPage(request, "/seu/objectives");
  assert.equal(list.status, 200);
  assert.doesNotMatch(list.html, /New Strategic Objective/, "the create button must not render for a non-holder");

  // GET /new redirects away with the real error, not a 200 with the form.
  const newFormRedirect = await getRedirect(request, "/seu/objectives/new");
  assert.equal(newFormRedirect.status, 302);
  assert.equal(newFormRedirect.location, "/aisworg/seu/objectives");
  const newForm = await getPage(request, "/seu/objectives");
  // EJS's default <%= %> escaping renders the apostrophe as &#39;, not a
  // literal ' — match a substring either side of it, not across it.
  assert.match(newForm.html, /hold the badge required to add Objectives/);

  // A direct POST (bypassing the hidden button entirely) is refused too —
  // the CSRF token comes from the list page's own navbar form, since this
  // viewer never reaches a real create form to get one from.
  const csrf = extractCsrf(list.html);
  const blockedStatement = `webflow-badge-denied-${randomUUID()}`;
  const blockedCreate = await postForm(request, "/seu/objectives", csrf, {
    statement: blockedStatement,
    tier: "Strategic",
    requiredCapabilityCodes: ["architecture-design"],
  });
  assert.equal(blockedCreate.status, 302);
  assert.equal(blockedCreate.location, "/aisworg/seu/objectives");
  const listAfter = await getPage(request, "/seu/objectives");
  assert.doesNotMatch(listAfter.html, new RegExp(blockedStatement), "the blocked create must not have applied");

  // GET /:id/edit — the pre-existing sibling gate — refuses the same way,
  // even for an Objective in this viewer's OWN tenant (fixture created
  // directly through the core function, same as objective-lifecycle.test.ts's
  // own fixtures, to isolate this from the create-gate just proven above).
  const { objective: ownTenantObjective } = await createObjective({
    statement: `webflow-badge-denied-edit-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed",
    requestedBy: ATHENS_NO_PROPOSE,
  });
  const editRedirect = await getRedirect(request, `/seu/objectives/${ownTenantObjective.id}/edit`);
  assert.equal(editRedirect.status, 302);
  assert.equal(editRedirect.location, `/aisworg/seu/objectives/${ownTenantObjective.id}`);
  const editAttempt = await getPage(request, `/seu/objectives/${ownTenantObjective.id}`);
  assert.match(editAttempt.html, /hold the badge required to edit Objectives/);
});

// BABYLON_TENANT_OBJECTIVE fixture (below) belongs to obj-achieve@babylon.com's
// tenant (28ced917-2d8a-446b-9bf2-531ab157e1fc) — genuinely distinct from
// TEST_USER_ALL_BADGES's own tenant (17db886a-3c7a-4b17-8863-5783dc40e1ea),
// same cross-tenant fixture set objective-lifecycle.test.ts's own
// reParentObjective/listReParentCandidates coverage uses. TEST_USER_ALL_BADGES
// holds every objective_* badge, isolating this test to the tenant-reach gate
// alone (a badge-less viewer would be blocked earlier, for the wrong reason).
const BABYLON_ACTOR = 2011;

test("Objectives — the web layer's own tenant-reach gate blocks a real badge holder from another tenant's Objective, not just root-bypassed access", async () => {
  const { objective: babylonObjective } = await createObjective({
    statement: `webflow-tenant-reach-babylon-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed",
    requestedBy: BABYLON_ACTOR,
  });

  // Positive control — the owning tenant can see it fine.
  const ownTenantView = await getPage(newSession(BABYLON_ACTOR), `/seu/objectives/${babylonObjective.id}`);
  assert.equal(ownTenantView.status, 200);
  assert.match(ownTenantView.html, new RegExp(babylonObjective.statement));

  // router.param("id") — a real, badge-holding, different-tenant viewer gets
  // "Objective not found," never the content, never a distinguishable 403.
  const outsider = newSession(TEST_USER_ALL_BADGES);
  const detailRedirect = await getRedirect(outsider, `/seu/objectives/${babylonObjective.id}`);
  assert.equal(detailRedirect.status, 302);
  assert.equal(detailRedirect.location, "/aisworg/seu/objectives");
  const detailAttempt = await getPage(outsider, "/seu/objectives");
  assert.match(detailAttempt.html, /Objective not found/);
  assert.doesNotMatch(detailAttempt.html, new RegExp(babylonObjective.statement), "the other tenant's statement text must never leak");

  // GET /new?parent= — same gate, the query-string parent path.
  const newChildRedirect = await getRedirect(outsider, `/seu/objectives/new?parent=${babylonObjective.id}&tier=Engineering`);
  assert.equal(newChildRedirect.status, 302);
  assert.equal(newChildRedirect.location, "/aisworg/seu/objectives");
  const newChildAttempt = await getPage(outsider, "/seu/objectives");
  assert.match(newChildAttempt.html, /Parent Objective not found/);

  // A direct POST naming the other tenant's Objective as parent is refused
  // too, not just the GET form — by requireTenantScope.forField's own route
  // gate now (added after this test was first written), which runs before
  // createObjective's own tenant-reach check ever gets a chance to fire.
  const list = await getPage(outsider, "/seu/objectives");
  const csrf = extractCsrf(list.html);
  const blockedChild = await postForm(outsider, "/seu/objectives", csrf, {
    statement: `webflow-tenant-reach-blocked-child-${randomUUID()}`,
    tier: "Engineering",
    parentObjectiveId: babylonObjective.id,
    requiredCapabilityCodes: ["architecture-design"],
  });
  assert.equal(blockedChild.status, 302);
  assert.equal(blockedChild.location, "/aisworg/seu/objectives", "refused back to the list, not created");
});

// CR-076 (owner: "every route has to be gated with a requireBadge... The
// safety net will be when the router is hit and that checks for the badge
// access again") — before this, POST /update, /move, /submit, and /delete had
// NO server-side badge check at all; only the list hiding the Edit/Delete
// link stood between a badge-less viewer and a direct POST. Proves each one
// now genuinely refuses, for real, in ATHENS_NO_PROPOSE's own tenant (so
// tenant-reach can't be the reason it's blocked — isolates the badge gate).
test("Objectives — update/move/submit/delete all real-refuse a viewer without objective_propose (previously had no route-level check at all)", async () => {
  const request = newSession(ATHENS_NO_PROPOSE);
  const originalStatement = `webflow-no-propose-mutate-${randomUUID()}`;
  const { objective } = await createObjective({
    statement: originalStatement,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed",
    requestedBy: ATHENS_NO_PROPOSE,
  });

  const list = await getPage(request, "/seu/objectives");
  const csrf = extractCsrf(list.html);

  const update = await postForm(request, `/seu/objectives/${objective.id}/update`, csrf, { statement: "should-not-apply", requiredCapabilityCodes: [] });
  assert.equal(update.status, 302);

  const move = await postForm(request, `/seu/objectives/${objective.id}/move`, csrf, { newParentId: "" });
  assert.equal(move.status, 302);

  const submit = await postForm(request, `/seu/objectives/${objective.id}/submit`, csrf, {});
  assert.equal(submit.status, 302);

  const del = await postForm(request, `/seu/objectives/${objective.id}/delete`, csrf, {});
  assert.equal(del.status, 302);

  const { data: unchanged } = await objectivesDB.findById(objective.id);
  assert.ok(unchanged, "the blocked delete must not have applied — the row still exists");
  assert.equal(unchanged?.statement, originalStatement, "the blocked update must not have applied");
  assert.equal(unchanged?.status, "Proposed", "the blocked submit must not have queued anything");
});
