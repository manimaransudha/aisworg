// Route Authority pages (src/routes/seu/web/routeAuthorityRegistry.ts): adding, editing, updating and deleting the row that says which badges and roles a route
// requires, and what that does to the gate that every request passes.
//
//   - Each route is called over HTTP from the real app as root. A POST answers with a redirect; the test reads the flash message on the page it leads to, then
//     reads the row from the database.
//   - The rows are for paths that carry the run tag, so no real route is touched. They are deleted when the file ends.
//   - The gate is exercised with a user who is not root: a path with no row is refused, a path with a row that asks for nothing is let through (and then is
//     not found, as no controller serves it), and a path whose row is deleted is refused again.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import pool from "../src/utils/db.js";
import { listAuthorisedBadgeCodes, listAuthorisedRoleCodes } from "../src/routes/seu/core/identity.js";
import {
  ROOT_USER_ID, TESTER_CREATOR_ID,
  setWebBaseUrl, newSession, extractCsrf, getPage, getRedirect, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const prefix = `/aisworg/seu/zz-web-route-${run}`;
let server: ReturnType<typeof app.listen>;
let root: Session;
let tester: Session;
let csrf: string;
let badgeA: string;
let badgeB: string;
let roleA: string;

before(async () => {
  badgeA = (await listAuthorisedBadgeCodes())[0]!;
  badgeB = (await listAuthorisedBadgeCodes())[1]!;
  roleA = (await listAuthorisedRoleCodes())[0]!;
  assert.ok(badgeA && badgeB && roleA, "the authority vocabulary and the Ontology hold badges and roles");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
  tester = newSession(TESTER_CREATOR_ID);
  csrf = extractCsrf((await getPage(root, "/seu/route-authority")).html);
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
  await pool.query("DELETE FROM route_authority WHERE path LIKE $1", [`${prefix}%`]);
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<{ alerts: string[]; location: string | null }> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return { alerts: pageAlerts(page.html).map(readable), location: posted.location };
}

const hasAlert = (result: { alerts: string[] }, pattern: RegExp) => assert.ok(result.alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(result.alerts)}`);

interface Row { id: string; method: string; path: string; badges: string[]; roles: string[]; match_mode: string; description: string | null }
const rowFor = async (method: string, pathName: string) => (await pool.query<Row>("SELECT * FROM route_authority WHERE method = $1 AND path = $2", [method, pathName])).rows[0];

test("a row is added with its method in upper case, the badges and roles posted and the match mode, and is refused without a method, with a path that does not start with a slash and for a route that already has a row", async () => {
  hasAlert(await submit("/seu/route-authority", { method: "  ", path: `${prefix}/x` }), /Method is required\./);
  hasAlert(await submit("/seu/route-authority", { method: "post", path: "no-slash" }), /Path must start with \/\./);

  const path = `${prefix}/full`;
  const added = await submit("/seu/route-authority", { method: "post", path: ` ${path} `, badges: [badgeA, badgeB], roles: roleA, matchMode: "any", description: "  Added by the web test  " });
  hasAlert(added, new RegExp(`POST ${path} added\\.`));
  assert.equal(added.location, "/aisworg/seu/route-authority");
  const row = await rowFor("POST", path);
  assert.deepEqual([row.badges.sort(), row.roles, row.match_mode, row.description], [[badgeA, badgeB].sort(), [roleA], "any", "Added by the web test"]);

  const plain = await submit("/seu/route-authority", { method: "GET", path: `${prefix}/plain`, matchMode: "whatever" });
  hasAlert(plain, /GET .* added\./);
  const plainRow = await rowFor("GET", `${prefix}/plain`);
  assert.deepEqual([plainRow.badges, plainRow.roles, plainRow.match_mode, plainRow.description], [[], [], "all", null], "a match mode other than any is all, and no description is none");

  const again = await submit("/seu/route-authority", { method: "POST", path });
  assert.ok(again.alerts.length > 0 && !again.alerts.some((a) => /added\./.test(a)), JSON.stringify(again.alerts));
  assert.equal(again.location, "/aisworg/seu/route-authority/new", "a refused add leads back to the form");
});

test("the list shows a row and is searched by its path, and the edit page shows the row and the badges and roles that can be chosen", async () => {
  const path = `${prefix}/listed`;
  hasAlert(await submit("/seu/route-authority", { method: "PUT", path, badges: badgeA, roles: roleA, description: "Listed row" }), /added\./);
  const row = await rowFor("PUT", path);

  const page = await getPage(root, `/seu/route-authority?q=${encodeURIComponent(path)}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(path));
  assertPageDoesNotMatch((await getPage(root, `/seu/route-authority?q=${encodeURIComponent(`${prefix}/nothing-here`)}`)).html, new RegExp(path), "a search that matches no path lists no row");

  const edit = await getPage(root, `/seu/route-authority/${row.id}/edit`);
  assert.equal(edit.status, 200);
  assertPageMatches(edit.html, new RegExp(path));
  assertPageMatches(edit.html, new RegExp(badgeB), "the badges that can be chosen are listed");
  assertPageMatches(edit.html, new RegExp(roleA), "so are the roles");
  assert.equal((await getPage(root, "/seu/route-authority/new")).status, 200);

  const missing = await getRedirect(root, `/seu/route-authority/${randomUUID()}/edit`);
  assert.equal(missing.status, 302);
  assert.equal(missing.location, "/aisworg/seu/route-authority");
  hasAlert({ alerts: pageAlerts((await getPage(root, "/seu/route-authority")).html).map(readable) }, /Route authority row not found\./);
});

