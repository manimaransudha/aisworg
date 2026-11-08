// Transition Definition admin pages (src/routes/seu/web/sdkAuthoring.ts) and the core functions behind them
// (src/routes/seu/core/transitionDefinitions.ts): the list on the Transition Definition authoring page, the detail and edit pages, and adding,
// updating and retiring an edge.
//
//   - Every route is called over HTTP from the real app as root, which holds the transitiondefinition_define badge the routes require.
//     A POST answers with a redirect. The test fetches the Location as its own request and reads the flash message on that page.
//   - The test adds one edge of its own: noun AttentionItem, a new Verb with the run tag, and two states with the run tag. The Verb and its Mapping
//     are set up through the core functions (authority-vocabulary-controller.test.ts covers their pages). The edge is deleted and the Verb and
//     Mapping retired when the file ends.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { addVerb, addMapping, retireMapping, retireVerb } from "../src/routes/seu/core/authorityVocabulary.js";
import { listRequirablePolicyCodes } from "../src/routes/seu/core/transitionDefinitions.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE,
  setWebBaseUrl, newSession, extractCsrf, getPage, postForm, pageAlerts, assertPageMatches, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const noun = "AttentionItem";
const verb = `zz-edge-${run}`;
const fromState = `zz-from-${run}`;
const toState = `zz-to-${run}`;
const indexPath = "/seu/sdk/transition-definition-authoring";
const indexLocation = `/aisworg${indexPath}`;

let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let policyCode: string;
let edgeId: string;

before(async () => {
  const added = await addVerb(verb, "Zz edge verb", null, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  assert.equal(added.ok, true, added.ok ? "" : added.error);
  const mapped = await addMapping(noun, verb, "governed", ROOT_ACTOR_ID, ROOT_ACTOR_BADGE);
  assert.equal(mapped.ok, true, mapped.ok ? "" : mapped.error);
  [policyCode] = await listRequirablePolicyCodes();
  assert.ok(policyCode, "the database holds an Active Platform Policy Definition");

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(root, "/seu/authority/nouns")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
  await pool.query("DELETE FROM transition_definitions WHERE entity_type = $1 AND from_state = $2 AND to_state = $3", [noun, fromState, toState]);
  await retireMapping(noun, verb);
  await retireVerb(verb);
});

// The flash text as the user reads it: the page escapes the quotes of a message.
const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

async function submit(path: string, fields: Record<string, string | string[]>): Promise<{ landedOn: string | null; alerts: string[] }> {
  const posted = await postForm(root, path, csrf, fields);
  assert.equal(posted.status, 302, `POST ${path}`);
  assert.ok(posted.location, "the POST answered with a redirect");
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return { landedOn: posted.location, alerts: pageAlerts(page.html).map(readable) };
}

function assertAlert(result: { alerts: string[] }, pattern: RegExp): void {
  assert.ok(result.alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(result.alerts)}`);
}

const addFields = (overrides: Record<string, string | string[]> = {}) => ({ entityType: noun, fromState, toState, verb, ...overrides });

test("adding an edge refuses missing fields, equal states, an inactive Noun, a Verb the Noun does not allow and a Policy that is not Active", async () => {
  assertAlert(await submit("/seu/authority/transition-definitions/add", addFields({ toState: "" })), /Noun, from-state, to-state and verb are all required\./);
  assertAlert(await submit("/seu/authority/transition-definitions/add", addFields({ toState: fromState })), /From-state and to-state must differ\./);
  assertAlert(await submit("/seu/authority/transition-definitions/add", addFields({ entityType: `zz-unknown-${run}` })), new RegExp(`"zz-unknown-${run}" is not an active noun\\.`));
  assertAlert(await submit("/seu/authority/transition-definitions/add", addFields({ verb: `zz-not-mapped-${run}` })), new RegExp(`Verb "zz-not-mapped-${run}" is not allowed on ${noun}\\. Add it on the Mapping tab first\\.`));
  const unknownPolicy = await submit("/seu/authority/transition-definitions/add", addFields({ policyCodes: [policyCode, `zz-no-policy-${run}`] }));
  assert.equal(unknownPolicy.landedOn, indexLocation);
  assertAlert(unknownPolicy, new RegExp(`No Active Policy Definition for: zz-no-policy-${run}\\.`));
  assert.equal((await transitionDefinitionsDB.find(noun, fromState, toState)).data, null, "a refused add stores nothing");
});

test("an edge is added with the Mapping's trigger and its Policy, and the list page shows it", async () => {
  const added = await submit("/seu/authority/transition-definitions/add", addFields({ policyCodes: policyCode }));
  assert.equal(added.landedOn, indexLocation);
  assertAlert(added, new RegExp(`Transition ${noun} ${fromState} → ${toState} added\\.`));

  const { data: row } = await transitionDefinitionsDB.find(noun, fromState, toState);
  assert.ok(row, "the edge is stored");
  assert.deepEqual([row.verb, row.trigger, row.is_active, row.required_policy_ids.length], [verb, "governed", true, 1]);
  edgeId = row.id;

  const page = await getPage(root, `${indexPath}?q=${encodeURIComponent(fromState)}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(fromState));
  assertPageMatches(page.html, new RegExp(toState));
  assertPageMatches(page.html, new RegExp(`${noun.toLowerCase()}_${verb}`), "the noun_verb badge of the edge");
  assertPageMatches(page.html, new RegExp(`/aisworg/seu/authority/transition-definitions/${edgeId}`), "the row links to its detail page");

  const none = await getPage(root, `${indexPath}?q=${encodeURIComponent(`${fromState}-no-such-edge`)}`);
  assert.equal(none.status, 200);
  assertPageMatches(none.html, /No definitions match your search\./);
});

