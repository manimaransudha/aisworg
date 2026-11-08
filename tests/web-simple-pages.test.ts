// Web controllers of the SEU area that list or show one thing (src/routes/seu/web): events, version events, the demo dashboard, compliance, data
// migrations, documentation, the dev act-as switch and the participant list.
//
//   - Each route is called over HTTP from the real app as root, so the route_authority gate, the controller and the view run together. The badge rules
//     are covered by route-authority-gate.test.ts.
//   - A POST answers with a redirect. The test reads the Location and the flash message on the next page that shows one.
//   - The test writes its own rows (a participant, an event, a compliance requirement and a plain SEU) with names that carry the run tag. Rows are not
//     deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import app from "../src/app.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { userDB } from "../src/dblayer/userDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { complianceDB } from "../src/dblayer/complianceDB.js";
import { DOCS_ROOT, listDocsDir, listTopLevelDocFolders } from "../src/domain/sdk/docsTree.js";
import { publishTestEvent } from "./engineFixtures.js";
import { commissionScenario } from "./webScenarios.js";
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

// The flash text as the user reads it: the page escapes the quotes of a message.
const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

// Posts a form, then reads the flash message on the data migrations page, which shows one.
async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<{ location: string | null; alerts: string[] }> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  const page = await getPage(root, "/seu/data-migrations");
  assert.equal(page.status, 200);
  return { location: posted.location, alerts: pageAlerts(page.html).map(readable) };
}

