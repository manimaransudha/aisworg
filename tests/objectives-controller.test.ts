// Objective web controller routes behind src/routes/seu/core/objectives.ts: the tree children, the Rejected list, the search list, delete and
// the subtree retire (src/routes/seu/web/objectives.ts).
//
//   - Each route is called over HTTP from the real app, so the route_authority gate, the tenant scope loader, the controller and the EJS view run
//     together with the core function. The viewer is root, which holds every Objective badge. The badge rules themselves are covered by
//     route-authority-gate.test.ts.
//   - A POST answers with a redirect. The test reads the Location, fetches it as its own request and reads the flash message on that page.
//   - Every Objective is requested by root, with a statement that is unique per run. Rows are not deleted, as in the other tests that create Objectives.
//   - The core refusals that no form can send are covered by objectives-core.test.ts.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID, createActiveObjective, transitionObjective,
  setWebBaseUrl, newSession, extractCsrf, getPage, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let counter = 0;
const statement = (label: string) => `objectives-controller ${run} ${label} ${++counter}`;

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
  csrf = extractCsrf((await getPage(root, "/seu/objectives")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

const defined = (label: string, tier: "Strategic" | "Operational" | "Engineering", parentObjectiveId?: string) =>
  createObjective({ statement: statement(label), requiredCapabilityCodes: [], tier, parentObjectiveId, requestedBy: ROOT_ACTOR_ID }).then((r) => r.objective);

const active = (label: string, tier: "Strategic" | "Operational" | "Engineering", parentObjectiveId?: string) =>
  createActiveObjective({ statement: statement(label), requiredCapabilityCodes: [], tier, parentObjectiveId, requestedBy: ROOT_ACTOR_ID }).then((r) => r.objective);

// The page a redirect leads to. Its path starts with /aisworg, which the base URL of the helpers already carries.
async function followRedirect(location: string | null): Promise<{ path: string; html: string; alerts: string[] }> {
  assert.ok(location, "the POST answered with a redirect");
  const path = location.replace(/^\/aisworg/, "");
  const page = await getPage(root, path);
  assert.equal(page.status, 200, `GET ${path}`);
  return { path: location, html: page.html, alerts: pageAlerts(page.html) };
}

test("GET /objectives/:id/children lists the direct children of the node at the requested depth, and clamps the depth", async () => {
  const parent = await defined("tree-root", "Strategic");
  const operational = await defined("tree-operational", "Operational", parent.id);
  const engineering = await defined("tree-engineering", "Engineering", operational.id);

  const page = await getPage(root, `/seu/objectives/${parent.id}/children`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(operational.statement));
  assertPageDoesNotMatch(page.html, new RegExp(engineering.statement), "a grandchild is loaded only when its parent is expanded");
  assertPageMatches(page.html, new RegExp(`data-id="${operational.id}" data-depth="1"`));

  assertPageMatches((await getPage(root, `/seu/objectives/${parent.id}/children?depth=99`)).html, new RegExp(`data-id="${operational.id}" data-depth="20"`), "the depth stops at 20");
  assertPageMatches((await getPage(root, `/seu/objectives/${parent.id}/children?depth=-3`)).html, new RegExp(`data-id="${operational.id}" data-depth="0"`), "the depth does not go below 0");
  assertPageMatches((await getPage(root, `/seu/objectives/${parent.id}/children?depth=x`)).html, new RegExp(`data-id="${operational.id}" data-depth="1"`), "a depth that is not a number is 1");
});

test("GET /objectives?view=rejected lists a rejected Objective with the comment that rejected it", async () => {
  const objective = await active("rejected", "Strategic");
  const comment = `Rejected in run ${run} because the scope is too wide.`;
  const rejected = await transitionObjective({ objectiveId: objective.id, targetState: "Reject", actorId: ROOT_ACTOR_ID, comment });
  assert.equal(rejected.ok, true);

  const page = await getPage(root, "/seu/objectives?view=rejected");
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(objective.statement));
  assertPageMatches(page.html, new RegExp(comment.replace(/\./g, "\\.")));
  assertPageMatches(page.html, /state-badge state-Reject/);
});

test("GET /objectives?q=… finds the Objectives whose statement matches, each with the breadcrumb of its ancestors", async () => {
  const token = `search${run}`;
  const parent = await createObjective({ statement: `${token} parent`, requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID }).then((r) => r.objective);
  const child = await createObjective({ statement: `${token} child`, requiredCapabilityCodes: [], tier: "Operational", parentObjectiveId: parent.id, requestedBy: ROOT_ACTOR_ID }).then((r) => r.objective);

  const page = await getPage(root, `/seu/objectives?q=${token}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(child.statement));
  assertPageMatches(page.html, new RegExp(parent.statement));
  assertPageMatches(page.html, new RegExp(`<div class="breadcrumb-path mb-1">\\s*<a href="/aisworg/seu/objectives/${parent.id}"`), "the child's hit carries the link to its parent");

  const none = await getPage(root, `/seu/objectives?q=${token}-no-such-objective`);
  assert.equal(none.status, 200);
  assertPageDoesNotMatch(none.html, new RegExp(child.statement));
});

test("POST /objectives/:id/delete deletes a Defined leaf and returns to its parent, or to the list when it has none", async () => {
  const parent = await defined("delete-parent", "Strategic");
  const leaf = await defined("delete-leaf", "Operational", parent.id);

  const deleted = await postForm(root, `/seu/objectives/${leaf.id}/delete`, csrf, {});
  assert.equal(deleted.status, 302);
  const landed = await followRedirect(deleted.location);
  assert.equal(landed.path, `/aisworg/seu/objectives/${parent.id}`);
  assert.ok(landed.alerts.some((a) => /Objective deleted\./.test(a)), JSON.stringify(landed.alerts));
  assert.equal((await objectivesDB.findById(leaf.id)).data, null);

  const lonely = await defined("delete-root", "Strategic");
  const deletedRoot = await postForm(root, `/seu/objectives/${lonely.id}/delete`, csrf, {});
  const landedOnList = await followRedirect(deletedRoot.location);
  assert.equal(landedOnList.path, "/aisworg/seu/objectives");
  assert.ok(landedOnList.alerts.some((a) => /Objective deleted\./.test(a)), JSON.stringify(landedOnList.alerts));
  assert.equal((await objectivesDB.findById(lonely.id)).data, null);
});

test("POST /objectives/:id/delete refuses an Objective that is not Defined and one that has children, and keeps both", async () => {
  const notDefined = await active("delete-active", "Strategic");
  const refusedActive = await followRedirect((await postForm(root, `/seu/objectives/${notDefined.id}/delete`, csrf, {})).location);
  assert.equal(refusedActive.path, `/aisworg/seu/objectives/${notDefined.id}`);
  assert.ok(refusedActive.alerts.some((a) => /only a Defined Objective can be deleted \(status: Active\)/.test(a)), JSON.stringify(refusedActive.alerts));
  assert.ok((await objectivesDB.findById(notDefined.id)).data);

  const parent = await defined("delete-with-children", "Strategic");
  await defined("delete-its-child", "Operational", parent.id);
  const refusedParent = await followRedirect((await postForm(root, `/seu/objectives/${parent.id}/delete`, csrf, {})).location);
  assert.equal(refusedParent.path, `/aisworg/seu/objectives/${parent.id}`);
  assert.ok(refusedParent.alerts.some((a) => /cannot delete an Objective that has children/.test(a)), JSON.stringify(refusedParent.alerts));
  assert.ok((await objectivesDB.findById(parent.id)).data);
});

test("POST /objectives/:id/retire retires the Objective and its Active descendants, and reports the ones it skipped", async () => {
  const top = await active("retire-top", "Strategic");
  const middle = await active("retire-middle", "Operational", top.id);
  const notActive = await defined("retire-defined-leaf", "Engineering", middle.id);

  const retired = await followRedirect((await postForm(root, `/seu/objectives/${top.id}/retire`, csrf, {})).location);
  assert.equal(retired.path, `/aisworg/seu/objectives/${top.id}`);
  assert.ok(retired.alerts.some((a) => /Retired 2 Objective\(s\); skipped 1 \(not Active\)\./.test(a)), JSON.stringify(retired.alerts));
  assert.equal((await objectivesDB.findById(top.id)).data?.status, "Retired");
  assert.equal((await objectivesDB.findById(middle.id)).data?.status, "Retired");
  assert.equal((await objectivesDB.findById(notActive.id)).data?.status, "Defined", "a Defined descendant is left as it was");

  const alone = await active("retire-alone", "Strategic");
  const retiredAlone = await followRedirect((await postForm(root, `/seu/objectives/${alone.id}/retire`, csrf, {})).location);
  assert.ok(retiredAlone.alerts.some((a) => /Retired 1 Objective\(s\)\./.test(a)), JSON.stringify(retiredAlone.alerts));
  assert.equal((await objectivesDB.findById(alone.id)).data?.status, "Retired");
});

test("POST /objectives/:id/retire refuses an Objective that is not Active", async () => {
  const notActive = await defined("retire-refused", "Strategic");
  const refused = await followRedirect((await postForm(root, `/seu/objectives/${notActive.id}/retire`, csrf, {})).location);
  assert.equal(refused.path, `/aisworg/seu/objectives/${notActive.id}`);
  assert.ok(refused.alerts.some((a) => /only an Active Objective can be retired \(status: Defined\)/.test(a)), JSON.stringify(refused.alerts));
  assert.equal((await objectivesDB.findById(notActive.id)).data?.status, "Defined");
});