test("a row is updated with the badges, roles and mode posted, refused with an invalid form, and a row that does not exist cannot be updated", async () => {
  const path = `${prefix}/updated`;
  hasAlert(await submit("/seu/route-authority", { method: "DELETE", path, badges: badgeA, matchMode: "any" }), /added\./);
  const row = await rowFor("DELETE", path);

  const updated = await submit(`/seu/route-authority/${row.id}/update`, { method: "DELETE", path, badges: [badgeB], roles: [roleA], matchMode: "all", description: "Changed" });
  hasAlert(updated, new RegExp(`DELETE ${path} updated\\.`));
  assert.equal(updated.location, "/aisworg/seu/route-authority");
  const changed = await rowFor("DELETE", path);
  assert.deepEqual([changed.badges, changed.roles, changed.match_mode, changed.description], [[badgeB], [roleA], "all", "Changed"]);

  const refused = await submit(`/seu/route-authority/${row.id}/update`, { method: "DELETE", path: "no-slash" });
  hasAlert(refused, /Path must start with \/\./);
  assert.equal(refused.location, `/aisworg/seu/route-authority/${row.id}/edit`, "a refused update leads back to the edit page");
  assert.equal((await rowFor("DELETE", path)).description, "Changed", "a refused update changes nothing");

  const ghostId = randomUUID();
  const ghost = await postForm(root, `/seu/route-authority/${ghostId}/update`, csrf, { method: "DELETE", path: `${prefix}/ghost` });
  assert.equal(ghost.status, 302);
  assert.equal(ghost.location, `/aisworg/seu/route-authority/${ghostId}/edit`, "an update of a row that does not exist leads to its edit page");
  assert.equal(await rowFor("DELETE", `${prefix}/ghost`), undefined, "and creates nothing");
  await getPage(root, "/seu/route-authority");
});

test("a row is deleted, which takes the route out of the gate; the gate refuses a path with no row to a user who is not root, a row that asks for nothing lets the path through, and a deleted row refuses it again", async () => {
  const path = `${prefix}/gated`;
  const gatedPath = path.replace(/^\/aisworg/, "");
  const refusedBefore = await getRedirect(tester, gatedPath);

  hasAlert(await submit("/seu/route-authority", { method: "GET", path }), /added\./);
  const allowed = await getRedirect(tester, gatedPath);
  assert.notEqual(allowed.status, refusedBefore.status, "a row that asks for no badge or role changes the gate's answer");
  assert.ok(allowed.status === 404 || allowed.status === 500, `the request is let through to a path nothing serves, got ${allowed.status}`);

  const row = await rowFor("GET", path);
  hasAlert(await submit(`/seu/route-authority/${row.id}/delete`), /Row deleted\./);
  assert.equal(await rowFor("GET", path), undefined);
  const refusedAfter = await getRedirect(tester, gatedPath);
  assert.equal(refusedAfter.status, refusedBefore.status, "the deleted row refuses the request as before");
  assert.equal(refusedAfter.location, refusedBefore.location);

  hasAlert(await submit(`/seu/route-authority/${row.id}/delete`), /Row deleted\./);
});