const hasAlert = (result: { alerts: string[] }, pattern: RegExp) => assert.ok(result.alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(result.alerts)}`);

test("the event list shows an event by its type and filters by SEU, event type, entity type and the code or name in its payload", async () => {
  const { seu } = await commissionScenario("clean", "web-events");
  const plain = `ZzWebPlain${run}`;
  const scoped = `ZzWebScoped${run}`;
  await publishTestEvent({ eventType: plain, originatingObjectType: "ZzProbe", originatingObjectId: randomUUID(), payload: { code: `plain-code-${run}` } });
  await publishTestEvent({ eventType: scoped, originatingObjectType: "ZzScoped", originatingObjectId: randomUUID(), seuId: seu.id, payload: { name: `Scoped name ${run}` } });
  const shows = async (query: string, type: string) => (await getPage(root, `/seu/events?${query}`)).html.includes(type);

  assert.equal(await shows(`eventType=${plain}`, plain), true);
  assert.equal(await shows(`eventType=${plain}`, scoped), false, "the event type filter shows only that type");
  assert.equal(await shows(`seuId=${seu.id}`, scoped), true);
  assert.equal(await shows(`seuId=${seu.id}`, plain), false, "the SEU filter shows only that SEU's events");
  assert.equal(await shows("entityType=ZzProbe", plain), true);
  assert.equal(await shows("entityType=ZzProbe", scoped), false, "the entity type filter shows only that type");
  assert.equal(await shows("entityType=ZzScoped", scoped), true);
  assert.equal(await shows("entityType=ZzScoped", plain), false);
  assert.equal(await shows(`name=plain-code-${run}`, plain), true, "the name filter finds the code in the payload");
  assert.equal(await shows(`name=plain-code-${run}`, scoped), false);
  assert.equal(await shows(`name=scoped name ${run}`, scoped), true, "and the name in the payload, ignoring case");
  assert.equal(await shows("eventType=ZzNeverPublished", plain), false);
});

test("the version event list filters by tenant, entity type, entity and version event", async () => {
  const entityId = randomUUID();
  const other = randomUUID();
  const versionEvent = `ZzVersion${run}`;
  await eventBus.publish({
    eventType: "ZzVersionProbe", originatingObjectType: "ZzEntity", originatingObjectId: entityId, seuId: null, correlationId: randomUUID(),
    actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, tenantId: PLATFORM_TENANT_ID, versionEvent, fromState: "A", toState: "B",
  });
  await eventBus.publish({
    eventType: "ZzVersionProbe", originatingObjectType: "ZzOther", originatingObjectId: other, seuId: null, correlationId: randomUUID(),
    actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, tenantId: PLATFORM_TENANT_ID, versionEvent: `${versionEvent}Other`, fromState: "C", toState: "D",
  });
  const page = async (query: string) => (await getPage(root, `/seu/version-events?${query}`)).html;

  const byEntity = await page(`entityId=${entityId}`);
  assert.ok(byEntity.includes(versionEvent) && !byEntity.includes(`${versionEvent}Other`), "the entity filter shows that entity's version events");
  const byType = await page(`entityType=ZzOther&tenantId=${PLATFORM_TENANT_ID}`);
  assert.ok(byType.includes(`${versionEvent}Other`) && !byType.includes(`>${versionEvent}<`), "the entity type filter shows that type");
  const byVersionEvent = await page(`versionEvent=${versionEvent}`);
  assert.ok(byVersionEvent.includes(entityId) && !byVersionEvent.includes(other), "the version event filter shows that version event");
  assert.ok(!(await page(`entityId=${entityId}&entityType=ZzOther`)).includes(versionEvent), "the filters are combined");
});

test("the demo dashboard greets a visitor with its entry to the demo, and the root of the SEU area leads back to the application root", async () => {
  const page = await getPage(root, "/seu/dashboard/demo");
  assert.equal(page.status, 200);
  assertPageMatches(page.html, /href="\/aisworg\/seu\/demo"/, "the dashboard links to the demo");
  assertPageMatches(page.html, /How SEU Studio governs AI engineering work/);
  const redirect = await getRedirect(root, "/seu/");
  assert.equal(redirect.status, 302);
  assert.equal(redirect.location, "/aisworg");
});

test("the compliance page of an SEU shows its evaluation, and a waiver is refused without its fields or for a requirement that does not exist, and granted for one that does", async () => {
  const { seu } = await commissionScenario("clean", "web-compliance");
  const page = await getPage(root, `/seu/seus/${seu.id}/compliance`);
  assert.equal(page.status, 200);

  const waiversPath = `/seu/seus/${seu.id}/compliance/waivers`;
  hasAlert(await submit(waiversPath, { requirementCode: "", rationale: "r" }), /Requirement and rationale are required\./);
  hasAlert(await submit(waiversPath, { requirementCode: "x", rationale: "  " }), /Requirement and rationale are required\./);
  hasAlert(await submit(waiversPath, { requirementCode: `zz-no-requirement-${run}`, rationale: "r" }), new RegExp(`compliance requirement not found: zz-no-requirement-${run}`));

  const frameworkCode = `zz-framework-${run}`;
  const requirementCode = `zz-requirement-${run}`;
  const { error: frameworkError } = await complianceDB.upsertFramework({ code: frameworkCode, name: `Web framework ${run}`, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(!frameworkError, frameworkError?.message);
  const { error: requirementError } = await complianceDB.upsertRequirement({
    code: requirementCode, frameworkCode, name: `Web requirement ${run}`, criteria: { type: "always_true" }, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(!requirementError, requirementError?.message);

  const granted = await submit(waiversPath, { requirementCode, rationale: "Accepted for the web test" });
  hasAlert(granted, new RegExp(`Waiver granted for "${requirementCode}"\\.`));
  const { data: waivers } = await complianceDB.findActiveWaivers(seu.id);
  assert.deepEqual((waivers ?? []).map((w) => w.requirement_code), [requirementCode]);
  assertPageMatches((await getPage(root, `/seu/seus/${seu.id}/compliance`)).html, new RegExp(requirementCode), "the page lists the waiver");
});

test("the data migration list shows the targets, searches them and sorts them, and a run of no target runs nothing", async () => {
  const all = await getPage(root, "/seu/data-migrations");
  assert.equal(all.status, 200);
  assertPageMatches(all.html, /Route authority/);
  assertPageMatches(all.html, /Ontology concepts/);

  const searched = await getPage(root, "/seu/data-migrations?q=ontology");
  assertPageMatches(searched.html, /Ontology concepts/);
  assertPageDoesNotMatch(searched.html, /Route authority/);

  for (const query of ["sort=tables&dir=desc", "sort=target&dir=asc"]) assert.equal((await getPage(root, `/seu/data-migrations?${query}`)).status, 200, query);

  // A code that names no migration selects none, so the run changes no data. A run with no code at all would run every migration, so the test never sends one.
  const result = await submit("/seu/data-migrations/run", { codes: `zz-no-migration-${run}` });
  hasAlert(result, /Ran 0 data migration\(s\)/);
  hasAlert(await submit("/seu/data-migrations/run", { codes: [`zz-a-${run}`, `zz-b-${run}`] }), /Ran 0 data migration\(s\)/);
});

test("the documentation is browsed from its top folders down to a file, and a path outside it, a missing path and a file that is not Markdown are not found", async () => {
  const index = await getPage(root, "/seu/docs");
  assert.equal(index.status, 200);
  const [folder] = listTopLevelDocFolders().filter((f) => f.name === "implementation");
  assert.ok(folder, "src/docs holds the implementation folder");
  assertPageMatches(index.html, new RegExp(folder.name));

  const folderPage = await getPage(root, `/seu/docs/${folder.path}`);
  assert.equal(folderPage.status, 200);
  const { files } = listDocsDir(path.join(DOCS_ROOT, folder.path), folder.path);
  assert.ok(files.length > 0, "the folder holds Markdown files");
  const file = files[0];
  const filePage = await getPage(root, `/seu/docs/${file.path.split("/").map(encodeURIComponent).join("/")}`);
  assert.equal(filePage.status, 200);
  const heading = fs.readFileSync(path.join(DOCS_ROOT, file.path), "utf-8").split("\n").map((line) => /^#+\s+([A-Za-z0-9 ]+)$/.exec(line)?.[1]).find(Boolean);
  if (heading) assertPageMatches(filePage.html, new RegExp(heading.trim()), "the page shows the document");

  assert.equal((await getPage(root, "/seu/docs/does-not-exist")).status, 404);
  assert.equal((await getPage(root, "/seu/docs/..%2f..%2fpackage.json")).status, 404, "a path that leaves the documentation");
  assert.equal((await getPage(root, "/seu/docs/SEU%20Studio%20Specifications/capability-roles.csv")).status, 404, "a file that is not Markdown");
});

test("the dev act-as switch accepts root, refuses a badge that does not exist, and resets", async () => {
  hasAlert(await submit("/seu/dev/act-as", { badgeType: "root" }), /Now acting as root \(full access\) · default tenant\./);
  hasAlert(await submit("/seu/dev/act-as", { badgeType: "" }), /Now acting as root/);
  hasAlert(await submit("/seu/dev/act-as", { badgeType: `zz-no-badge-${run}`, tenantId: PLATFORM_TENANT_ID }), new RegExp(`Unknown badge type "zz-no-badge-${run}" for the selected tenant\\.`));
  hasAlert(await submit("/seu/dev/act-as/reset"), /Acting context reset to root \(full access\)\./);
  hasAlert(await submit("/seu/dev/act-as", { badgeType: "root", tenantId: PLATFORM_TENANT_ID }), /Now acting as root \(full access\)\./);
  hasAlert(await submit("/seu/dev/act-as/reset"), /Acting context reset to root/);
});

test("the participant list shows the participants the viewer may see, filters them by type and searches them", async () => {
  const displayName = `Web Participant ${run}`;
  const rootTenantId = (await userDB.findById(ROOT_USER_ID))!.tenant_id;
  const { data: created, error } = await participantsMasterDB.create({ tenantId: rootTenantId, type: "External", displayName, userId: null });
  assert.ok(created && !error, error?.message);

  const searched = await getPage(root, `/seu/participants?q=${encodeURIComponent(displayName)}`);
  assert.equal(searched.status, 200);
  assertPageMatches(searched.html, new RegExp(displayName));

  const ofType = await getPage(root, `/seu/participants?status=External&q=${encodeURIComponent(displayName)}`);
  assertPageMatches(ofType.html, new RegExp(displayName));
  const otherType = await getPage(root, `/seu/participants?status=Automated&q=${encodeURIComponent(displayName)}`);
  assertPageDoesNotMatch(otherType.html, new RegExp(displayName));
  assert.equal((await getPage(root, "/seu/participants?status=NotAType&sort=tenant&dir=desc")).status, 200, "a type that does not exist filters nothing");
});
