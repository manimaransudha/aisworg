// Authority Vocabulary admin pages (src/routes/seu/web/sdkAuthoring.ts) and the core functions behind them
// (src/routes/seu/core/authorityVocabulary.ts): the Nouns, Verbs and Mapping lists, and adding, retiring and changing the trigger of each.
//
//   - Every route is called over HTTP from the real app as root, which holds the transitiondefinition_define badge the routes require.
//     A POST answers with a redirect. The test fetches the Location as its own request and reads the flash message on that page.
//   - The vocabulary is global, so every Noun and Verb the tests add has a code that starts with "zz-" and carries the run tag. It sorts after
//     the seeded codes, and the test retires it before it ends. The only seeded Noun used is AttentionItem, as in
//     transition-definition-authoring.test.ts, with a new Verb of the test's own.
//   - The one Transition Definition the trigger test wires is deleted at the end.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { addTransitionDefinition } from "../src/routes/seu/core/transitionDefinitions.js";
import { listAuthorityNouns, listAuthorityVerbs, listAuthorityMapping, activeMappingByNoun } from "../src/routes/seu/core/authorityVocabulary.js";
import {
  ROOT_USER_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE,
  setWebBaseUrl, newSession, extractCsrf, getPage, postForm, pageAlerts, assertPageMatches, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const nounCode = `zz-noun-${run}`;
const verbCode = `zz-verb-${run}`;
const wiredVerbCode = `zz-wired-${run}`;
const wiredNoun = "AttentionItem";

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
  csrf = extractCsrf((await getPage(root, "/seu/authority/nouns")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

// The flash text as the user reads it: the page escapes the quotes of a message.
const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

// Posts a form and returns the page the redirect leads to, with the flash messages on it.
async function submit(path: string, fields: Record<string, string>): Promise<{ landedOn: string | null; alerts: string[] }> {
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

const noun = async (code: string) => (await listAuthorityNouns()).find((n) => n.code === code);
const verb = async (code: string) => (await listAuthorityVerbs()).find((v) => v.code === code);
const mapping = async (n: string, v: string) => (await listAuthorityMapping()).find((m) => m.nounCode === n && m.verbCode === v);

test("the Nouns, Verbs and Mapping pages list the vocabulary and narrow it by a search", async () => {
  const [anyNoun] = await listAuthorityNouns();
  const [anyVerb] = await listAuthorityVerbs();
  const [anyMapping] = await listAuthorityMapping();
  assert.ok(anyNoun && anyVerb && anyMapping, "the database holds a seeded vocabulary");

  const nouns = await getPage(root, `/seu/authority/nouns?q=${encodeURIComponent(anyNoun.code)}`);
  assert.equal(nouns.status, 200);
  assertPageMatches(nouns.html, new RegExp(anyNoun.code));

  const verbs = await getPage(root, `/seu/authority/verbs?q=${encodeURIComponent(anyVerb.code)}`);
  assert.equal(verbs.status, 200);
  assertPageMatches(verbs.html, new RegExp(anyVerb.code));

  const mappings = await getPage(root, `/seu/authority/mapping?q=${encodeURIComponent(anyMapping.nounCode)}`);
  assert.equal(mappings.status, 200);
  assertPageMatches(mappings.html, new RegExp(anyMapping.nounCode));
  assertPageMatches(mappings.html, new RegExp(anyMapping.verbCode));
});

test("a Noun, a Verb and a Mapping are added, listed and retired through the pages", async () => {
  const addedNoun = await submit("/seu/authority/nouns/add", { code: nounCode, label: "Zz test noun", description: "Added by the controller test." });
  assert.equal(addedNoun.landedOn, "/aisworg/seu/authority/nouns");
  assertAlert(addedNoun, new RegExp(`Noun "${nounCode}" added\\.`));
  assert.deepEqual(await noun(nounCode), { code: nounCode, label: "Zz test noun", description: "Added by the controller test.", isActive: true, verbCount: 0, transitionCount: 0 });

  const addedVerb = await submit("/seu/authority/verbs/add", { code: verbCode, label: "Zz test verb" });
  assert.equal(addedVerb.landedOn, "/aisworg/seu/authority/verbs");
  assertAlert(addedVerb, new RegExp(`Verb "${verbCode}" added\\.`));
  assert.deepEqual(await verb(verbCode), { code: verbCode, label: "Zz test verb", description: null, isActive: true, nounCount: 0 });

  const addedMapping = await submit("/seu/authority/mapping/add", { nounCode, verbCode, trigger: "governed" });
  assert.equal(addedMapping.landedOn, "/aisworg/seu/authority/mapping");
  assertAlert(addedMapping, new RegExp(`Mapping ${nounCode} → ${verbCode} added\\.`));
  const added = await mapping(nounCode, verbCode);
  assert.deepEqual([added?.isActive, added?.defaultTrigger, added?.trigger, added?.hasWiredTransitions], [true, "governed", "governed", false]);
  assert.deepEqual((await activeMappingByNoun())[nounCode], [verbCode]);
  assert.equal((await noun(nounCode))?.verbCount, 1);
  assert.equal((await verb(verbCode))?.nounCount, 1);

  const page = await getPage(root, `/seu/authority/mapping?q=${encodeURIComponent(nounCode)}`);
  assertPageMatches(page.html, new RegExp(verbCode));

  const retiredMapping = await submit("/seu/authority/mapping/retire", { nounCode, verbCode });
  assertAlert(retiredMapping, new RegExp(`Mapping ${nounCode} → ${verbCode} retired\\.`));
  assert.equal((await mapping(nounCode, verbCode))?.isActive, false);
  assert.equal((await activeMappingByNoun())[nounCode], undefined);

  const retiredNoun = await submit("/seu/authority/nouns/retire", { code: nounCode });
  assertAlert(retiredNoun, new RegExp(`Noun "${nounCode}" retired\\.`));
  assert.equal((await noun(nounCode))?.isActive, false);

  const retiredVerb = await submit("/seu/authority/verbs/retire", { code: verbCode });
  assertAlert(retiredVerb, new RegExp(`Verb "${verbCode}" retired\\.`));
  assert.equal((await verb(verbCode))?.isActive, false);

  // A retired Noun and a retired Verb are no longer offered for a Mapping.
  assertAlert(await submit("/seu/authority/mapping/add", { nounCode, verbCode }), new RegExp(`"${nounCode}" is not an active noun\\.`));
  const activeNoun = await submit("/seu/authority/nouns/add", { code: `zz-live-${run}`, label: "Zz live noun" });
  assertAlert(activeNoun, /added\./);
  assertAlert(await submit("/seu/authority/mapping/add", { nounCode: `zz-live-${run}`, verbCode }), new RegExp(`"${verbCode}" is not an active verb\\.`));
  assertAlert(await submit("/seu/authority/nouns/retire", { code: `zz-live-${run}` }), /retired\./);
});

test("adding a Noun, a Verb or a Mapping refuses a bad code, a blank label, a missing side, an inactive side and an unknown trigger", async () => {
  assertAlert(await submit("/seu/authority/nouns/add", { code: "1bad code", label: "Bad" }), /Noun code "1bad code" is not a valid code/);
  assertAlert(await submit("/seu/authority/nouns/add", { code: `zz-blank-${run}`, label: "  " }), /Label is required\./);
  assertAlert(await submit("/seu/authority/verbs/add", { code: "1bad code", label: "Bad" }), /Verb code "1bad code" is not a valid code/);
  assertAlert(await submit("/seu/authority/verbs/add", { code: `zz-blank-${run}`, label: "" }), /Label is required\./);
  assert.equal(await noun(`zz-blank-${run}`), undefined);
  assert.equal(await verb(`zz-blank-${run}`), undefined);

  assertAlert(await submit("/seu/authority/mapping/add", { nounCode: "", verbCode: "" }), /Both a noun and a verb are required\./);
  assertAlert(await submit("/seu/authority/mapping/add", { nounCode: wiredNoun, verbCode: `zz-unused-${run}`, trigger: "sometimes" }), /trigger must be "manual" or "governed", got "sometimes"/);
  assertAlert(await submit("/seu/authority/mapping/add", { nounCode: `zz-unknown-${run}`, verbCode: `zz-unknown-${run}` }), new RegExp(`"zz-unknown-${run}" is not an active noun\\.`));
  assertAlert(await submit("/seu/authority/mapping/add", { nounCode: wiredNoun, verbCode: `zz-unknown-${run}` }), new RegExp(`"zz-unknown-${run}" is not an active verb\\.`));
});

test("retiring a Noun, a Verb or a Mapping that does not exist says so", async () => {
  assertAlert(await submit("/seu/authority/nouns/retire", { code: `zz-missing-${run}` }), new RegExp(`No noun "zz-missing-${run}"\\.`));
  assertAlert(await submit("/seu/authority/verbs/retire", { code: `zz-missing-${run}` }), new RegExp(`No verb "zz-missing-${run}"\\.`));
  assertAlert(await submit("/seu/authority/mapping/retire", { nounCode: wiredNoun, verbCode: `zz-missing-${run}` }), new RegExp(`No mapping ${wiredNoun} → zz-missing-${run}\\.`));
});

test("editing the trigger of a Mapping sets it on the wired Transition Definitions and refuses an unknown trigger and a Mapping with no Transition", async () => {
  const fromState = `zz-from-${run}`;
  const toState = `zz-to-${run}`;
  try {
    assertAlert(await submit("/seu/authority/verbs/add", { code: wiredVerbCode, label: "Zz wired verb" }), /added\./);
    assertAlert(await submit("/seu/authority/mapping/add", { nounCode: wiredNoun, verbCode: wiredVerbCode, trigger: "manual" }), /added\./);

    assertAlert(await submit("/seu/authority/mapping/edit-trigger", { nounCode: wiredNoun, verbCode: wiredVerbCode, trigger: "sometimes" }), /trigger must be "manual" or "governed", got "sometimes"/);
    assertAlert(await submit("/seu/authority/mapping/edit-trigger", { nounCode: wiredNoun, verbCode: wiredVerbCode, trigger: "governed" }), new RegExp(`no transition uses ${wiredNoun} \\+ ${wiredVerbCode} yet — nothing to update`));
    assert.equal((await mapping(wiredNoun, wiredVerbCode))?.defaultTrigger, "manual", "a refused edit leaves the default as it was");

    const wired = await addTransitionDefinition({ entityType: wiredNoun, fromState, toState, verb: wiredVerbCode, policyCodes: [], authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
    assert.equal(wired.ok, true, wired.ok ? "" : wired.error);
    assert.equal((await transitionDefinitionsDB.find(wiredNoun, fromState, toState)).data?.trigger, "manual");

    const edited = await submit("/seu/authority/mapping/edit-trigger", { nounCode: wiredNoun, verbCode: wiredVerbCode, trigger: "governed" });
    assert.equal(edited.landedOn, "/aisworg/seu/authority/mapping");
    assertAlert(edited, new RegExp(`${wiredNoun} \\+ ${wiredVerbCode} trigger set to "governed"\\.`));
    assert.equal((await transitionDefinitionsDB.find(wiredNoun, fromState, toState)).data?.trigger, "governed", "the wired Transition Definition follows");
    const after = await mapping(wiredNoun, wiredVerbCode);
    assert.deepEqual([after?.defaultTrigger, after?.trigger, after?.hasWiredTransitions], ["governed", "governed", true]);
  } finally {
    await pool.query("DELETE FROM transition_definitions WHERE entity_type = $1 AND from_state = $2 AND to_state = $3", [wiredNoun, fromState, toState]);
    await submit("/seu/authority/mapping/retire", { nounCode: wiredNoun, verbCode: wiredVerbCode });
    await submit("/seu/authority/verbs/retire", { code: wiredVerbCode });
  }
});
