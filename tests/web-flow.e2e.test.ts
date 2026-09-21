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
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { createObligation } from "../src/routes/seu/core/obligations.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { publishProfile } from "../src/routes/seu/core/profiles.js";
import { commissionSeu as commissionSeuCore } from "../src/routes/seu/core/commissioning.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { ensureWebAppTemplateFixture, uniqueTestPackVersion, driveCommissioningToActive, ensureEventSubscriptionsLoaded, ensureEligibleParticipant, waitUntilAsync, resolveDispatchRejectionObligations } from "./testFixtures.js";
import { getSeuDetailView } from "../src/routes/seu/core/seus.js";
import type { CommandRow, WorkItemRow } from "../src/dblayer/seuTypes.js";

type Session = ReturnType<typeof fetchCookie>;

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  // Must run before this file's own first commissionSeu call — see
  // ensureEventSubscriptionsLoaded's own header comment (testFixtures.ts).
  await ensureEventSubscriptionsLoaded();
  await appConfig.init();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  baseUrl = `http://127.0.0.1:${address.port}/aisworg`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
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

// Bug fix (owner, 2026-09-06: "the SEU is commissioned against an
// objective... If the commissioning happens from SEU, then Objective also
// has to be picked") — the old freeform POST /seu/seus (statement +
// Capability checklist, auto-creating an Objective and auto-matching a
// Template inline) is retired; the web UI now always requires a real
// Objective first. This fixture helper mirrors that: creates a real,
// immediately-Active Engineering Objective directly (bypassing HTTP, same
// "status omitted -> Active" one-shot convention every other direct
// createObjective fixture in the suite already relies on — no submit/
// activate dance needed for a pure test fixture), then drives the actual
// commissioning through the real two real HTTP hops the redesigned UI now
// requires: GET the picker (?objectiveId=), then POST this fixture's own
// Template+Profile.
// Bug fix (owner: "fix the tests") — this used to grab whichever
// templateProfile radio the picker offered FIRST, on the assumption
// ensureWebAppTemplateFixture's own Template was the only thing satisfying
// these 3 Capabilities. That stopped being true: the picker is a real,
// inverted Profile-first list now (one row per real Profile, not
// deduplicated to one per Template), and this shared dev database
// accumulates other test files' own disposable fixtures (e.g.
// commission-profile-choice.test.ts's "Verify Profile Choice Template")
// that legitimately satisfy the same Capability codes — confirmed directly,
// the picker now offers 36 rows for this exact requirement, and the first
// one is one of those unrelated fixtures, not this file's own. Targeting
// this fixture's own known Template/Profile ids directly is both correct
// and robust to however many other rows the picker happens to offer.
async function commissionSeu(request: Session, statementPrefix: string): Promise<{ seuId: string; csrf: string }> {
  const { template: fixtureTemplate, profile: fixtureProfile } = await ensureWebAppTemplateFixture();
  const { objective: root } = await createObjective({
    statement: `${statementPrefix}-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    requestedBy: TEST_USER_ALL_BADGES,
  });
  const { objective } = await createObjective({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    requestedBy: TEST_USER_ALL_BADGES,
  });

  const picker = await getPage(request, `/seu/seus/new?objectiveId=${objective.id}`);
  assert.equal(picker.status, 200);
  const csrf = extractCsrf(picker.html);
  const templateProfileValue = `${fixtureTemplate.id}|${fixtureProfile.id}`;
  assert.ok(
    picker.html.includes(`value="${templateProfileValue}"`),
    "expected the picker to offer this fixture's own Template+Profile — page markup may have changed since this test was written"
  );

  const result = await postForm(request, `/seu/objectives/${objective.id}/commission`, csrf, {
    templateProfile: templateProfileValue,
  });
  assert.equal(result.status, 302, "expected a redirect to the new SEU's detail page");
  assert.ok(result.location?.startsWith("/aisworg/seu/seus/"), `expected a redirect to the SEU detail page, got: ${result.location}`);
  const seuId = result.location!.split("/").pop()!;

  // design/mvp-build-plan/SEU Composition.md — the real POST this test just
  // submitted only gets commissionSeu through the shallow "Validate Request"
  // gate now; Compose EBM runs asynchronously off the CommissionValidated
  // event it published, and reaching Operational needs two further, separate
  // manual actions (Validate, Activate) on top of that. The flows below are
  // about what happens once an SEU is ready to work against, not these new
  // async/manual mechanics — same reasoning commissionFromFormSync uses —
  // so this drives it straight through deterministically rather than relying
  // on eventBus.publish's own fire-and-forget dispatch or simulating the two
  // extra button clicks over HTTP.
  // This file commissions a fresh SEU per Flow/Phase test (13+ in one file,
  // heavier than the "one SEU per test" norm driveCommissioningToActive's own
  // default timeout was sized for) — under real concurrent full-suite load
  // the default 15s can run out before finalizeCommissioning's own async
  // chain reaches Operational, even though it always does eventually. Longer
  // override, per timeoutMs's own doc comment.
  const driven = await driveCommissioningToActive({ seuId, actorRole: "super", actorId: String(TEST_USER_ALL_BADGES), timeoutMs: 45000 });
  assert.equal(driven.ok, true, !driven.ok ? `commissioning failed: ${driven.reason}` : undefined);

  // deliverableKickoffHandler's own automatic rescan (off SEUOperational,
  // and again off every later DeliverableTransitioned/resolved
  // ObligationTransitioned) hits whichever Deliverable it can reach with an
  // as-yet-unfulfilled Capability — a real, by-design empty_eligible_pool
  // Obligation/Attention Item, not any of these Flows' own scenario.
  //
  // Deliberately NOT swept here. resolveDispatchRejectionObligations walks
  // the Obligation all the way to "Verified" — a resolved status
  // deliverableKickoffHandler is ALSO subscribed to — which re-triggers the
  // exact same rescan. As long as the Capability is still unfulfilled (true
  // here: every fulfil happens later, over the web form, in each Flow/Phase
  // test's own body), that rescan hits empty_eligible_pool again and raises
  // a NEW Obligation — an oscillation a sweep at this point can chase but
  // never actually end. Each Flow/Phase test below sweeps for itself, after
  // its own fulfil step, once the cycle can no longer recur.

  // Test fixture only — no core eligibility logic touched. Under real
  // concurrent suite load the shared, finite seedParticipantsMaster.ts pool
  // for these capability codes can come up empty at the exact moment this
  // SEU's own detail page renders (every other Flow/Phase test in this file
  // commissions its own SEU needing the same codes at the same time), which
  // hides the Fulfil form entirely (detail.ejs only renders it when
  // hasAnyEligible). This participant is real and genuinely eligible by the
  // platform's own actual rules — it's not shared with anything else, so it
  // can never be contended away.
  await ensureEligibleParticipant(seuId, ["requirements-analysis", "architecture-design", "software-construction"]);

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
  // Command generation, Work Item generation and Dispatch all run in their
  // own async consumers now (executionEngine.ts/dispatchEngine.ts's own
  // header comments) — the form POST's 302 lands before any of that has
  // necessarily finished, so this must poll rather than assume it's already
  // Dispatched.
  let command: CommandRow | undefined;
  await waitUntilAsync(async () => {
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    command = (commands ?? []).find((c) => c.entity_id === deliverableId && c.to_state === targetState && c.status === "Dispatched");
    return !!command;
  });
  assert.ok(command, `expected a Dispatched Command for ${deliverableId} -> ${targetState} (did governance block it, or did Dispatch reject/defer it?)`);
  // dispatchEngine.dispatch() flips the Command's own status to "Dispatched"
  // (commandsDB.updateStatus) several awaited steps before the Work Item's
  // own status follows (workItemsDB.updateStatus) — a real, if normally
  // tiny, in-process gap. A single un-retried lookup right after the Command
  // poll above can catch the Work Item still mid-flight; poll it too.
  let workItem: WorkItemRow | undefined;
  await waitUntilAsync(async () => {
    const { data: workItems } = await workItemsDB.findByCommandIds([command!.id]);
    workItem = (workItems ?? []).find((w) => w.status === "Dispatched");
    return !!workItem;
  });
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

// CR-098 rework of the Capability Fulfilment section — the shared table row
// this file's own regex helpers used to scrape (`{code}</code></td>`) became
// one `.section-card` per Capability (detail.ejs), each carrying its own
// header (`<code>{code}</code>` + a `state-badge`), an eligible-Participant
// checkbox picker grouped by Participant Type (Unfulfilled) or an
// assigned-Participant release picker (Fulfilled), never a `<td>` anywhere.
// Every helper below scopes to one card's own slice of the page first — the
// same reason findEligibleParticipantMasterId needs a bounded slice, not a
// bare regex, to avoid bleeding into a neighboring card's own checkboxes.
function extractCapabilityCard(html: string, code: string): string {
  const header = `<code class="text-muted small">${code}</code>`;
  const start = html.indexOf(header);
  if (start === -1) throw new Error(`could not find a Capability card for "${code}" on the page`);
  const nextCard = html.indexOf('<div class="section-card mb-3">', start + 1);
  return html.slice(start, nextCard === -1 ? html.length : nextCard);
}

function capabilityStatus(html: string, code: string): string {
  const card = extractCapabilityCard(html, code);
  const match = card.match(/<span class="state-badge state-([A-Za-z]+)">/);
  if (!match) throw new Error(`could not find a status badge on the Capability card for "${code}"`);
  return match[1];
}

function findUnfulfilledCapabilityId(html: string, code: string): string {
  const card = extractCapabilityCard(html, code);
  if (capabilityStatus(html, code) !== "Unfulfilled") throw new Error(`expected Capability "${code}" to be Unfulfilled on the page`);
  const match = card.match(/capabilities\/([a-f0-9-]+)\/fulfil/);
  if (!match) throw new Error(`could not find an unfulfilled Fulfil form for Capability "${code}" on the page`);
  return match[1];
}

// CR-098's own registry-based Fulfil (fulfilCapabilityWithParticipants) —
// the form no longer accepts an ad hoc participantType/displayName pair; it
// submits one or more real participants_master ids, picked here off the
// card's own eligible-Participant checkboxes (mock-onboarded fixture data,
// seedParticipantsMaster.ts — real, already-seeded rows for every one of
// this file's Capability codes, cycled across MOCK_CAPABILITY_CODES).
function findEligibleParticipantMasterId(html: string, code: string): string {
  const card = extractCapabilityCard(html, code);
  const match = card.match(/name="participantMasterIds" value="([a-f0-9-]+)"/);
  if (!match) throw new Error(`could not find an eligible Participant checkbox for Capability "${code}" on the page`);
  return match[1];
}

// The Fulfilled-state card's own assigned-Participant checkbox (name=
// participantIds, the Release form) plus its rendered display name — CR-098
// no longer lets a caller choose the display name, so this reads back
// whichever real participants_master identity actually got assigned.
function findAssignedParticipant(html: string, code: string): { participantId: string; displayName: string } {
  const card = extractCapabilityCard(html, code);
  const match = card.match(/name="participantIds" value="([a-f0-9-]+)" id="assigned-[^"]+">\s*<label[^>]*>\s*([^<]+?)\s*<span/);
  if (!match) throw new Error(`could not find an assigned Participant on the Capability "${code}" card`);
  return { participantId: match[1], displayName: match[2].trim() };
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
  const participantMasterId = findEligibleParticipantMasterId(detail.html, "requirements-analysis");

  const result = await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantMasterIds: participantMasterId,
  });
  assert.equal(result.status, 302);

  const after1 = await getPage(request, `/seu/seus/${seuId}`);
  assert.equal(capabilityStatus(after1.html, "requirements-analysis"), "Fulfilled");
});

test("Flow 3 — Deliverable transition, valid: a Participant-fulfilled Deliverable moves to the next declared state", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-valid-transition");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantMasterIds: participantMasterId,
  });

  const result = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, {
    targetState: "In Progress",
  });
  assert.equal(result.status, 302);

  // Model A: the form POST dispatches — the flash reports it as dispatched-and-
  // outstanding, and the Deliverable is still "Defined" until a result lands.
  //
  // deliverableKickoffHandler's own automatic rescan (off SEUOperational) can
  // legitimately have already requested this exact governed hop before this
  // POST lands — the "manual" trigger tag only controls button visibility,
  // not who/what may attempt the transition. Either this call's own request
  // dispatches (alert-success, seus.ts's own "requested... until dispatched"
  // copy) or it collides with one already in flight (alert-danger, "already
  // {status} (Command ...)" — transitionDeliverable's own already_in_flight
  // detail text, no literal "flight" substring) — a real Command either way,
  // just differing in who got there first; completeOutstanding below finds
  // whichever one is actually outstanding.
  const afterDispatch = await getPage(request, `/seu/seus/${seuId}`);
  assert.ok(
    /alert-success[\s\S]*?requested\. It stays in/.test(afterDispatch.html) || /alert-danger[\s\S]*?already[\s\S]*?\(Command /.test(afterDispatch.html),
    afterDispatch.html
  );
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
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantMasterIds: participantMasterId,
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
  const reqParticipantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const archParticipantMasterId = findEligibleParticipantMasterId(before1.html, "architecture-design");
  const requirementsSpecId = findDeliverableId(before1.html, "Requirements Analysis Model");
  const architectureDocId = findDeliverableId(before1.html, "Architecture Decision Record");

  // Fulfil both producing Capabilities up front so Dispatch (Phase 3, added
  // after this bug was originally found and fixed) is never what's blocking
  // Architecture Decision Record below — this test isolates the dependency gate
  // specifically, the one that actually broke before.
  await postForm(request, `/seu/seus/${seuId}/capabilities/${reqCapabilityId}/fulfil`, csrf, { participantMasterIds: reqParticipantMasterId });
  await postForm(request, `/seu/seus/${seuId}/capabilities/${archCapabilityId}/fulfil`, csrf, { participantMasterIds: archParticipantMasterId });
  // Now that both Capabilities are genuinely fulfilled, resolving the stray
  // commissioning-time empty_eligible_pool Obligation can't recur (see
  // commissionSeu's own comment) — this hop reaches Approved below, gated by
  // the "No Unresolved Obligations" Quality Gate.
  await resolveDispatchRejectionObligations(seuId);

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
// unchanged, but a real Command and Work Item must now exist behind it.
//
// Rewritten this session for the Ch.33 redesign: governance clearing and
// dispatch outcome are no longer the same synchronous fact (executionEngine.ts/
// dispatchEngine.ts's own header comments) — the web form POST always 302s
// once governance clears, and an empty eligible-Participant pool (nobody
// fulfils the Capability yet) is Dispatch's own case 1 (DispatchRejected,
// Command marked Failed, an Obligation + Attention Item raised), not a
// deferral, so there is no more "no Participant currently fulfils..." error
// flash on the first attempt — that reason no longer exists.
test("Phase 3 — a dispatched web transition leaves a real Command and Work Item, and dispatch genuinely rejects without a fulfilled Capability", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-phase3");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  // Nobody fulfils the Capability yet — governance still clears (dependency/
  // authority/policy are all fine), so the request itself succeeds; Dispatch
  // rejects the empty pool asynchronously, marking the Command Failed.
  //
  // deliverableKickoffHandler (SEUOperational / DeliverableTransitioned /
  // ObligationTransitioned) re-scans every Deliverable in the SEU and
  // attempts each one's own next governed transition on its own initiative,
  // the same governed check this manual POST also runs — the "manual"
  // trigger tag only controls button visibility, not who/what may attempt
  // the transition. So the platform's own automatic rescan can legitimately
  // have already requested (and, with no fulfilled Capability, already had
  // rejected) this exact hop before this POST lands: either this call's own
  // request rejects, or it collides with one already in flight
  // (already_in_flight, still a 302 — flashError also redirects) and the
  // earlier one rejects instead. Either way there is at least one Failed
  // Command, never a successful dispatch, before fulfilment — the real
  // behaviour under test.
  const rejected = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(rejected.status, 302);
  await waitUntilAsync(async () => {
    const { data: commands } = await commandsDB.findBySeuId(seuId);
    return commands?.some((c) => c.status === "Failed") ?? false;
  });
  const afterRejected = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterRejected.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-Defined">Defined/, "the Deliverable must not have moved after Dispatch rejected the empty pool");

  const { data: rejectedCommands } = await commandsDB.findBySeuId(seuId);
  assert.ok(rejectedCommands && rejectedCommands.length >= 1, "expected at least one Command for the rejected hop");
  for (const c of rejectedCommands ?? []) {
    assert.equal(c.status, "Failed");
    assert.equal(c.from_state, "Defined");
    assert.equal(c.to_state, "In Progress");
  }
  const priorFailedCount = rejectedCommands!.length;

  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantMasterIds: participantMasterId });

  // The earlier Command is Failed, not in-flight (commandsDB.findInFlight),
  // so this retry is free to generate a brand new Command for the same hop.
  const dispatched = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "In Progress" });
  assert.equal(dispatched.status, 302);

  // Model A: the retry dispatches; the Participant then reports `done`, which
  // drives the Command to Completed and disposes its Work Item.
  await completeOutstanding(request, seuId, deliverableId, "In Progress");

  const { data: commands } = await commandsDB.findBySeuId(seuId);
  assert.equal(commands?.length, priorFailedCount + 1, "the earlier rejected attempt(s), plus one Completed Command from the dispatched retry");
  const completed = commands?.find((c) => c.status === "Completed");
  assert.ok(completed, "expected exactly one Completed Command");
  assert.equal(completed?.from_state, "Defined");
  assert.equal(completed?.to_state, "In Progress");
  assert.equal(commands?.filter((c) => c.status === "Failed").length, priorFailedCount, "every earlier attempt must still be Failed, untouched by the retry");

  const { data: workItems } = await workItemsDB.findByCommandIds([completed!.id]);
  assert.equal(workItems?.length, 1, "Ch.32 FR-32.1: exactly one Work Item for this one Command");
  assert.equal(workItems?.[0]?.status, "Disposed", "Ch.32 §13: a completed Work Item is disposed");
  // Ch.33 §9 — no dispatchStrategyPreference declared for this test's Profile,
  // so selectParticipant falls back to the baseline "capability-match"
  // strategy, not the pre-Ch.33-redesign "sole-eligible-participant" literal.
  assert.equal(workItems?.[0]?.dispatch_strategy, "capability-match");
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
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantMasterIds: participantMasterId });
  // Now that the Capability is genuinely fulfilled, resolving the stray
  // commissioning-time empty_eligible_pool Obligation can't recur (see
  // commissionSeu's own comment) — done before this test raises its own
  // Obligation below, so the later "1 unresolved Obligation(s)" count is
  // exact, not off by the stray one.
  await resolveDispatchRejectionObligations(seuId);

  // The Obligation must exist before the Deliverable ever reaches "In
  // Progress" — deliverableKickoffHandler's own automatic rescan (off the
  // DeliverableTransitioned that completeOutstanding's "In Progress" step
  // publishes) attempts "In Progress -> Approved" on its own initiative too,
  // asynchronously and un-awaited (eventBus.publish is fire-and-forget for
  // its subscribers). The "No Unresolved Obligations" Quality Gate only
  // blocks what it can actually see: raising the Obligation afterward would
  // leave a real window where that automatic attempt finds zero unresolved
  // Obligations and is never blocked, racing the Deliverable to Approved
  // before this test's own "blocked" check ever runs. Raising it first means
  // every attempt at that hop — manual or the platform's own — sees the same
  // Obligation and is blocked the same way, no matter which gets there first.
  // CR-108 item 3 — the manual "Create Obligation" web form/route was
  // removed (owner: "I am unsure whether we need the ability to manually
  // create an obligation"; settled to Participant-facing raiseMyObligation
  // only, quickview/participant.ejs). This test only needs a real,
  // pre-existing Obligation to block the Deliverable transition below —
  // creating it directly via the same core function the removed route and
  // raiseMyObligation both call.
  const createdObligation = await createObligation({
    relatedObjectType: "Deliverable", relatedObjectId: deliverableId,
    category: "Security", title: "WebFlow Phase4 obligation", severity: "High",
  });
  const obligationId = createdObligation.id;

  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");
  const afterBlocked = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterBlocked.html, /alert-danger/);
  assert.match(afterBlocked.html, /Quality Gate &#34;No Unresolved Obligations&#34; blocked: 1 unresolved Obligation\(s\) \(WebFlow Phase4 obligation\)/);
  assert.match(afterBlocked.html, /Requirements Analysis Model<br[\s\S]*?state-badge state-In-Progress">In Progress/, "the Deliverable must not have moved while the Quality Gate blocked it");

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await postForm(request, `/seu/seus/${seuId}/obligations/${obligationId}/transition`, csrf, { targetState });
    // A 302 alone can't distinguish success from a blocked transition —
    // flashError also redirects. Verify the real, persisted state directly
    // instead of trusting the ephemeral session flash a following GET might
    // not see yet under real concurrent suite load (session-store write/read
    // timing, unrelated to governance).
    assert.equal(step.status, 302, `Obligation transition to "${targetState}" must succeed`);
    const { data: obligationAfterStep } = await obligationsDB.findById(obligationId);
    assert.equal(obligationAfterStep?.status, targetState, `expected the Obligation to actually reach "${targetState}"`);
  }

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
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantMasterIds: participantMasterId });
  // Now that the Capability is genuinely fulfilled, resolving the stray
  // commissioning-time empty_eligible_pool Obligation can't recur (see
  // commissionSeu's own comment) — this Deliverable reaches Approved below,
  // gated by the "No Unresolved Obligations" Quality Gate.
  await resolveDispatchRejectionObligations(seuId);
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
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantMasterIds: participantMasterId });
  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

  // A real Flow metric: this Deliverable now has a measurable cycle time.
  const telemetryBefore = await getPage(request, "/seu/telemetry");
  assert.equal(telemetryBefore.status, 200);
  assert.match(telemetryBefore.html, /Requirements Analysis Model/);

  // CR-108 item 3 — manual create route removed; see Phase 4's own comment
  // above for why this now calls the core function directly.
  await createObligation({
    relatedObjectType: "Deliverable", relatedObjectId: deliverableId,
    category: "Engineering", title: "WebFlow Phase7 sustained blocker",
  });

  // Block the same gate 3 times in this SEU (the Obligation above is
  // deliberately never resolved) — the 3rd attempt crosses the threshold.
  for (let i = 0; i < 3; i++) {
    const attempt = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
    assert.equal(attempt.status, 302, "a blocked transition is still a graceful redirect, not a 500");
  }

  const afterSustained = await getPage(request, `/seu/seus/${seuId}`);
  assert.match(afterSustained.html, /Recurring friction: Quality Gate/);
  assert.match(afterSustained.html, /Organisational Learning &middot; High<\/td>\s*<td><span class="state-badge state-Identified">Identified/);

  // A 4th attempt must not raise a second one. Asserted against real data,
  // not by counting substring occurrences in the rendered HTML: a single
  // durable Obligation row legitimately appears twice in the markup (the
  // modal's own data-title attribute alongside the button's visible text,
  // CR-083), and a blocked attempt's own flash message legitimately names
  // every unresolved Obligation on the gate (qualityGateEngine.ts's
  // no_unresolved_obligations reason includes this Obligation's own title
  // once it exists) — neither is a duplicate raise, so counting raw HTML
  // matches was never a reliable way to assert "raised exactly once."
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  const { data: obligationsAfterFourth } = await obligationsDB.findBySeuId(seuId);
  const sustainedPatternObligations = (obligationsAfterFourth ?? []).filter((o) => o.category === "Organisational Learning" && o.title.startsWith("Recurring friction: Quality Gate"));
  assert.equal(sustainedPatternObligations.length, 1, "exactly one Organisational Learning Obligation, not one per blocked attempt");

  // A real Governance metric: this gate now shows non-zero average latency.
  const telemetryAfter = await getPage(request, "/seu/telemetry");
  assert.match(telemetryAfter.html, /No Unresolved Obligations/);
});

function findExternalInteractionId(html: string): string {
  const match = html.match(/external-interactions\/([a-f0-9-]+)\/transition/);
  if (!match) throw new Error("could not find an External Interaction transition form on the page");
  return match[1];
}

async function registerOrganisationName(code: string): Promise<void> {
  await pool.query(
    "INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES ('organisation-name', $1, $2, '11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING",
    [code, code]
  );
}

// Phase 8's own fixture: an isolated, single-Capability Template/Pack/Profile
// (same minimal idiom cr109-work-item-generator.test.ts's own
// commissionIsolatedSeu uses), carrying its own "No Unresolved Obligations"
// Quality Gate contribution — the one gate Phase 8 actually exercises.
//
// Not the shared ensureWebAppTemplateFixture Template: that one declares 3
// required Capabilities (requirements-analysis/architecture-design/
// software-construction) and every Flow/Phase test in this file only ever
// fulfils one. resolveDispatchRejectionObligations sweeps stray
// empty_eligible_pool Obligations/Attention Items SEU-wide, for every
// Deliverable — including the other two, permanently-unfulfilled ones.
// Resolving one of THEIR stray Obligations to Verified re-triggers
// deliverableKickoffHandler's rescan (also subscribed to resolved
// ObligationTransitioned), which immediately re-attempts that still-
// unfulfilled Deliverable and raises a brand new stray — a self-
// perpetuating oscillation no sweep placement can outrun, since the
// underlying condition (empty pool) never actually changes for a
// Capability the test never fulfils. Phase 8's own "exactly one Action
// Required Attention Item" assertion is exactly what that oscillation
// breaks. One Capability, one Deliverable: nothing left to oscillate.
async function commissionIsolatedPhase8Seu(request: Session, statementPrefix: string): Promise<{ seuId: string; csrf: string }> {
  const packSeed = {
    code: `webflow-phase8-isolated-pack-${randomUUID().slice(0, 8)}`,
    name: "WebFlow Phase8 Isolated Pack",
    category: "Organisation",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {
      // qualityGatesDB.upsert's own identity key is (entity_type, from_state,
      // to_state, category) — NOT scoped by originating_pack_id at all. The
      // real, platform-wide "No Unresolved Obligations" gate (core-engineering/
      // openup-development.pack.json) already occupies category "Review
      // Evidence" on this exact (Deliverable, In Progress, Approved) hop —
      // declaring the same category here doesn't create a second, this-Pack-
      // owned row, it silently no-ops the upsert against THAT row, still
      // owned by ITS originating Pack. Since that Pack is never part of this
      // isolated SEU's own composition, qualityGateEngine's SEU-scoped match
      // (ebm.applicable_quality_gate_ids, compositionCompleted.ts) never
      // finds it — the gate silently never fires, no matter how many times
      // "Approved" is attempted. A distinct category is a genuinely separate
      // gate identity, owned by this Pack, composed into this SEU's own EBM.
      // category must be one of the canonical category:evidence Ontology
      // concepts (validatePackSeed's assertCanonicalCategory) — "Operational
      // Evidence" isn't used by any other seeded gate on this exact
      // (Deliverable, In Progress, Approved) hop, so it's free.
      qualityGates: [
        { name: "No Unresolved Obligations", category: "Operational Evidence", governedTransition: "Deliverable|In Progress|Approved", criteriaType: "no_unresolved_obligations" },
      ],
    },
  };
  await registerOrganisationName(packSeed.code);
  const published = await publishPack({ seed: packSeed as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(published.ok, `isolated Phase8 pack must publish: ${!published.ok ? JSON.stringify(published) : ""}`);

  const { data: template } = await templatesDB.upsert({
    code: `webflow-phase8-isolated-template-${randomUUID().slice(0, 8)}`,
    name: "WebFlow Phase8 Isolated Template",
    deliverableCatalogue: [{ code: "requirements-analysis-model" }],
  });
  await templatesDB.setMandatoryPacks(template!.id, [packSeed.code]);
  const { data: requiredCapabilities } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  await templatesDB.setRequiredCapabilities(template!.id, (requiredCapabilities ?? []).map((c) => c.id));

  const profilePublish = await publishProfile({
    seed: {
      code: `webflow-phase8-isolated-profile-${randomUUID().slice(0, 8)}`,
      name: "WebFlow Phase8 Isolated Profile",
      baseTemplateCode: template!.code,
      environment: "development",
      profileVersion: "1.0.0",
      developmentMethodology: "scrum",
      primaryProgrammingLanguage: "typescript",
      sourceControlProvider: "github",
    },
    actorRole: "super", actorId: "1001",
  });
  assert.ok(profilePublish.ok, `isolated Phase8 profile must publish: ${!profilePublish.ok ? JSON.stringify(profilePublish.errors) : ""}`);
  const { data: profile } = await profilesDB.findById(profilePublish.profileId);

  await ensureEventSubscriptionsLoaded();
  const { objective: root } = await createObjective({ statement: `${statementPrefix}-root-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: TEST_USER_ALL_BADGES });
  const { objective } = await createObjective({ statement: `${statementPrefix}-${randomUUID()}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: root.id, requestedBy: TEST_USER_ALL_BADGES });

  const commissioned = await commissionSeuCore({ objectiveId: objective.id, templateIds: [template!.id], profileIds: [profile!.id], actorRole: "super", actorId: String(TEST_USER_ALL_BADGES), requestedBy: TEST_USER_ALL_BADGES });
  assert.equal(commissioned.ok, true, !commissioned.ok ? `Validate Request failed: ${JSON.stringify(commissioned)}` : undefined);
  if (!commissioned.ok) throw new Error("unreachable");
  const seuId = commissioned.seu.id;

  const driven = await driveCommissioningToActive({ seuId, actorRole: "super", actorId: String(TEST_USER_ALL_BADGES), timeoutMs: 45000 });
  assert.equal(driven.ok, true, !driven.ok ? `commissioning failed: ${driven.reason}` : undefined);

  // Web session established here, for this test's own subsequent form
  // POSTs — same reason commissionSeu's own picker GET establishes one.
  const page = await getPage(request, `/seu/seus/${seuId}`);
  const csrf = extractCsrf(page.html);

  await ensureEligibleParticipant(seuId, ["requirements-analysis"]);

  return { seuId, csrf };
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
  const { seuId, csrf } = await commissionIsolatedPhase8Seu(request, "webflow-phase8");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const participantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");
  const deliverableId = findDeliverableId(before1.html, "Requirements Analysis Model");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, { participantMasterIds: participantMasterId });
  // Now that the Capability is genuinely fulfilled, resolving the stray
  // commissioning-time empty_eligible_pool Obligation can't recur (see
  // commissionIsolatedPhase8Seu's own comment) — safe here specifically
  // because the Deliverable is still "Defined": no "In Progress -> Approved"
  // rescan is even possible yet for deliverableKickoffHandler's resolved-
  // ObligationTransitioned retrigger to race against.
  await resolveDispatchRejectionObligations(seuId);

  // The Obligation must exist before the Deliverable ever reaches "In
  // Progress" — same reasoning as Phase 4's own comment, and confirmed by a
  // real run's own DB state: creating this Obligation right after "In
  // Progress" (even genuinely before the resulting Command row's own
  // created_at) still isn't early enough. deliverableKickoffHandler's
  // rescan off the DeliverableTransitioned that "In Progress" publishes is
  // fire-and-forget and un-awaited — it can start its own governance read at
  // any point after that event fires, independent of this test's own
  // synchronous timeline, and its own multi-step Command/WorkItem/Dispatch
  // pipeline can simply finish writing later than this test's own Obligation
  // POST lands, even though it started reading first. Only "before In
  // Progress exists at all" removes the race outright — every attempt at
  // that hop, manual or automatic, whichever gets there first, then finds
  // the same Obligation already in place.
  // CR-108 item 3 — manual create route removed; see Phase 4's own comment
  // above for why this now calls the core function directly.
  await createObligation({
    relatedObjectType: "Deliverable", relatedObjectId: deliverableId,
    category: "Engineering", title: "WebFlow Phase8 blocker",
  });

  await webTransitionAndComplete(request, seuId, csrf, deliverableId, "In Progress");

  const blocked = await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  assert.equal(blocked.status, 302, "a blocked transition is still a graceful redirect, not a 500");

  // The SEU-scoped JSON API, not the platform-wide /seu/attention page: under
  // real concurrent suite load, every other test file's own real Attention
  // Items (the automatic Execution Engine now genuinely completes multi-hop
  // dispatch, so there's a lot more of them than there used to be) compete
  // for the same shared, paginated inbox, and this SEU's own row isn't
  // guaranteed to land within any fixed pageSize.
  const scopedResAfterBlock = await request(`${baseUrl}/api/seu/attention-items?seuId=${seuId}`);
  assert.equal(scopedResAfterBlock.status, 200);
  const scopedBodyAfterBlock = (await scopedResAfterBlock.json()) as { attentionItems: Array<{ id: string; category: string; title: string; status: string }> };
  // The SEU-scoped API returns every Attention Item regardless of status, not
  // just open ones (listAttentionItemsBySeu has no status filter) — the
  // already-Closed commissioning-time stray (resolveDispatchRejectionObligations
  // above) still shows up here and must be excluded, same "open" definition
  // attentionItemsDB.findOpenByRelatedObjectAny already uses.
  const actionRequiredAfterBlock = scopedBodyAfterBlock.attentionItems.filter(
    (a) => a.category === "Action Required" && a.status !== "Resolved" && a.status !== "Closed"
  );
  assert.equal(actionRequiredAfterBlock.length, 1, "expected exactly one Action Required Attention Item for this SEU");
  assert.match(actionRequiredAfterBlock[0]!.title, /is blocked by Quality Gate/);

  // A repeated attempt against the same still-unresolved Obligation must not
  // add a second row (AM-002 dedup, same discipline as Phase 7's Obligation
  // dedup).
  await postForm(request, `/seu/seus/${seuId}/deliverables/${deliverableId}/transition`, csrf, { targetState: "Approved" });
  const scopedRes = await request(`${baseUrl}/api/seu/attention-items?seuId=${seuId}`);
  assert.equal(scopedRes.status, 200);
  const scopedBody = (await scopedRes.json()) as { attentionItems: Array<{ id: string; category: string; title: string; status: string }> };
  const actionRequired = scopedBody.attentionItems.filter(
    (a) => a.category === "Action Required" && a.status !== "Resolved" && a.status !== "Closed"
  );
  assert.equal(actionRequired.length, 1, "one blocked situation must produce exactly one Attention Item, however many times it's retried");

  // Walk that Attention Item through its own lifecycle over the real,
  // SEU-scoped web route (detail.ejs's own Attention Items pane), not the
  // platform-wide page's copy of the same form.
  const attentionItemId = actionRequired[0]!.id;
  const attentionStep = await postForm(request, `/seu/seus/${seuId}/attention-items/${attentionItemId}/transition`, csrf, { targetState: "Delivered" });
  assert.equal(attentionStep.status, 302);
  const afterAttentionStep = await getPage(request, `/seu/seus/${seuId}`);
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

// CR-098's own two-step Replace (owner: "Replace should take it back to
// unfilled state... Once user picks new participants, Click on assign again
// to get the status changed to fulfiled") retired the old atomic
// participant/:id/replace UI link entirely (detail.ejs no longer renders it
// anywhere, even though the route itself still exists server-side, untouched,
// for a direct/legacy caller — see web/seus.ts's own comment on that route).
// The real, current flow this test now walks is Release (checked, from the
// card's own assigned-Participant section) followed by an ordinary Fulfil
// again — exactly what a person clicking through the real page does today.
test("Participant Lifecycle Governance, Build order step 5 — replacing a fulfilled Capability's Participant over real HTTP", async () => {
  const request = newSession();
  const { seuId, csrf } = await commissionSeu(request, "webflow-participant-replace");
  const before1 = await getPage(request, `/seu/seus/${seuId}`);
  const capabilityId = findUnfulfilledCapabilityId(before1.html, "requirements-analysis");
  const originalParticipantMasterId = findEligibleParticipantMasterId(before1.html, "requirements-analysis");

  await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantMasterIds: originalParticipantMasterId,
  });

  const afterFulfil = await getPage(request, `/seu/seus/${seuId}`);
  assert.equal(capabilityStatus(afterFulfil.html, "requirements-analysis"), "Fulfilled");
  const original = findAssignedParticipant(afterFulfil.html, "requirements-analysis");

  const released = await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/release`, csrf, {
    participantIds: original.participantId,
  });
  assert.equal(released.status, 302);

  const afterRelease = await getPage(request, `/seu/seus/${seuId}`);
  assert.equal(capabilityStatus(afterRelease.html, "requirements-analysis"), "Unfulfilled", "Release must revert the Capability to Unfulfilled");
  // CR-098 — a Participant just released from THIS Capability must not
  // reappear among the eligible picks for the very next Fulfil (excludeParticipantMasterIds,
  // core/participantEligibility.ts).
  const replacementParticipantMasterId = findEligibleParticipantMasterId(afterRelease.html, "requirements-analysis");
  assert.notEqual(replacementParticipantMasterId, originalParticipantMasterId, "the just-released Participant must not be offered again as an eligible pick");

  const result = await postForm(request, `/seu/seus/${seuId}/capabilities/${capabilityId}/fulfil`, csrf, {
    participantMasterIds: replacementParticipantMasterId,
  });
  assert.equal(result.status, 302);

  const afterReplace = await getPage(request, `/seu/seus/${seuId}`);
  assert.equal(capabilityStatus(afterReplace.html, "requirements-analysis"), "Fulfilled");
  const replacement = findAssignedParticipant(afterReplace.html, "requirements-analysis");
  assert.notEqual(replacement.displayName, original.displayName, "expected a genuinely different Participant to now be fulfilling this Capability");
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
