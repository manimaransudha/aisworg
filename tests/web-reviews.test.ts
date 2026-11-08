// Review pages of an SEU (src/routes/seu/web/reviews.ts): planning a Review of a Deliverable, moving it along its lifecycle to an outcome, raising Findings,
// resolving them and converting a Finding to an Obligation.
//
//   - Each route is called over HTTP from the real app as root, on a plain SEU row with a Deliverable. A POST answers with a redirect; the test reads the flash
//     message on the page it leads to, then reads the Review, Finding, Obligation or Attention Item from the database.
//   - The Review is walked with the verbs its state offers to root (nextActionsFor), not with literals, and the one hop that needs an outcome is first tried
//     without one.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { reviewsDB } from "../src/dblayer/reviewsDB.js";
import { findingsDB } from "../src/dblayer/findingsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { COMPLETE_REVIEW_ACTION_CODE } from "../src/dblayer/constants.js";
import { commissionScenario, type ScenarioSeu } from "./webScenarios.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID,
  setWebBaseUrl, newSession, extractCsrf, getPage, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let t: ScenarioSeu;
let deliverableId: string;
let deliverableName: string;

before(async () => {
  t = await commissionScenario("clean", "web-reviews");
  // The reviewed Deliverable is one that commissioning made for the SEU.
  const [deliverable] = (await deliverablesDB.findBySeuId(t.seu.id)).data ?? [];
  assert.ok(deliverable, "commissioning made a Deliverable");
  deliverableName = deliverable.name;
  deliverableId = deliverable.id;

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
const reviewsPath = () => `/seu/seus/${t.seu.id}/reviews`;

async function submit(pathName: string, fields: Record<string, string> = {}): Promise<string[]> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return pageAlerts(page.html).map(readable);
}

const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

async function planReview(name: string, category = "Architecture"): Promise<string> {
  hasAlert(await submit(reviewsPath(), { deliverableId, category, name }), new RegExp(`Review "${name}" planned \\(${category}\\)\\.`));
  const { data } = await reviewsDB.findByRelatedObject("Deliverable", deliverableId);
  const review = (data ?? []).find((r) => r.name === name);
  assert.ok(review, "the Review is stored");
  return review.id;
}

test("a Review is planned for a Deliverable, shown on the page of the SEU and searched, and refused without its Deliverable, category or name", async () => {
  hasAlert(await submit(reviewsPath(), { deliverableId: "", category: "Architecture", name: "x" }), /Deliverable, category and name are required\./);
  hasAlert(await submit(reviewsPath(), { deliverableId, category: " ", name: "x" }), /Deliverable, category and name are required\./);
  hasAlert(await submit(reviewsPath(), { deliverableId, category: "Architecture", name: " " }), /Deliverable, category and name are required\./);

  const name = `Planned review ${run}`;
  const id = await planReview(name);
  const review = (await reviewsDB.findById(id)).data;
  assert.deepEqual([review?.status, review?.category, review?.outcome, review?.related_object_id], ["Planned", "Architecture", null, deliverableId]);

  const other = await planReview(`Other review ${run}`, "Code");
  assert.ok(other);
  const page = await getPage(root, reviewsPath());
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(name));
  assertPageMatches(page.html, new RegExp(deliverableName), "the form offers the Deliverables of the SEU");
  const searched = await getPage(root, `${reviewsPath()}?q=${encodeURIComponent(name)}`);
  assertPageMatches(searched.html, new RegExp(name));
  assertPageDoesNotMatch(searched.html, new RegExp(`Other review ${run}`), "the search narrows the Reviews");

  const ghost = await submit(reviewsPath(), { deliverableId: randomUUID(), category: "Architecture", name: `Ghost review ${run}` });
  assert.ok(ghost.length > 0 && !ghost.some((a) => /planned/.test(a)), JSON.stringify(ghost));
  assert.equal(((await reviewsDB.findByRelatedObject("Deliverable", deliverableId)).data ?? []).some((r) => r.name === `Ghost review ${run}`), false, "a Review of a Deliverable that does not exist is not planned");
});

test("a Review is moved through its lifecycle by the verbs its state offers; completing needs an outcome, which stays with the Review, and a verb the state does not offer is refused", async () => {
  const id = await planReview(`Walked review ${run}`);
  const transition = (verb: string, outcome?: string) => submit(`/seu/seus/${t.seu.id}/reviews/${id}/transition/${verb}`, outcome ? { outcome } : {});

  hasAlert(await submit(`/seu/seus/${t.seu.id}/reviews/${randomUUID()}/transition/anything`), /Review not found\./);
  hasAlert(await transition("zz-no-verb"), /Review transition blocked: "zz-no-verb" is not available from Planned\./);

  let completed = false;
  for (let step = 0; step < 10; step++) {
    const review = (await reviewsDB.findById(id)).data!;
    const actions = await nextActionsFor("Review", review.status, ROOT_ACTOR_ID);
    const next = actions.find((a) => a.actionCode === COMPLETE_REVIEW_ACTION_CODE) ?? actions.find((a) => !/cancel|reject|abandon|withdraw/i.test(a.verb)) ?? actions[0];
    if (!next) break;
    if (next.actionCode === COMPLETE_REVIEW_ACTION_CODE) {
      hasAlert(await transition(next.verb), /Review transition blocked: /);
      assert.equal((await reviewsDB.findById(id)).data?.status, review.status, "completing without an outcome is refused");
      hasAlert(await transition(next.verb, "Passed with Recommendations"), new RegExp(`Review moved to "${next.toState}" \\(outcome: Passed with Recommendations\\)\\.`));
      assert.equal((await reviewsDB.findById(id)).data?.outcome, "Passed with Recommendations");
      completed = true;
    } else {
      hasAlert(await transition(next.verb), new RegExp(`Review moved to "${next.toState}"( \\(outcome: [^)]*\\))?\\.`));
    }
    assert.equal((await reviewsDB.findById(id)).data?.status, next.toState);
  }
  assert.ok(completed, "the lifecycle reaches the hop that completes the Review");
  assert.equal((await reviewsDB.findById(id)).data?.outcome, "Passed with Recommendations", "the outcome survives the hops after completion");
});

