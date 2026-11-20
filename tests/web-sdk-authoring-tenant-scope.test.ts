// SDK authoring pages (src/routes/seu/web/sdkAuthoring.ts) and the tenant scope of editing and transitions.
//
// A Platform row can be viewed and copied by every tenant, but only the row's own tenant (and root) can edit it or move it through a transition. The test runs
// the Capability Definition authoring pages as a non-root user of the test-platform tenant, which is not the real Platform tenant:
//   - the row of the user's own tenant has its Edit button and its transition buttons, its edit page opens, and a save changes it;
//   - a seeded Active row of the real Platform tenant is listed with its View link and no Edit or transition button, and its edit page, save, compose,
//     publish and transition are all refused with "Not found.". The refused posts carry content that no write would accept, so a regression of the gate
//     is not able to change the Platform row either;
//   - copying the Platform row still works, and leads to a draft of the user's own tenant;
//   - root still opens the Platform row's edit page.
// The test reads the Platform row and never writes to it.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import { lookupRouteAuthority } from "../src/domain/identity/routeAuthorityCache.js";
import { addConcept, approveConcept, listConceptsForType } from "../src/routes/seu/core/ontology.js";
import type { CapabilityDefinitionRow } from "../src/dblayer/seuTypes.js";
import {
  PLATFORM_TENANT_ID, ROOT_USER_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, TESTER_ACCEPTANCE_JOURNEY_PLATFORM,
  setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, grantRole, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const slug = "capability-authoring";
const indexPath = `/seu/sdk/${slug}`;
let server: ReturnType<typeof app.listen>;
let tenantUser: Session;
let root: Session;
let csrf: string;
let category: string;
let roleName: string;
let workType: string;
let userTenantId: string;
let platformRow: CapabilityDefinitionRow;
let ownId: string;
let ownCode: string;
const restores: Array<() => Promise<void>> = [];

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

// The role route_authority itself declares for a route, granted to the test user and put back at the end.
async function grantRouteRole(method: string, path: string): Promise<void> {
  const found = lookupRouteAuthority(method, path);
  assert.ok(found && found.roles.length > 0, `route_authority declares a role for ${method} ${path}`);
  restores.push(await grantRole(TESTER_ACCEPTANCE_JOURNEY_PLATFORM.participantId, found.roles[0]));
}

// Adds a Capability code to the Ontology and approves it, so a draft that uses it can be published.
async function approvedCode(label: string): Promise<string> {
  const code = `zz-scope-${label}-${run}`;
  const actor = { isRoot: true, tenantId: PLATFORM_TENANT_ID, actorId: ROOT_ACTOR_ID, actorBadge: ROOT_ACTOR_BADGE };
  await addConcept({ conceptType: "capability-name", code, defaultLabel: `Scope ${label} capability`, targetTenantId: PLATFORM_TENANT_ID }, actor);
  await approveConcept("capability-name", code, PLATFORM_TENANT_ID, actor);
  return code;
}

const formFor = (code: string, overrides: Record<string, string | string[]> = {}): Record<string, string | string[]> => ({
  code, defaultLabel: `Label of ${code}`, description: "What the scope test covers", category, "roles[0][name]": roleName, "roles[0][worktypes]": [workType], ...overrides,
});

// Posts as the tenant user, then reads the flash message on the page the redirect leads to.
async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<{ alerts: string[]; location: string }> {
  const posted = await postForm(tenantUser, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location, `POST ${pathName} leads somewhere`);
  const page = await getPage(tenantUser, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return { alerts: pageAlerts(page.html).map(readable), location: posted.location };
}

const draftIdOf = (location: string) => /\/seu\/sdk\/capability-authoring\/([0-9a-f-]{36})$/.exec(location)?.[1];
const row = async (id: string) => (await capabilityDefinitionsDB.findById(id)).data!;

before(async () => {
  const first = async (type: string) => {
    const [concept] = await listConceptsForType(type, { isRoot: true, tenantId: null }, false);
    assert.ok(concept, `the Ontology holds a ${type} concept`);
    return concept.code;
  };
  category = await first("category:capability");
  roleName = await first("role-name");
  workType = await first("worktype-name");

  const { data: master } = await participantsMasterDB.findById(TESTER_ACCEPTANCE_JOURNEY_PLATFORM.participantId);
  assert.ok(master, "the test user has a participants_master row");
  userTenantId = master.tenant_id;
  assert.equal(userTenantId, PLATFORM_TENANT_ID, "the test user belongs to the test-platform tenant");
  const realPlatformTenantId = await getPlatformTenantId();
  assert.notEqual(userTenantId, realPlatformTenantId, "the test-platform tenant is not the real Platform tenant");

  // A seeded Active Capability of the real Platform tenant: read, never written.
  const { data: all } = await capabilityDefinitionsDB.findAll();
  const platformActive = (all ?? []).find((c) => c.tenant_id === realPlatformTenantId && c.status === "Active");
  assert.ok(platformActive, "the seed holds an Active Capability Definition of the Platform tenant");
  platformRow = platformActive;

  await grantRouteRole("GET", `/aisworg/seu/sdk/${slug}`);
  await grantRouteRole("POST", `/aisworg/seu/capability-definitions/${platformRow.id}/copy`);

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  tenantUser = newSession(TESTER_ACCEPTANCE_JOURNEY_PLATFORM.userId);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(tenantUser, `${indexPath}/new`)).html);

  // The user's own row, created through the authoring form as the user, so it belongs to the user's tenant.
  ownCode = await approvedCode("own");
  const created = await submit(`/seu/sdk/${slug}`, formFor(ownCode));
  hasAlert(created.alerts, /Started a new Capability draft\./);
  const id = draftIdOf(created.location);
  assert.ok(id, `the create leads to the draft's page, got ${created.location}`);
  ownId = id;
  assert.equal((await row(ownId)).tenant_id, userTenantId, "the user's draft belongs to the user's tenant");
});

