// Schema Registry pages (src/routes/seu/web/schemaRegistry.ts): the list of schema versions, the form that starts a new one from the latest, the review of its
// compatibility, packaging it, and moving it along its lifecycle.
//
//   - Each route is called over HTTP from the real app as root. A POST that renders a page (the review) is read from its response; the others answer with a
//     redirect and the test reads the flash message on the page it leads to.
//   - The schema published is the latest Profile schema again, word for word, so the live content of every form does not change; the discipline of the schema
//     registry test is kept: a new version is added, no version is edited or deleted. A version is rejected, and one is published; both carry that same content.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionRow } from "../src/dblayer/seuTypes.js";
import {
  ROOT_USER_ID,
  setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const KIND = "Profile";
let server: ReturnType<typeof app.listen>;
let baseUrl: string;
let root: Session;
let csrf: string;
let latest: SchemaDefinitionRow;
let baseJson: string;
let firstProperty: string;

before(async () => {
  const { data } = await schemaDefinitionsDB.findLatest(KIND);
  assert.ok(data, `a ${KIND} schema is seeded`);
  latest = data;
  baseJson = JSON.stringify(latest.schema);
  firstProperty = Object.keys((latest.schema as { properties: Record<string, unknown> }).properties)[0]!;

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  baseUrl = `http://127.0.0.1:${address.port}/aisworg`;
  setWebBaseUrl(baseUrl);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(root, "/seu/sdk/schema-registry")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

async function submit(pathName: string, fields: Record<string, string> = {}): Promise<{ alerts: string[]; location: string | null }> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return { alerts: pageAlerts(page.html).map(readable), location: posted.location };
}

// A POST whose answer is a page, not a redirect.
async function postPage(pathName: string, fields: Record<string, string>): Promise<{ status: number; html: string }> {
  const params = new URLSearchParams({ _csrf: csrf, ...fields });
  const res = await root(`${baseUrl}${pathName}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  return { status: res.status, html: await res.text() };
}

const hasAlert = (result: { alerts: string[] }, pattern: RegExp) => assert.ok(result.alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(result.alerts)}`);
const idOf = (location: string | null) => /\/schema-registry\/([0-9a-f-]{36})$/.exec(location ?? "")?.[1];
const versionRow = async (id: string) => (await pool.query<{ entity_kind: string; version: number; lifecycle_state: string; compatible_versions: number[]; incompatible_versions: number[] }>(
  "SELECT entity_kind, version, lifecycle_state, compatible_versions, incompatible_versions FROM schema_definitions WHERE id = $1", [id])).rows[0];

test("the list shows each schema version with its kind and is searched by kind", async () => {
  const all = await getPage(root, "/seu/sdk/schema-registry");
  assert.equal(all.status, 200);
  assertPageMatches(all.html, new RegExp(KIND));
  assertPageMatches(all.html, new RegExp(`/schema-registry/${latest.id}`), "each version links to its page");

  const searched = await getPage(root, `/seu/sdk/schema-registry?q=${KIND}`);
  assertPageMatches(searched.html, new RegExp(KIND));
  assertPageDoesNotMatch((await getPage(root, `/seu/sdk/schema-registry?q=${KIND}-no-such-kind`)).html, new RegExp(`/schema-registry/${latest.id}`), "a search that matches no kind lists no version");
});

test("the new-version form starts from the latest schema of the kind, and is blank for a kind that does not exist", async () => {
  const fromLatest = await getPage(root, `/seu/sdk/schema-registry/new?entityKind=${KIND}`);
  assert.equal(fromLatest.status, 200);
  assertPageMatches(fromLatest.html, new RegExp(`value="${firstProperty}"`), "the first property of the latest schema is a field of the form");

  const blank = await getPage(root, "/seu/sdk/schema-registry/new?entityKind=NotARealKind");
  assert.equal(blank.status, 200);
  assertPageDoesNotMatch(blank.html, new RegExp(`value="${firstProperty}"`), "an unknown kind starts from nothing");
});

test("a schema sent for review is compared with every version of its kind; a schema with no field, no kind, bad JSON or an unknown kind is turned back with the reason", async () => {
  const reviewed = await postPage("/seu/sdk/schema-registry", { entityKind: KIND, schemaJson: baseJson });
  assert.equal(reviewed.status, 200);
  assert.ok(reviewed.html.includes(`Review ${KIND} schema changes`), "the review page names the kind");
  assert.match(reviewed.html, /compatible/i, "the report states the compatibility");

  const fromWidgets = await postPage("/seu/sdk/schema-registry", { entityKind: KIND, "widgets[0][kind]": "text", "widgets[0][name]": "code", "widgets[0][required]": "on" });
  assert.equal(fromWidgets.status, 200, "a form built from widgets is compiled and reviewed");
  assert.ok(fromWidgets.html.includes(`Review ${KIND} schema changes`));

  const noWidgets = await submit("/seu/sdk/schema-registry", { entityKind: KIND });
  hasAlert(noWidgets, /At least one named field is required\./);
  assert.equal(noWidgets.location, `/aisworg/seu/sdk/schema-registry/new?entityKind=${KIND}`);
  hasAlert(await submit("/seu/sdk/schema-registry", { entityKind: " ", schemaJson: baseJson }), /Entity kind is required\./);
  hasAlert(await submit("/seu/sdk/schema-registry", { entityKind: " " }), /Entity kind is required\./);
  const badJson = await submit("/seu/sdk/schema-registry", { entityKind: KIND, schemaJson: "{ not valid json" });
  hasAlert(badJson, /invalid JSON/);
  assert.equal(badJson.location, `/aisworg/seu/sdk/schema-registry/new?entityKind=${KIND}`);
  hasAlert(await submit("/seu/sdk/schema-registry", { entityKind: "NotARealKind", schemaJson: "{}" }), /entity kind must be one of/);
});

test("packaging a schema adds a version that is compatible with the one it repeats, shown on its page; with no kind or schema, or a schema that is not valid, nothing is added", async () => {
  hasAlert(await submit("/seu/sdk/schema-registry/publish", { entityKind: KIND }), /Entity kind and schema are required\./);
  hasAlert(await submit("/seu/sdk/schema-registry/publish", { schemaJson: baseJson }), /Entity kind and schema are required\./);
  hasAlert(await submit("/seu/sdk/schema-registry/publish", { entityKind: KIND, schemaJson: "{ not valid json" }), /invalid JSON/);
  hasAlert(await submit("/seu/sdk/schema-registry/publish", { entityKind: "NotARealKind", schemaJson: "{}" }), /entity kind must be one of/);

  const published = await submit("/seu/sdk/schema-registry/publish", { entityKind: KIND, schemaJson: baseJson });
  const id = idOf(published.location);
  assert.ok(id, `the packaging leads to the page of the new version, got ${published.location}`);
  const row = await versionRow(id);
  hasAlert(published, new RegExp(`${KIND} schema v${row.version} packaged — publish it below to make it live\\.`));
  assert.equal(row.entity_kind, KIND);
  assert.ok(row.version > latest.version, "the new version follows the latest");
  assert.ok(row.compatible_versions.includes(latest.version), "a schema that repeats the latest is compatible with it");
  assert.ok(!row.incompatible_versions.includes(latest.version));

  const detail = await getPage(root, `/seu/sdk/schema-registry/${id}`);
  assert.equal(detail.status, 200);
  assertPageMatches(detail.html, new RegExp(row.lifecycle_state));
  assertPageMatches(detail.html, new RegExp(firstProperty), "the page shows the schema");
});

test("the page of a version that does not exist leads back to the list with the reason", async () => {
  const missing = await getRedirect(root, `/seu/sdk/schema-registry/${randomUUID()}`);
  assert.equal(missing.status, 302);
  assert.equal(missing.location, "/aisworg/seu/sdk/schema-registry");
  hasAlert({ alerts: pageAlerts((await getPage(root, "/seu/sdk/schema-registry")).html).map(readable) }, /Schema version not found\./);
});

test("a packaged version is moved by the transitions its state offers, and refused for a target it does not offer, no target, or a version that does not exist", async () => {
  const packaged = await submit("/seu/sdk/schema-registry/publish", { entityKind: KIND, schemaJson: baseJson });
  const id = idOf(packaged.location)!;
  const row = await versionRow(id);
  assert.equal(row.lifecycle_state, "Packaged", "packaging takes a new version through its governed steps");
  const transitionPath = `/seu/sdk/schema-registry/${id}/transition`;

  hasAlert(await submit(transitionPath, {}), /Target state is required\./);
  hasAlert(await submit(`/seu/sdk/schema-registry/${randomUUID()}/transition`, { targetState: "Published" }), /Schema version not found\./);
  hasAlert(await submit(transitionPath, { targetState: "Validated" }), /Validated is not an available action for a schema in Packaged\./);
  assert.equal((await versionRow(id)).lifecycle_state, "Packaged", "a refused move changes nothing");

  hasAlert(await submit(transitionPath, { targetState: "PublicationRejected" }), new RegExp(`${KIND} schema v${row.version} moved to PublicationRejected\\.`));
  assert.equal((await versionRow(id)).lifecycle_state, "PublicationRejected");
  hasAlert(await submit(transitionPath, { targetState: "Published" }), /is not an available action for a schema in PublicationRejected\./);

  const second = idOf((await submit("/seu/sdk/schema-registry/publish", { entityKind: KIND, schemaJson: baseJson })).location)!;
  const secondRow = await versionRow(second);
  hasAlert(await submit(`/seu/sdk/schema-registry/${second}/transition`, { targetState: "Published" }), new RegExp(`${KIND} schema v${secondRow.version} moved to Published\\.`));
  assert.equal((await versionRow(second)).lifecycle_state, "Published");
});
