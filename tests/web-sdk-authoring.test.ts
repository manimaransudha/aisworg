// SDK authoring pages (src/routes/seu/web/sdkAuthoring.ts): the list of drafts, the new-draft form, creating a draft from a posted form, editing and saving it,
// importing JSON, composing, publishing it along its lifecycle to Active, and moving an Active row by a transition. The pages are shared by every kind of
// definition; the test runs them for the Capability Definition, whose schema is small, so each field of the form is a field the test posts and reads back.
//
//   - Each route is called over HTTP from the real app as root. A POST answers with a redirect; the test reads the flash message on the page it leads to, then
//     reads the Capability Definition from the database.
//   - The Capability code is added to the Ontology and approved first, so the draft can be published; a draft whose code is not in the Ontology is refused.
//     The codes carry the run tag and the Capability Definition stays in the database, as the Ontology concept does.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { addConcept, approveConcept, listConceptsForType } from "../src/routes/seu/core/ontology.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { PLATFORM_TENANT_ID, ROOT_USER_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const slug = "capability-authoring";
const indexPath = `/seu/sdk/${slug}`;
let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let category: string;
let roleName: string;
let workType: string;

before(async () => {
  const first = async (type: string) => {
    const [concept] = await listConceptsForType(type, { isRoot: true, tenantId: null }, false);
    assert.ok(concept, `the Ontology holds a ${type} concept`);
    return concept.code;
  };
  category = await first("category:capability");
  roleName = await first("role-name");
  workType = await first("worktype-name");

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
const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<{ alerts: string[]; location: string }> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return { alerts: pageAlerts(page.html).map(readable), location: posted.location };
}

// Adds a Capability code to the Ontology and approves it, so a draft that uses it can be published.
async function approvedCode(label: string): Promise<string> {
  const code = `zz-web-${label}-${run}`;
  const actor = { isRoot: true, tenantId: PLATFORM_TENANT_ID, actorId: ROOT_ACTOR_ID, actorBadge: ROOT_ACTOR_BADGE };
  await addConcept({ conceptType: "capability-name", code, defaultLabel: `Web ${label} capability` , targetTenantId: PLATFORM_TENANT_ID }, actor);
  await approveConcept("capability-name", code, PLATFORM_TENANT_ID, actor);
  return code;
}

const formFor = (code: string, overrides: Record<string, string | string[]> = {}): Record<string, string | string[]> => ({
  code, defaultLabel: `Label of ${code}`, description: "What the web test covers", category, "roles[0][name]": roleName, "roles[0][worktypes]": [workType], ...overrides,
});

const draftIdOf = (location: string) => /\/seu\/sdk\/capability-authoring\/([0-9a-f-]{36})$/.exec(location)?.[1];
const row = async (id: string) => (await capabilityDefinitionsDB.findById(id)).data!;

async function newDraft(label: string, overrides: Record<string, string | string[]> = {}): Promise<{ id: string; code: string }> {
  const code = await approvedCode(label);
  const created = await submit(`/seu/sdk/${slug}`, formFor(code, overrides));
  hasAlert(created.alerts, /Started a new Capability draft\./);
  const id = draftIdOf(created.location);
  assert.ok(id, `the create leads to the draft's page, got ${created.location}`);
  return { id, code };
}

test("the new-draft form lists the fields of the schema, and a draft is created from the posted form with its roles and work types", async () => {
  const form = await getPage(root, `${indexPath}/new`);
  assert.equal(form.status, 200);
  for (const field of ["code", "defaultLabel", "category", "description"]) assertPageMatches(form.html, new RegExp(`name="${field}"`), `the form has the ${field} field`);

  const { id, code } = await newDraft("created");
  const created = await row(id);
  assert.deepEqual([created.code, created.default_label, created.description, created.category], [code, `Label of ${code}`, "What the web test covers", category]);
  assert.deepEqual(created.roles, [{ name: roleName, worktypes: [workType] }]);

  const page = await getPage(root, `${indexPath}/${id}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(`Label of ${code}`), "the draft's page shows its content");
});

test("a draft is refused when its required fields are missing, and nothing is created", async () => {
  const code = `zz-web-refused-${run}`;
  const noLabel = await submit(`/seu/sdk/${slug}`, formFor(code, { defaultLabel: "" }));
  assert.ok(noLabel.alerts.length > 0 && !noLabel.alerts.some((a) => /Started a new/.test(a)), JSON.stringify(noLabel.alerts));
  assert.match(noLabel.alerts.join(" "), /defaultLabel/);
  const noCode = await submit(`/seu/sdk/${slug}`, formFor("", {}));
  assert.match(noCode.alerts.join(" "), /code/);
  const { data } = await capabilityDefinitionsDB.findByCodeAndVersion(code, "1.0.0", PLATFORM_TENANT_ID);
  assert.equal(data, null);
});

test("the list shows the drafts and searches them by code, and a draft that does not exist leads back to the list", async () => {
  const { code } = await newDraft("listed");
  const other = await newDraft("hidden");
  const page = await getPage(root, `${indexPath}?q=${encodeURIComponent(code)}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(code));
  assertPageDoesNotMatch(page.html, new RegExp(other.code), "the search narrows the drafts");

  const missing = await getRedirect(root, `${indexPath}/${randomUUID()}`);
  assert.equal(missing.status, 302);
  const alerts = pageAlerts((await getPage(root, indexPath)).html).map(readable);
  assert.ok(alerts.length > 0, "the list says why the draft was not shown");
});

test("a draft is saved with the content posted, and a save that leaves a required field empty is refused and changes nothing", async () => {
  const { id, code } = await newDraft("saved");
  const saved = await submit(`/seu/sdk/${slug}/${id}/save`, formFor(code, { defaultLabel: `Saved label ${run}`, description: "Saved description" }));
  assert.ok(saved.alerts.some((a) => /^Draft saved/.test(a)), JSON.stringify(saved.alerts));
  const after = await row(id);
  assert.deepEqual([after.default_label, after.description], [`Saved label ${run}`, "Saved description"]);

  const incomplete = await submit(`/seu/sdk/${slug}/${id}/save`, formFor(code, { defaultLabel: "", description: "Should not be kept" }));
  assert.deepEqual(incomplete.alerts, ["defaultLabel is required"]);
  assert.deepEqual([(await row(id)).default_label, (await row(id)).description], [`Saved label ${run}`, "Saved description"]);
});

test("JSON is imported into a draft when it is valid against the schema; empty text, text that is not JSON and JSON that breaks the schema are refused", async () => {
  const { id, code } = await newDraft("imported");
  const importPath = `/seu/sdk/${slug}/${id}/import`;
  hasAlert((await submit(importPath, { importedJson: "  " })).alerts, /Paste a JSON document to import\./);
  hasAlert((await submit(importPath, { importedJson: "{ not json" })).alerts, /Invalid JSON: /);
  hasAlert((await submit(importPath, { importedJson: JSON.stringify({ code }) })).alerts, /Import rejected — invalid against the Capability schema: .*defaultLabel/);
  assert.equal((await row(id)).default_label, `Label of ${code}`, "a refused import changes nothing");

  hasAlert((await submit(importPath, { importedJson: JSON.stringify({ code, defaultLabel: `Imported label ${run}`, category, description: "Imported" }) })).alerts, /^Imported\.$/);
  assert.deepEqual([(await row(id)).default_label, (await row(id)).description], [`Imported label ${run}`, "Imported"]);
});

test("composition is not offered for a Capability Definition", async () => {
  const { id } = await newDraft("composed");
  hasAlert((await submit(`/seu/sdk/${slug}/${id}/compose`)).alerts, /composition is not yet available for "Capability"/);
});

// Takes a draft along the transitions root is offered, one at a time, as far as Active.
async function moveToActive(id: string): Promise<string[]> {
  const alerts: string[] = [];
  for (let step = 0; step < 6; step++) {
    const status = (await row(id)).status;
    if (status === "Active") break;
    const next = (await nextActionsFor("Capability", status, ROOT_ACTOR_ID)).find((a) => !/deprecate|retire|archive|reject/i.test(a.verb));
    if (!next) break;
    const result = await submit(`/seu/sdk/${slug}/${id}/transition`, { targetState: next.toState, comment: "Moved by the web test" });
    alerts.push(...result.alerts);
    if ((await row(id)).status === status) break;
  }
  return alerts;
}

test("a draft whose code the Ontology holds is moved to Active by the transitions it is offered, and an Active row is moved on; publishing from the first state is refused", async () => {
  const { id } = await newDraft("published");
  hasAlert((await submit(`/seu/sdk/${slug}/${id}/publish`)).alerts, /No governed publish is available from Defined\./);

  const alerts = await moveToActive(id);
  assert.equal((await row(id)).status, "Active", `the draft reaches Active: ${JSON.stringify(alerts)}`);
  assert.ok(alerts.some((a) => /^Moved to "Active"\./.test(a)));

  const offered = await nextActionsFor("Capability", "Active", ROOT_ACTOR_ID);
  const next = offered[0];
  assert.ok(next, "root may move an Active Capability Definition");
  hasAlert((await submit(`/seu/sdk/${slug}/${id}/transition`, { targetState: next.toState, comment: "Moved on by the web test" })).alerts, new RegExp(`^Moved to "${next.toState}"\\.`));
  assert.equal((await row(id)).status, next.toState);
});

test("a draft whose code the Ontology does not hold is held back from Active", async () => {
  const unapproved = await submit(`/seu/sdk/${slug}`, formFor(`zz-web-unapproved-${run}`));
  const unapprovedId = draftIdOf(unapproved.location);
  assert.ok(unapprovedId);
  const alerts = await moveToActive(unapprovedId);
  assert.notEqual((await row(unapprovedId)).status, "Active", `a code the Ontology does not hold is not published: ${JSON.stringify(alerts)}`);
});

test("a transition is refused with no target or a target the state has no governed transition to, and publishing a draft that does not exist leads back to the list", async () => {
  const { id } = await newDraft("transition");
  hasAlert((await submit(`/seu/sdk/${slug}/${id}/transition`, {})).alerts, /Target state is required\./);
  hasAlert((await submit(`/seu/sdk/${slug}/${id}/transition`, { targetState: "Zz-No-State" })).alerts, /No governed transition is available from /);
  const missing = await postForm(root, `/seu/sdk/${slug}/${randomUUID()}/publish`, csrf, {});
  assert.equal(missing.status, 302);
  assert.equal(missing.location, `/aisworg/seu/sdk/${slug}`);
  hasAlert(pageAlerts((await getPage(root, indexPath)).html).map(readable), /Not found\./);
});