test("a Finding is raised on a Review with a severity that defaults to Medium, a High one surfaces an Attention Item, and a Finding without a title is refused", async () => {
  const reviewId = await planReview(`Findings review ${run}`, "Security");
  const findingsPath = `/seu/seus/${t.seu.id}/reviews/${reviewId}/findings`;
  hasAlert(await submit(findingsPath, { severity: "Low", title: "  " }), /Finding title is required\./);

  hasAlert(await submit(findingsPath, { title: `Default severity ${run}` }), new RegExp(`Finding "Default severity ${run}" raised\\.`));
  hasAlert(await submit(findingsPath, { severity: "Low", title: `Low finding ${run}`, description: "Small" }), /raised\./);
  hasAlert(await submit(findingsPath, { severity: "High", title: `High finding ${run}`, description: "Serious" }), /raised\./);

  const findings = (await findingsDB.findByReviewId(reviewId)).data ?? [];
  const byTitle = (title: string) => findings.find((f) => f.title === title);
  assert.deepEqual([byTitle(`Default severity ${run}`)?.severity, byTitle(`Low finding ${run}`)?.severity, byTitle(`High finding ${run}`)?.severity], ["Medium", "Low", "High"]);
  assert.equal(byTitle(`Low finding ${run}`)?.description, "Small");
  assert.equal(byTitle(`High finding ${run}`)?.status, "Open");

  const surfaced = await attentionItemsDB.findOpenByRelatedObject(t.seu.id, "Action Required", "Deliverable", deliverableId);
  assert.ok(surfaced, "the High finding surfaces an Attention Item for the Deliverable");

  const page = await getPage(root, reviewsPath());
  assertPageMatches(page.html, new RegExp(`High finding ${run}`), "the page lists the Findings under their Review");
  const orphan = await submit(`/seu/seus/${t.seu.id}/reviews/${randomUUID()}/findings`, { title: `Orphan finding ${run}` });
  assert.ok(orphan.length > 0 && !orphan.some((a) => /raised/.test(a)), "a Finding on a Review that does not exist is not raised");
});

test("a Finding is moved by the verbs its state offers and refused for others, and a Finding that does not exist is reported", async () => {
  const reviewId = await planReview(`Resolve review ${run}`, "Code");
  hasAlert(await submit(`/seu/seus/${t.seu.id}/reviews/${reviewId}/findings`, { severity: "Low", title: `To resolve ${run}` }), /raised\./);
  const finding = ((await findingsDB.findByReviewId(reviewId)).data ?? []).find((f) => f.title === `To resolve ${run}`)!;
  const actions = await nextActionsFor("Finding", finding.status, ROOT_ACTOR_ID);
  const resolve = actions.find((a) => a.toState === "Resolved");
  assert.ok(resolve, `an Open Finding can be resolved, root is offered ${JSON.stringify(actions)}`);

  hasAlert(await submit(`/seu/seus/${t.seu.id}/findings/${randomUUID()}/transition/anything`), /Finding not found\./);
  hasAlert(await submit(`/seu/seus/${t.seu.id}/findings/${finding.id}/transition/zz-no-verb`), /Finding transition blocked: "zz-no-verb" is not available from Open\./);
  assert.equal((await findingsDB.findById(finding.id)).data?.status, "Open", "a refused hop changes nothing");

  hasAlert(await submit(`/seu/seus/${t.seu.id}/findings/${finding.id}/transition/${resolve.verb}`), /Finding moved to "Resolved"\./);
  assert.equal((await findingsDB.findById(finding.id)).data?.status, "Resolved");
  hasAlert(await submit(`/seu/seus/${t.seu.id}/findings/${finding.id}/transition/${resolve.verb}`), new RegExp(`Finding transition blocked: "${resolve.verb}" is not available from Resolved\\.`));
});

test("a Finding is converted to an Obligation once, which links them and takes the Finding out of its Open state; converting again or converting a Finding that does not exist is refused", async () => {
  const reviewId = await planReview(`Convert review ${run}`, "Security");
  hasAlert(await submit(`/seu/seus/${t.seu.id}/reviews/${reviewId}/findings`, { severity: "High", title: `To convert ${run}` }), /raised\./);
  const finding = ((await findingsDB.findByReviewId(reviewId)).data ?? []).find((f) => f.title === `To convert ${run}`)!;
  assert.equal(finding.obligation_id, null);

  hasAlert(await submit(`/seu/seus/${t.seu.id}/findings/${finding.id}/convert`, { category: "Security" }), /Finding converted to an Obligation\./);
  const converted = (await findingsDB.findById(finding.id)).data!;
  assert.ok(converted.obligation_id, "the Finding is linked to the Obligation");
  assert.equal(converted.status, "Converted");
  const obligation = (await obligationsDB.findById(converted.obligation_id!)).data;
  assert.deepEqual([obligation?.category, obligation?.seu_id], ["Security", t.seu.id]);

  hasAlert(await submit(`/seu/seus/${t.seu.id}/findings/${finding.id}/convert`, { category: "Security" }), /Could not convert Finding: /);
  const ghost = await submit(`/seu/seus/${t.seu.id}/findings/${randomUUID()}/convert`);
  assert.ok(ghost.length > 0 && !ghost.some((a) => /converted to an Obligation/.test(a)), JSON.stringify(ghost));
});
