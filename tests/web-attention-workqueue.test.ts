// The Attention list, the Work Queue of an SEU, the Pack and Telemetry pages (src/routes/seu/web: attention, workQueue, packs, telemetry).
//
//   - Each route is called over HTTP from the real app as root. A POST answers with a redirect; the test reads the flash message on the page it leads to.
//   - An Attention Item is walked along its lifecycle through the transition route, step by step, as far as root may take it without a comment, and
//     the state is read from the database after each step.
//   - The Work Queue lists the Work Items that Dispatch has handed to a Participant. The test builds them with the Dispatch Engine on a plain SEU, then
//     completes them through the page and reads what the completion left behind: the Work Item, the Command, the reference, the Participant and the
//     Attention Item of a failure.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { capabilityFulfilmentPoolsDB } from "../src/dblayer/capabilityFulfilmentPoolsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { createAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { dispatchEngine } from "../src/domain/engine/dispatchEngine.js";
import { resolveExecutionTarget } from "../src/adapters/executionTargetResolver.js";
import { commissionedSeu, commissionScenario, type CommissionedSeu } from "./webScenarios.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID,
  setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(root, "/seu/data-migrations")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

// Posts a form and reads the flash message on the page the redirect leads to.
async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<string[]> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return pageAlerts(page.html).map(readable);
}

const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

// ── Attention ─────────────────────────────────────────────────────────────────────────────────────────────────────

