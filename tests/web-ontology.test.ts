// Ontology Management pages (src/routes/seu/web/ontology.ts): adding a concept, approving or rejecting it, composing a new one from an Active one, the
// lifecycle after approval (deprecate, retire, archive, quick retire), the metadata of a concept, and the lists that show them.
//
//   - Each route is called over HTTP from the real app as root, who adds to the Platform vocabulary. A POST answers with a redirect; the test reads the flash
//     message on the page it leads to and then reads the concept from the database.
//   - The concept type carries the run tag, so no real concept is touched. Concepts cannot be deleted; the ones that finish their lifecycle are Archived
//     or Retired by the test, as the authority vocabulary test retires its own.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import {
  ROOT_USER_ID, PLATFORM_TENANT_ID,
  setWebBaseUrl, newSession, extractCsrf, getPage, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const type = `zz-web-ontology-${run}`;
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
  csrf = extractCsrf((await getPage(root, "/seu/sdk/ontology")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

async function submit(pathName: string, fields: Record<string, string> = {}): Promise<string[]> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return pageAlerts(page.html).map(readable);
}

const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);
const concept = async (code: string) => (await ontologyDB.findLatestVersion(type, code, PLATFORM_TENANT_ID)).data;
const ref = (conceptCode: string) => ({ conceptType: type, code: conceptCode, tenantId: PLATFORM_TENANT_ID });

async function addApproved(code: string, label = `Label ${code}`): Promise<void> {
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code, defaultLabel: label }), new RegExp(`Concept "${code}" added\\.`));
  hasAlert(await submit("/seu/sdk/ontology/approvals/approve", ref(code)), new RegExp(`Concept "${code}" approved\\.`));
}

test("adding a concept makes a Draft with the text type and grouping given, and refuses a code that is not lowercase and hyphenated, a missing label and a Deliverable name", async () => {
  const code = `added-${run}`;
  hasAlert(
    await submit("/seu/sdk/ontology/add", { conceptType: type, code, defaultLabel: "Added concept", description: "What it means", textType: "text", uiGrouping: " Group A " }),
    new RegExp(`Concept "${code}" added\\.`)
  );
  const row = await concept(code);
  assert.deepEqual([row?.status, row?.default_label, row?.description, row?.text_type, row?.ui_grouping, row?.version], ["Draft", "Added concept", "What it means", "text", "Group A", "1.0.0"]);

  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code: "Bad Code", defaultLabel: "x" }), /code "Bad Code" must be lowercase, hyphenated, no spaces/);
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: "Bad Type", code: "fine", defaultLabel: "x" }), /concept type "Bad Type" must be lowercase, hyphenated, no spaces/);
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code: `nolabel-${run}`, defaultLabel: "  " }), /label is required/);
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: "deliverable-name", code: `zz-${run}`, defaultLabel: "x" }), /Deliverable names are authored at/);
  assert.equal(await concept(`nolabel-${run}`), null, "a refused add stores nothing");
});

test("a Draft waits on the approvals page until it is approved, which makes it Active and removes it from the page; adding the code again makes the next version", async () => {
  const code = `approved-${run}`;
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code, defaultLabel: "Awaiting approval" }), /added\./);

  const waiting = await getPage(root, `/seu/sdk/ontology/approvals?q=${encodeURIComponent(code)}`);
  assert.equal(waiting.status, 200);
  assertPageMatches(waiting.html, new RegExp(code));
  assertPageMatches(waiting.html, /Awaiting approval/);

  hasAlert(await submit("/seu/sdk/ontology/approvals/approve", ref(code)), new RegExp(`Concept "${code}" approved\\.`));
  assert.equal((await concept(code))?.status, "Active");
  assertPageDoesNotMatch((await getPage(root, "/seu/sdk/ontology/approvals")).html, new RegExp(`>\\s*${code}\\s*<`), "an approved concept leaves the approvals page");

  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code, defaultLabel: "Second version" }), /added\./);
  const second = await concept(code);
  assert.deepEqual([second?.status, second?.version, second?.default_label], ["Draft", "1.0.1", "Second version"], "the code already exists, so the add makes its next version");
  hasAlert(await submit("/seu/sdk/ontology/approvals/approve", ref(code)), /approved\./);
  assert.equal((await concept(code))?.status, "Active");
  const { data: first } = await ontologyDB.findConceptByCodeAndVersion(type, code, PLATFORM_TENANT_ID, "1.0.0");
  assert.equal(first?.status, "Deprecated", "approving the next version deprecates the one that was Active");
});