test("the detail page shows the edge, and an id that does not exist is not found", async () => {
  const page = await getPage(root, `/seu/authority/transition-definitions/${edgeId}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(`${noun}: ${fromState} → ${toState}`));
  assertPageMatches(page.html, new RegExp(`<code>${verb}</code>`));
  assertPageMatches(page.html, new RegExp(`<code class="text-primary">${noun.toLowerCase()}_${verb}</code>`));
  assertPageMatches(page.html, new RegExp(`<code class="me-1">${policyCode}</code>`), "the Policy the edge requires");
  assertPageMatches(page.html, />Active</);

  assert.equal((await getPage(root, `/seu/authority/transition-definitions/${randomUUID()}`)).status, 404);
  assert.equal((await getPage(root, `/seu/authority/transition-definitions/${randomUUID()}/edit`)).status, 404);
});

test("the edit page offers the Policies, and an update stores the obligation, the category and the chosen Policies", async () => {
  const edit = await getPage(root, `/seu/authority/transition-definitions/${edgeId}/edit`);
  assert.equal(edit.status, 200);
  assertPageMatches(edit.html, new RegExp(`Edit — ${noun}: ${fromState} → ${toState}`));
  assertPageMatches(edit.html, new RegExp(`<option value="${policyCode}" selected>`), "the edge's own Policy is selected");

  const updated = await submit(`/seu/authority/transition-definitions/${edgeId}/update`, { createsObligation: "  ", category: ` zz-category-${run} `, policyCodes: [] });
  assert.equal(updated.landedOn, `/aisworg/seu/authority/transition-definitions/${edgeId}`);
  assertAlert(updated, /Transition definition updated\./);
  const { data: row } = await transitionDefinitionsDB.find(noun, fromState, toState);
  assert.deepEqual([row?.creates_obligation, row?.category, row?.required_policy_ids.length], [null, `zz-category-${run}`, 0], "blank text is stored as none, and the Policy is cleared");

  const refused = await submit(`/seu/authority/transition-definitions/${edgeId}/update`, { category: "unchanged", policyCodes: [`zz-no-policy-${run}`] });
  assertAlert(refused, new RegExp(`No Active Policy Definition for: zz-no-policy-${run}\\.`));
  assert.equal((await transitionDefinitionsDB.find(noun, fromState, toState)).data?.category, `zz-category-${run}`, "a refused update stores nothing");

  // An id that does not exist redirects to a detail page that is not found, so only the redirect is read, and the flash is cleared by the next page.
  const missingId = randomUUID();
  const missing = await postForm(root, `/seu/authority/transition-definitions/${missingId}/update`, csrf, { policyCodes: [] });
  assert.equal(missing.status, 302);
  assert.equal(missing.location, `/aisworg/seu/authority/transition-definitions/${missingId}`);
  await getPage(root, "/seu/authority/nouns");
});

test("the cache reload and the retire work, and retiring an id that does not exist says so", async () => {
  assertAlert(await submit("/seu/authority/transition-definitions/refresh-cache", {}), /Transition definitions cache reloaded\./);

  const retired = await submit("/seu/authority/transition-definitions/retire", { id: edgeId });
  assert.equal(retired.landedOn, indexLocation);
  assertAlert(retired, /Transition definition retired\./);
  const { data: row } = await transitionDefinitionsDB.find(noun, fromState, toState);
  assert.equal(row?.is_active, false);

  const detail = await getPage(root, `/seu/authority/transition-definitions/${edgeId}`);
  assertPageMatches(detail.html, />Retired( ·|<)/, "the badge shows the edge as Retired, with its retire time");

  assertAlert(await submit("/seu/authority/transition-definitions/retire", { id: randomUUID() }), /No such transition definition\./);
});