test("the Attention list shows the items and searches them by title", async () => {
  const { seu } = await commissionedSeu("web-attention-list");
  await createAttentionItem({ seuId: seu.id, category: "Action Required", title: `Attention listed ${run}`, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  await createAttentionItem({ seuId: seu.id, category: "Action Required", title: `Attention other ${run}`, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });

  const page = await getPage(root, `/seu/attention?q=${encodeURIComponent(`listed ${run}`)}`);
  assertPageMatches(page.html, new RegExp(`Attention listed ${run}`));
  assertPageDoesNotMatch(page.html, new RegExp(`Attention other ${run}`), "the search narrows the list");
});

test("an Attention Item is moved along its lifecycle by the transition route, one hop at a time, and a hop the state does not offer is refused", async () => {
  const { seu } = await commissionedSeu("web-attention-walk");
  const item = await createAttentionItem({ seuId: seu.id, category: "Action Required", title: `Attention walked ${run}`, actorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  const statusOf = async () => (await attentionItemsDB.findById(item.id)).data!.status;

  hasAlert(await submit(`/seu/attention/${randomUUID()}/transition/anything`), /Attention Item not found\./);
  const offered = await nextActionsFor("AttentionItem", item.status, ROOT_ACTOR_ID);
  hasAlert(await submit(`/seu/attention/${item.id}/transition/zz-no-verb`), new RegExp(`Attention Item transition blocked: "zz-no-verb" is not available from ${item.status}\\.`));
  assert.equal(await statusOf(), item.status, "a refused hop changes nothing");

  let moved = 0;
  let commentChecked = false;
  for (let step = 0; step < 10; step++) {
    const status = await statusOf();
    const actions = await nextActionsFor("AttentionItem", status, ROOT_ACTOR_ID);
    const withComment = actions.find((a) => a.requiresComment);
    if (withComment && !commentChecked) {
      commentChecked = true;
      hasAlert(await submit(`/seu/attention/${item.id}/transition/${withComment.verb}`), /Attention Item transition blocked: /);
      assert.equal(await statusOf(), status, "a hop that needs a comment is refused when the form sends none");
    }
    const plain = actions.find((a) => !a.requiresComment);
    if (!plain) break;
    const alerts = await submit(`/seu/attention/${item.id}/transition/${plain.verb}`);
    hasAlert(alerts, new RegExp(`Attention Item moved from "${status}" to "${plain.toState}"\\.`));
    assert.equal(await statusOf(), plain.toState);
    moved += 1;
  }
  assert.ok(moved >= 1, `root can take at least the first hop from ${item.status}: ${JSON.stringify(offered)}`);
});

// ── Work Queue ────────────────────────────────────────────────────────────────────────────────────────────────────

let t: CommissionedSeu;
let capabilityId: string;
let deliverableBirthState: string;

before(async () => {
  t = await commissionedSeu("web-work-queue");
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM capability_definitions ORDER BY created_at LIMIT 1");
  assert.ok(rows[0], "the database holds a Capability Definition");
  capabilityId = rows[0].id;
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth);
  deliverableBirthState = birth.to_state;
});

// A Work Item that Dispatch has handed to a Participant: a Deliverable, a pool of one Participant, a Command and its Work Item.
async function dispatchedWork(label: string) {
  const { data: deliverable } = await deliverablesDB.create({
    seuId: t.seu.id, name: `Queued ${label} ${run}`, producingCapabilityId: capabilityId, state: deliverableBirthState, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  const { data: master } = await participantsMasterDB.create({ tenantId: PLATFORM_TENANT_ID, type: "Human", displayName: `Queue participant ${label} ${run}`, userId: null });
  assert.ok(deliverable && master);
  const { data: participant } = await participantsDB.create({ seuId: t.seu.id, type: "Human", displayName: master.display_name, participantId: master.id });
  assert.ok(participant);
  const { data: fulfilmentPool } = await capabilityFulfilmentPoolsDB.create({
    seuId: t.seu.id, seuCapabilityId: null, capabilityId, participantIds: [participant.id], authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(fulfilmentPool);
  const { data: command } = await commandsDB.create({
    seuId: t.seu.id, entityType: "Deliverable", entityId: deliverable.id, commandType: `zz-queue-${run}`, fromState: deliverableBirthState, toState: "In Progress",
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(), eligibleParticipantPoolId: fulfilmentPool.id,
  });
  assert.ok(command);
  const { data: workItem } = await workItemsDB.create({ commandId: command.id, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(workItem);
  await dispatchEngine.dispatch({ workItem, seuId: t.seu.id, producingCapabilityId: capabilityId, eligibleParticipantPoolId: fulfilmentPool.id, correlationId: command.correlation_id });
  assert.equal((await workItemsDB.findById(workItem.id)).data?.status, "Dispatched", "Dispatch handed the Work Item to the Participant");
  return { deliverable, participant, command, workItem };
}

const queuePath = () => `/seu/seus/${t.seu.id}/work-queue`;
const completePath = (workItemId: string) => `/seu/seus/${t.seu.id}/work-items/${workItemId}/complete`;

test("the Work Queue lists the outstanding Work Items of the SEU with the Deliverable, the transition and the way the work is done, and searches them", async () => {
  const first = await dispatchedWork("listed");
  const second = await dispatchedWork("hidden");
  const target = await resolveExecutionTarget(t.seu.tenant_id, capabilityId);

  const page = await getPage(root, queuePath());
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(first.deliverable.name));
  assertPageMatches(page.html, new RegExp(second.deliverable.name));
  assertPageMatches(page.html, /Defined\s*&rarr;\s*In Progress/);
  assertPageMatches(page.html, new RegExp(`mode-badge mode-${target.mode}`));
  assertPageMatches(page.html, new RegExp(`/work-items/${first.workItem.id}/complete`), "each row carries the form that reports its result");

  const searched = await getPage(root, `${queuePath()}?q=${encodeURIComponent(first.deliverable.name)}`);
  assertPageMatches(searched.html, new RegExp(first.deliverable.name));
  assertPageDoesNotMatch(searched.html, new RegExp(second.deliverable.name), "the search narrows the queue");

  const empty = await commissionScenario("unsettled", "web-work-queue-empty");
  const emptyPage = await getPage(root, `/seu/seus/${empty.seu.id}/work-queue`);
  assert.equal(emptyPage.status, 200);
  assertPageMatches(emptyPage.html, /No outstanding Work Items/);
  assertPageDoesNotMatch(emptyPage.html, new RegExp(first.deliverable.name), "another SEU's queue does not list it");
});

test("completing a Work Item as done records the reference, disposes the Work Item, completes the Command and frees the Participant", async () => {
  const work = await dispatchedWork("done");
  hasAlert(await submit(completePath(work.workItem.id), { outcome: "finished" }), /Outcome must be done, failed or blocked\./);
  hasAlert(await submit(completePath(randomUUID()), { outcome: "done" }), /Could not record result: Work Item not found: /);
  assert.equal((await workItemsDB.findById(work.workItem.id)).data?.status, "Dispatched", "a refused completion changes nothing");

  const alerts = await submit(completePath(work.workItem.id), { outcome: "done", reference: `vcs://web-queue/${run}@1` });
  hasAlert(alerts, new RegExp(`Result recorded for Deliverable "${work.deliverable.name}"\\.`));
  assert.equal((await workItemsDB.findById(work.workItem.id)).data?.status, "Disposed");
  assert.equal((await commandsDB.findById(work.command.id)).data?.status, "Completed");
  assert.equal((await participantsDB.findById(work.participant.id)).data?.state, "Idle");
  const { rows } = await pool.query<{ reference: string | null; to_state: string }>("SELECT reference, to_state FROM deliverable_references WHERE deliverable_id = $1", [work.deliverable.id]);
  assert.deepEqual(rows, [{ reference: `vcs://web-queue/${run}@1`, to_state: "In Progress" }]);
  assertPageDoesNotMatch((await getPage(root, queuePath())).html, new RegExp(work.deliverable.name), "a completed Work Item leaves the queue");

  hasAlert(await submit(completePath(work.workItem.id), { outcome: "done" }), /Could not record result: Work Item .* is not outstanding \(status: Disposed\)/);
});

test("a Work Item reported failed or blocked fails the Work Item and the Command, frees the Participant and raises an Attention Item for the Deliverable", async () => {
  for (const outcome of ["failed", "blocked"] as const) {
    const work = await dispatchedWork(outcome);
    const alerts = await submit(completePath(work.workItem.id), { outcome });
    hasAlert(alerts, new RegExp(`Reported "${outcome}" — the work was not completed and an Attention Item was raised\\.`));
    assert.equal((await workItemsDB.findById(work.workItem.id)).data?.status, "Failed");
    assert.equal((await commandsDB.findById(work.command.id)).data?.status, "Failed");
    assert.equal((await participantsDB.findById(work.participant.id)).data?.state, "Idle");
    const { data: items } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", work.deliverable.id);
    const raised = (items ?? []).find((i) => i.title === `Work Item ${outcome} on Deliverable "${work.deliverable.name}"`);
    assert.deepEqual([raised?.category, raised?.priority], ["Exception", "High"]);
    const { rows } = await pool.query("SELECT 1 FROM deliverable_references WHERE deliverable_id = $1", [work.deliverable.id]);
    assert.equal(rows.length, 0, "a failed Work Item records no reference");
  }
});

// ── Packs and Telemetry ───────────────────────────────────────────────────────────────────────────────────────────

test("the Pack pages answer an id that is not an id with an error page, and an id that does not exist with the list and the reason", async () => {
  assert.equal((await getPage(root, "/seu/packs/not-a-uuid")).status, 500);
  const missing = await getRedirect(root, `/seu/packs/${randomUUID()}`);
  assert.equal(missing.status, 302);
  assert.equal(missing.location, "/aisworg/seu/packs");
  hasAlert(pageAlerts((await getPage(root, "/seu/packs")).html).map(readable), /Pack not found\./);
});

test("the Telemetry page is scoped to the SEU it is asked for, and shows its Objective, or the whole platform when the SEU does not exist", async () => {
  const { seu } = await commissionedSeu("web-telemetry");
  const { data: objective } = await objectivesDB.findById(seu.objective_id);
  assert.ok(objective);

  const scoped = await getPage(root, `/seu/telemetry?seuId=${seu.id}`);
  assert.equal(scoped.status, 200);
  assert.ok(scoped.html.includes(`Showing: ${objective.statement}`), "the page names the Objective of the SEU");

  const unknown = await getPage(root, `/seu/telemetry?seuId=${randomUUID()}`);
  assert.equal(unknown.status, 200);
  assert.ok(unknown.html.includes("Showing: all SEUs (platform-wide)"), "an SEU that does not exist selects nothing");
});
