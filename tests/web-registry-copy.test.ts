// The Registry pages of the definitions (src/routes/seu/web: capabilityDefinitionRegistry, deliverableDefinitionRegistry, serviceDefinitionRegistry,
// policyDefinitionRegistry, templateRegistry, profileRegistry): the Copy button, which makes a new Draft of an Active definition and sends the user to
// its authoring page.
//
//   - Each route is called over HTTP from the real app as root. The sources are the Active rows of the schema fixtures, built in a tenant of their own.
//   - A copy is checked in the database: it has the code of its source, is no longer Active and has the next patch version, and its authoring page shows it.
//   - A copy of a row that does not exist leads back to the list with the reason.
//   - Rows are not deleted, as in the other tests that author definitions.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import {
  ROOT_USER_ID, setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, type Session,
} from "./testFixtures.js";
import { ensureFixtureTenant, buildStage4Fixtures, type Stage4Fixtures } from "./schemaFixtures.js";

let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let fixtures: Stage4Fixtures;

before(async () => {
  fixtures = await buildStage4Fixtures(await ensureFixtureTenant("web-registry-copy"));
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

interface Registry {
  name: string;
  list: string;
  authoring: string;
  table: string;
  versionColumn: string;
  source: () => { id: string; code: string };
}

const registries: Registry[] = [
  { name: "Capability Definition", list: "capability-definitions", authoring: "capability-authoring", table: "capability_definitions", versionColumn: "version", source: () => fixtures.capability },
  { name: "Deliverable Definition", list: "deliverable-definitions", authoring: "deliverable-authoring", table: "deliverable_definitions", versionColumn: "version", source: () => fixtures.inputDeliverable },
  { name: "Service Definition", list: "service-definitions", authoring: "service-authoring", table: "service_definitions", versionColumn: "version", source: () => fixtures.service },
  { name: "Policy Definition", list: "policy-definitions", authoring: "policy-authoring", table: "policy_definitions", versionColumn: "version", source: () => fixtures.policy },
  { name: "Template", list: "templates", authoring: "template-authoring", table: "templates", versionColumn: "template_version", source: () => fixtures.template },
  { name: "Profile", list: "profiles", authoring: "profile-authoring", table: "profiles", versionColumn: "profile_version", source: () => fixtures.profile },
];

async function row(registry: Registry, id: string) {
  const { rows } = await pool.query<{ code: string; status: string; version: string }>(`SELECT code, status, ${registry.versionColumn} AS version FROM ${registry.table} WHERE id = $1`, [id]);
  return rows[0];
}

for (const registry of registries) {
  test(`${registry.name}: Copy makes a new Draft of the Active row with the next patch version, and leads to its authoring page`, async () => {
    const source = registry.source();
    const before = await row(registry, source.id);
    assert.equal(before.status, "Active", "the fixture row is Active");

    const posted = await postForm(root, `/seu/${registry.list}/${source.id}/copy`, csrf, {});
    assert.equal(posted.status, 302);
    const match = new RegExp(`^/aisworg/seu/sdk/${registry.authoring}/([0-9a-f-]{36})$`).exec(posted.location ?? "");
    assert.ok(match, `the copy leads to its authoring page, got ${posted.location}`);

    const copy = await row(registry, match[1]);
    assert.equal(copy.code, source.code);
    assert.notEqual(copy.status, "Active", "a copy is a Draft, not an Active row");
    assert.notEqual(copy.version, before.version, "a copy has a version of its own");
    assert.notEqual(match[1], source.id);

    const page = await getPage(root, posted.location!.replace(/^\/aisworg/, ""));
    assert.equal(page.status, 200);
    assertPageMatches(page.html, new RegExp(source.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the authoring page shows the copy");
    const flash = pageAlerts(page.html).map(readable);
    assert.ok(flash.some((a) => new RegExp(`${registry.name} copied — a new Draft is ready to edit\\.`).test(a)), JSON.stringify(flash));
  });

  test(`${registry.name}: Copy of a row that does not exist leads back to the list and says why`, async () => {
    const posted = await postForm(root, `/seu/${registry.list}/${randomUUID()}/copy`, csrf, {});
    assert.equal(posted.status, 302);
    assert.equal(posted.location, `/aisworg/seu/${registry.list}`);
    const page = await getPage(root, `/seu/${registry.list}`);
    assert.equal(page.status, 200);
    const alerts = pageAlerts(page.html).map(readable);
    assert.ok(alerts.some((a) => /^Copy failed: .*not found/i.test(a)), JSON.stringify(alerts));
  });
}

test("Capability Definition: the view of an id that is not an id is an error page, and of one that does not exist leads back to the list with the reason", async () => {
  assert.equal((await getPage(root, "/seu/capability-definitions/not-a-uuid")).status, 500);
  const missing = await getRedirect(root, `/seu/capability-definitions/${randomUUID()}`);
  assert.equal(missing.status, 302);
  assert.equal(missing.location, "/aisworg/seu/capability-definitions");
  const alerts = pageAlerts((await getPage(root, "/seu/capability-definitions")).html).map(readable);
  assert.ok(alerts.some((a) => /Capability Definition not found\./.test(a)), JSON.stringify(alerts));
});