after(async () => {
  for (const restore of restores.reverse()) await restore();
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

test("the list shows the user's own row with its Edit and transition buttons, and a Platform row with View only", async () => {
  const own = await getPage(tenantUser, `${indexPath}?q=${encodeURIComponent(ownCode)}`);
  assert.equal(own.status, 200);
  assertPageMatches(own.html, new RegExp(`/${slug}/${ownId}"`), "the own row has its Edit button");
  assertPageMatches(own.html, new RegExp(`/${slug}/${ownId}/transition`), "the own row has its transition buttons");

  const platform = await getPage(tenantUser, `${indexPath}?q=${encodeURIComponent(platformRow.code)}`);
  assert.equal(platform.status, 200);
  assertPageMatches(platform.html, new RegExp(`capability-definitions/${platformRow.id}`), "the Platform row is listed with its View link");
  assertPageDoesNotMatch(platform.html, new RegExp(`/${slug}/${platformRow.id}`), "the Platform row has no Edit button and no transition button");
});

test("the user's own row opens and saves, and the Platform row's edit page, save, compose, publish and transition are refused", async () => {
  const ownPage = await getPage(tenantUser, `${indexPath}/${ownId}`);
  assert.equal(ownPage.status, 200, "the user's own draft opens");
  const saved = await submit(`/seu/sdk/${slug}/${ownId}/save`, formFor(ownCode, { defaultLabel: `Saved label ${run}` }));
  hasAlert(saved.alerts, /^Draft saved/);
  assert.equal((await row(ownId)).default_label, `Saved label ${run}`);

  const before = await row(platformRow.id);
  const notFound = async (location: string | null, what: string) => {
    assert.ok(location, `${what} leads somewhere`);
    const page = await getPage(tenantUser, location.replace(/^\/aisworg/, ""));
    hasAlert(pageAlerts(page.html).map(readable), /Not found\./);
  };

  const open = await getRedirect(tenantUser, `${indexPath}/${platformRow.id}`);
  assert.equal(open.status, 302, "the Platform row's edit page is refused");
  await notFound(open.location, "the edit page");

  // The posts carry content that no write accepts, so nothing is written even if the gate let them through.
  const posts: Array<[string, Record<string, string | string[]>]> = [
    ["save", formFor(platformRow.code, { defaultLabel: "" })],
    ["compose", {}],
    ["publish", {}],
    ["transition", { targetState: "Zz-No-State" }],
  ];
  for (const [action, fields] of posts) {
    const posted = await postForm(tenantUser, `/seu/sdk/${slug}/${platformRow.id}/${action}`, csrf, fields);
    assert.equal(posted.status, 302, `POST ${action}`);
    await notFound(posted.location, action);
  }

  const after = await row(platformRow.id);
  assert.deepEqual([after.status, after.default_label, after.description, after.version], [before.status, before.default_label, before.description, before.version], "the Platform row is unchanged");
});

test("a Platform row is still copied into a draft of the user's own tenant, and root still opens the Platform row's edit page", async () => {
  const copied = await submit(`/seu/capability-definitions/${platformRow.id}/copy`);
  const copyId = draftIdOf(copied.location);
  assert.ok(copyId, `the copy leads to the new draft's page, got ${copied.location}`);
  assert.equal((await row(copyId)).tenant_id, userTenantId, "the copy belongs to the user's tenant");
  assert.equal((await getPage(tenantUser, `${indexPath}/${copyId}`)).status, 200, "the user opens the copy");

  assert.equal((await getPage(root, `${indexPath}/${platformRow.id}`)).status, 200, "root opens the Platform row");
});