test("approving something that is not there or not a Draft is refused with the reason", async () => {
  hasAlert(await submit("/seu/sdk/ontology/approvals/approve", { conceptType: type, code: `zz-missing-${run}`, tenantId: PLATFORM_TENANT_ID }), new RegExp(`no such concept ${type}/zz-missing-${run} for that tenant`));
  const code = `already-active-${run}`;
  await addApproved(code);
  hasAlert(await submit("/seu/sdk/ontology/approvals/approve", ref(code)), new RegExp(`cannot move ${type}/${code} from Active to Active`));
});

test("a Draft is rejected with a comment, and stays a Draft; with no comment the rejection is refused", async () => {
  const code = `rejected-${run}`;
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code, defaultLabel: "To reject" }), /added\./);
  hasAlert(await submit("/seu/sdk/ontology/approvals/reject", { ...ref(code), comment: "  " }), new RegExp(`cannot move ${type}/${code} from Draft to Draft`));
  hasAlert(await submit("/seu/sdk/ontology/approvals/reject", { ...ref(code), comment: "The label says nothing." }), new RegExp(`Concept "${code}" rejected\\.`));
  assert.equal((await concept(code))?.status, "Draft");
  assertPageMatches((await getPage(root, `/seu/sdk/ontology/approvals?q=${encodeURIComponent(code)}`)).html, new RegExp(code), "a rejected concept still waits for approval");
});

test("an Active concept moves down its lifecycle one step at a time, and a step the state does not allow is refused", async () => {
  const code = `lifecycle-${run}`;
  await addApproved(code);
  hasAlert(await submit("/seu/sdk/ontology/retire", ref(code)), new RegExp(`cannot move ${type}/${code} from Active to Retired`));
  hasAlert(await submit("/seu/sdk/ontology/deprecate", ref(code)), new RegExp(`Concept "${code}" deprecated\\.`));
  assert.equal((await concept(code))?.status, "Deprecated");
  hasAlert(await submit("/seu/sdk/ontology/retire", ref(code)), new RegExp(`Concept "${code}" retired\\.`));
  assert.equal((await concept(code))?.status, "Retired");
  hasAlert(await submit("/seu/sdk/ontology/archive", ref(code)), new RegExp(`Concept "${code}" archived\\.`));
  assert.equal((await concept(code))?.status, "Archived");

  hasAlert(await submit("/seu/sdk/ontology/deprecate", { conceptType: type, code: `zz-missing-${run}`, tenantId: PLATFORM_TENANT_ID }), /no such concept .* for that tenant/);
  const draft = `lifecycle-draft-${run}`;
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code: draft, defaultLabel: "Draft only" }), /added\./);
  hasAlert(await submit("/seu/sdk/ontology/archive", ref(draft)), new RegExp(`cannot move ${type}/${draft} from Draft to Archived`));
});

test("quick retire takes an Active concept straight to Retired", async () => {
  const code = `quick-${run}`;
  await addApproved(code);
  hasAlert(await submit("/seu/sdk/ontology/quick-retire", ref(code)), new RegExp(`Concept "${code}" retired\\.`));
  assert.equal((await concept(code))?.status, "Retired");
  hasAlert(await submit("/seu/sdk/ontology/quick-retire", ref(`zz-missing-${run}`)), /no such concept .* for that tenant/);
});

