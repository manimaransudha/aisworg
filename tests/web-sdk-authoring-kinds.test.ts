// SDK authoring pages for the definition kinds whose forms carry more than the Capability Definition's (src/routes/seu/web/sdkAuthoring.ts): the Template,
// Profile, Pack and Deliverable Definition new-draft forms, the forms that start from an existing Active row (inheriting from a parent), and the parameter
// override rows a Profile reads from its base Template.
//
//   - Each route is called over HTTP from the real app as root. A refused parent leads back with a flash message, which the test reads on the page it leads to.
//   - The parents that are accepted are the Active Platform rows the seed holds. The parent that is refused is the Template, Profile or Pack the schema fixtures
//     author for the fixture tenant, which the Platform viewer cannot see.
//   - The pages only read; nothing is created.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { PLATFORM_TENANT_ID, ROOT_USER_ID, setWebBaseUrl, newSession, getPage, getRedirect, pageAlerts, assertPageMatches, type Session } from "./testFixtures.js";
import { ensureFixtureTenant, buildStage4Fixtures, type Stage4Fixtures } from "./schemaFixtures.js";

let server: ReturnType<typeof app.listen>;
let root: Session;
let fixtures: Stage4Fixtures;
let template: { id: string; code: string };
let profile: { id: string; name: string; base_template_code: string };
let pack: { id: string; code: string };
let deliverable: { id: string; code: string };

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

before(async () => {
  fixtures = await buildStage4Fixtures(await ensureFixtureTenant("web-sdk-kinds"));
  template = (await pool.query(`SELECT id, code FROM templates WHERE status = 'Active' AND tenant_id = $1 ORDER BY code LIMIT 1`, [PLATFORM_TENANT_ID])).rows[0];
  profile = (await pool.query(
    `SELECT p.id, p.name, t.code AS base_template_code FROM profiles p JOIN templates t ON t.id = p.base_template_id WHERE p.status = 'Active' AND p.tenant_id = $1 ORDER BY p.code LIMIT 1`,
    [PLATFORM_TENANT_ID],
  )).rows[0];
  pack = (await pool.query(`SELECT id, code FROM packs WHERE status = 'Active' AND tenant_id = $1 ORDER BY code LIMIT 1`, [PLATFORM_TENANT_ID])).rows[0];
  deliverable = (await pool.query(`SELECT id, code FROM deliverable_definitions WHERE status = 'Active' AND tenant_id = $1 ORDER BY code LIMIT 1`, [PLATFORM_TENANT_ID])).rows[0];
  assert.ok(template && profile && pack && deliverable, "the seed holds an Active Platform Template, Profile, Pack and Deliverable Definition");

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

// A refused parent redirects; the flash message is on the page it leads to.
async function refusal(path: string): Promise<string[]> {
  const redirect = await getRedirect(root, path);
  assert.equal(redirect.status, 302, `GET ${path}`);
  assert.ok(redirect.location);
  const page = await getPage(root, redirect.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200);
  return pageAlerts(page.html).map(readable);
}

const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

test("the new-draft form of each kind renders", async () => {
  for (const slug of ["template-authoring", "profile-authoring", "pack-authoring", "deliverable-authoring"]) {
    assert.equal((await getPage(root, `/seu/sdk/${slug}/new`)).status, 200, slug);
    assert.equal((await getPage(root, `/seu/sdk/${slug}`)).status, 200, `${slug} list`);
  }
});

test("a Template form starts from an Active Template and carries its content; a missing Template and a Template of another tenant are refused", async () => {
  const page = await getPage(root, `/seu/sdk/template-authoring/new?parentTemplateId=${template.id}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(template.code), "the form carries the parent's code");

  hasAlert(await refusal(`/seu/sdk/template-authoring/new?parentTemplateId=${randomUUID()}`), /parent Template not found/);
  hasAlert(await refusal(`/seu/sdk/template-authoring/new?parentTemplateId=${fixtures.template.id}`), /not visible to this tenant/);
});

test("a Profile form starts from an Active Profile and lists the parameter rows of its base Template; a missing Profile and a Profile of another tenant are refused", async () => {
  const page = await getPage(root, `/seu/sdk/profile-authoring/new?parentProfileId=${profile.id}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(profile.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the form carries the parent's name");

  hasAlert(await refusal(`/seu/sdk/profile-authoring/new?parentProfileId=${randomUUID()}`), /parent Profile not found/);
  hasAlert(await refusal(`/seu/sdk/profile-authoring/new?parentProfileId=${fixtures.profile.id}`), /not visible to this tenant/);

  const overrides = await getPage(root, `/seu/sdk/profile-parameter-overrides?baseTemplateCode=${encodeURIComponent(profile.base_template_code)}`);
  assert.equal(overrides.status, 200, "the rows for the base Template");
  assert.equal((await getPage(root, "/seu/sdk/profile-parameter-overrides")).status, 200, "and no rows without a base Template");
});

test("a Pack form branches from an Active Pack; a missing Pack and a Pack of another tenant are refused", async () => {
  const page = await getPage(root, `/seu/sdk/pack-authoring/new?fromPackId=${pack.id}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(pack.code), "the form carries the source Pack's code");

  hasAlert(await refusal(`/seu/sdk/pack-authoring/new?fromPackId=${randomUUID()}`), /source Pack not found/);
  hasAlert(await refusal(`/seu/sdk/pack-authoring/new?fromPackId=${fixtures.pack.id}`), /not this tenant's own/);
});

test("a Deliverable Definition form starts from an Active Deliverable Definition; a missing one is refused", async () => {
  const page = await getPage(root, `/seu/sdk/deliverable-authoring/new?parentDeliverableDefinitionId=${deliverable.id}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(deliverable.code), "the form carries the parent's code");

  const alerts = await refusal(`/seu/sdk/deliverable-authoring/new?parentDeliverableDefinitionId=${randomUUID()}`);
  assert.ok(alerts.length > 0, JSON.stringify(alerts));
});