test("the metadata of an Active concept is updated, and a concept that is not Active cannot be", async () => {
  const code = `meta-${run}`;
  await addApproved(code);
  assert.deepEqual([(await concept(code))?.text_type, (await concept(code))?.ui_grouping], ["markdown", null]);
  hasAlert(await submit("/seu/sdk/ontology/update-meta", { ...ref(code), textType: "text", uiGrouping: " Group B " }), new RegExp(`Concept "${code}" updated\\.`));
  assert.deepEqual([(await concept(code))?.text_type, (await concept(code))?.ui_grouping], ["text", "Group B"]);
  hasAlert(await submit("/seu/sdk/ontology/update-meta", { ...ref(code), textType: "anything", uiGrouping: "  " }), /updated\./);
  assert.deepEqual([(await concept(code))?.text_type, (await concept(code))?.ui_grouping], ["markdown", null], "any text type but text is markdown, and a blank grouping is none");

  const draft = `meta-draft-${run}`;
  hasAlert(await submit("/seu/sdk/ontology/add", { conceptType: type, code: draft, defaultLabel: "Draft" }), /added\./);
  hasAlert(await submit("/seu/sdk/ontology/update-meta", { ...ref(draft), textType: "text" }), new RegExp(`no such concept ${type}/${draft} for that tenant`));
});

test("a concept is composed from an Active one by specialization, which inherits its label, or by override, which makes its next version; both refuse what they cannot compose", async () => {
  const source = `compose-source-${run}`;
  await addApproved(source, "Source label");
  const sourceRow = await concept(source);
  assert.ok(sourceRow);

  const inherited = `compose-inherited-${run}`;
  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: inherited, strategy: "specialization", sourceConceptId: sourceRow.id }), new RegExp(`Concept "${inherited}" composed\\.`));
  const inheritedRow = await concept(inherited);
  assert.deepEqual([inheritedRow?.status, inheritedRow?.default_label, inheritedRow?.composition_strategy, inheritedRow?.composition_sources], ["Draft", "Source label", "specialization", [{ conceptId: sourceRow.id, code: source }]]);

  const renamed = `compose-renamed-${run}`;
  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: renamed, strategy: "specialization", sourceConceptId: sourceRow.id, defaultLabel: " Own label ", description: "Own text" }), /composed\./);
  assert.deepEqual([(await concept(renamed))?.default_label, (await concept(renamed))?.description], ["Own label", "Own text"]);

  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: source, strategy: "override", defaultLabel: "Overridden label" }), new RegExp(`Concept "${source}" composed\\.`));
  const overridden = await concept(source);
  assert.deepEqual([overridden?.version, overridden?.status, overridden?.default_label, overridden?.composition_strategy], ["1.0.1", "Draft", "Overridden label", "override"]);

  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: `compose-none-${run}`, strategy: "override" }), /Override requires an existing concept/);
  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: `compose-nosource-${run}`, strategy: "specialization" }), /Specialization requires a source concept to specialize from\./);
  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: `compose-nosource-${run}`, strategy: "specialization", sourceConceptId: randomUUID() }), /composition source concept has no Active version\./);
  hasAlert(await submit("/seu/sdk/ontology/compose", { conceptType: type, code: "Bad Code", strategy: "specialization", sourceConceptId: sourceRow.id }), /code "Bad Code" must be lowercase/);
});

test("the Active concepts of a type are listed and searched, and the metadata page lists every Active concept with its grouping", async () => {
  const code = `listed-${run}`;
  await addApproved(code, "Listed concept");
  hasAlert(await submit("/seu/sdk/ontology/update-meta", { ...ref(code), textType: "markdown", uiGrouping: `Listed group ${run}` }), /updated\./);

  const index = await getPage(root, `/seu/sdk/ontology?type=${encodeURIComponent(type)}`);
  assert.equal(index.status, 200);
  assertPageMatches(index.html, new RegExp(code));
  assertPageMatches(index.html, /Listed concept/);
  const searched = await getPage(root, `/seu/sdk/ontology?type=${encodeURIComponent(type)}&q=${encodeURIComponent("listed concept")}`);
  assertPageMatches(searched.html, new RegExp(code));

  const metadata = await getPage(root, `/seu/sdk/ontology/metadata?q=${encodeURIComponent(code)}`);
  assert.equal(metadata.status, 200);
  assertPageMatches(metadata.html, new RegExp(code));
  assertPageMatches(metadata.html, new RegExp(`Listed group ${run}`));
  assert.equal((await getPage(root, `/seu/sdk/ontology/metadata?q=${encodeURIComponent(`${code}-no-such`)}`)).status, 200);
});
