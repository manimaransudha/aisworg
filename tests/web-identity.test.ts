// Identity Management and Tenant Admin pages (src/routes/seu/web/identity.ts, tenantAdmin.ts): creating a tenant, creating a user with roles, updating a user,
// granting badges, and a tenant admin granting badges to the users of the tenant.
//
//   - Each route is called over HTTP from the real app as root. A POST answers with a redirect; the test reads the flash message on the page it leads to, then
//     reads the tenant, user, roles or badges from the database.
//   - The test creates its tenants and users under a run tag and removes them, with their participants_master rows, at the end. SMTP settings are removed
//     for the run, so creating a user returns the verification link and sends no mail.
//   - The users of the tenant admin page are the users of root's own tenant, so the test adds one there for the run and removes it.
//   - Roles and badges are taken from what the Ontology and the authority vocabulary hold at run time, not from literals.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { query } from "../src/utils/db.js";
import { userDB } from "../src/dblayer/userDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { listAuthorisedBadgeCodes, listAuthorisedRoleCodes, listGrantableNounVerbBadges } from "../src/routes/seu/core/identity.js";
import {
  ROOT_USER_ID,
  setWebBaseUrl, newSession, extractCsrf, getPage, postForm, pageAlerts, assertPageMatches, assertPageDoesNotMatch, type Session,
} from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const SMTP_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const savedSmtp: Record<string, string | undefined> = {};
const createdEmails: string[] = [];
const createdTenantIds: string[] = [];

let server: ReturnType<typeof app.listen>;
let root: Session;
let csrf: string;
let rootTenantId: string;
let roleA: string;
let roleB: string;
let badgeA: string;
let badgeB: string;

before(async () => {
  for (const key of SMTP_KEYS) {
    savedSmtp[key] = process.env[key];
    delete process.env[key];
  }
  const roles = (await listAuthorisedRoleCodes()).filter((r) => r !== "general" && r !== "superuser");
  assert.ok(roles.length >= 2, "the Ontology holds at least two grantable authorised roles");
  [roleA, roleB] = [roles[0]!, roles[1]!];
  const badges = await listAuthorisedBadgeCodes();
  assert.ok(badges.length >= 2, "the authority vocabulary holds at least two grantable badges");
  [badgeA, badgeB] = [badges[0]!, badges[1]!];
  const rootUser = await userDB.findById(ROOT_USER_ID);
  assert.ok(rootUser?.tenant_id, "root belongs to a tenant");
  rootTenantId = rootUser.tenant_id;

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to determine the ephemeral port the app bound to");
  setWebBaseUrl(`http://127.0.0.1:${address.port}/aisworg`);
  root = newSession(ROOT_USER_ID);
  csrf = extractCsrf((await getPage(root, "/seu/identity/tenants")).html);
});

after(async () => {
  for (const key of SMTP_KEYS) {
    if (savedSmtp[key] === undefined) delete process.env[key];
    else process.env[key] = savedSmtp[key];
  }
  await new Promise<void>((resolve, reject) => server.close((err: Error | undefined) => (err ? reject(err) : resolve())));
  await query("DELETE FROM participants_master WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))", [createdEmails]);
  await query("DELETE FROM participants_master WHERE tenant_id = ANY($1::uuid[])", [createdTenantIds]);
  await query("DELETE FROM users WHERE email = ANY($1::text[])", [createdEmails]);
  await query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [createdTenantIds]);
});

const readable = (text: string) => text.replace(/&quot;|&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

async function submit(pathName: string, fields: Record<string, string | string[]> = {}): Promise<string[]> {
  const posted = await postForm(root, pathName, csrf, fields);
  assert.equal(posted.status, 302, `POST ${pathName}`);
  assert.ok(posted.location);
  const page = await getPage(root, posted.location.replace(/^\/aisworg/, ""));
  assert.equal(page.status, 200, `GET ${posted.location}`);
  return pageAlerts(page.html).map(readable);
}

const hasAlert = (alerts: string[], pattern: RegExp) => assert.ok(alerts.some((a) => pattern.test(a)), `expected ${pattern}, the page showed ${JSON.stringify(alerts)}`);

async function tenantNamed(label: string): Promise<{ id: string; name: string; code: string }> {
  const code = `web-idt-${label}-${run}`;
  const name = `Web identity ${label} ${run}`;
  hasAlert(await submit("/seu/identity/tenants", { code, name }), new RegExp(`Tenant "${name}" created\\.`));
  const { data } = await tenantsDB.findByCode(code);
  assert.ok(data);
  createdTenantIds.push(data.id);
  return { id: data.id, name, code };
}

async function userIn(label: string, tenantId: string, roles: string[] = []): Promise<{ id: string; email: string }> {
  const email = `web-idt-${run}-${label}@test.local`;
  createdEmails.push(email);
  const alerts = await submit("/seu/identity/users", { email, name: `Web user ${label} ${run}`, tenantId, roles });
  hasAlert(alerts, /User created\. SMTP not configured — verification link: http/);
  const user = await userDB.findByEmail(email);
  assert.ok(user);
  return { id: user.id, email };
}

const master = async (userId: string) => (await participantsMasterDB.findByUserId(userId)).data;
const standing = <T extends { seu_ids: string[] }>(entries: T[] | undefined) => (entries ?? []).filter((e) => e.seu_ids.length === 0);

test("a tenant is created with a code and a name, refused without them or with a code in use, and listed and searched on the tenant page", async () => {
  hasAlert(await submit("/seu/identity/tenants", { code: "", name: "x" }), /Tenant code and name are required\./);
  hasAlert(await submit("/seu/identity/tenants", { code: "x", name: "  " }), /Tenant code and name are required\./);

  const tenant = await tenantNamed("created");
  const row = (await tenantsDB.findByCode(tenant.code)).data;
  assert.deepEqual([row?.name, row?.is_system], [tenant.name, false]);
  hasAlert(await submit("/seu/identity/tenants", { code: tenant.code, name: "Same code again" }), /Could not create Tenant: /);

  const other = await tenantNamed("other");
  const page = await getPage(root, `/seu/identity/tenants?q=${encodeURIComponent(tenant.code)}`);
  assertPageMatches(page.html, new RegExp(`<code>${tenant.code}</code>`));
  assertPageDoesNotMatch(page.html, new RegExp(`<code>${other.code}</code>`), "the search narrows the tenants");
});

test("a user is created in a tenant with authorised roles, refused without an email or a tenant, for an email in use, a tenant that does not exist and a role that does not exist", async () => {
  const tenant = await tenantNamed("users");
  hasAlert(await submit("/seu/identity/users", { email: " ", tenantId: tenant.id }), /Email is required\./);
  hasAlert(await submit("/seu/identity/users", { email: `web-idt-${run}-notenant@test.local`, tenantId: " " }), /A tenant must be selected\./);

  const created = await userIn("both-roles", tenant.id, [roleA, roleB]);
  const user = await userDB.findById(created.id);
  assert.deepEqual([user?.tenant_id, user?.type, user?.is_active], [tenant.id, "Tenant", false]);
  assert.deepEqual(standing((await master(created.id))?.authorised_role).map((e) => e.role).sort(), [roleA, roleB].sort());

  const single = await userIn("one-role", tenant.id, [roleA]);
  assert.deepEqual(standing((await master(single.id))?.authorised_role).map((e) => e.role), [roleA], "a single role is read as a list of one");

  hasAlert(await submit("/seu/identity/users", { email: created.email, tenantId: tenant.id }), new RegExp(`Could not create user: a user already exists for ${created.email}`));
  const noTenant = `web-idt-${run}-ghost-tenant@test.local`;
  createdEmails.push(noTenant);
  hasAlert(await submit("/seu/identity/users", { email: noTenant, tenantId: randomUUID() }), /Could not create user: tenant not found: /);
  const badRole = `web-idt-${run}-bad-role@test.local`;
  createdEmails.push(badRole);
  const alerts = await submit("/seu/identity/users", { email: badRole, tenantId: tenant.id, roles: [`zz-no-role-${run}`] });
  assert.ok(alerts.length > 0 && !alerts.some((a) => /^User created/.test(a)), JSON.stringify(alerts));
  assert.equal(await userDB.findByEmail(badRole), null, "a user with a role that does not exist is not created");
});

test("the user and badge pages list the users, filter them by tenant and search them", async () => {
  const tenantOne = await tenantNamed("filter-one");
  const tenantTwo = await tenantNamed("filter-two");
  const one = await userIn("filter-one", tenantOne.id);
  const two = await userIn("filter-two", tenantTwo.id);

  for (const pathName of ["/seu/identity/users", "/seu/identity/badges"]) {
    const filtered = await getPage(root, `${pathName}?tenant=${tenantOne.id}`);
    assert.equal(filtered.status, 200);
    assertPageMatches(filtered.html, new RegExp(one.email));
    assertPageDoesNotMatch(filtered.html, new RegExp(two.email), `${pathName}: the tenant filter shows only that tenant's users`);

    const searched = await getPage(root, `${pathName}?q=${encodeURIComponent(two.email)}`);
    assertPageMatches(searched.html, new RegExp(two.email));
    assertPageDoesNotMatch(searched.html, new RegExp(one.email), `${pathName}: the search narrows the users`);

    const unknownTenant = await getPage(root, `${pathName}?tenant=${randomUUID()}&q=${encodeURIComponent(one.email)}`);
    assertPageMatches(unknownTenant.html, new RegExp(one.email), "a tenant that has no users is ignored");
  }
});

test("a user is activated or deactivated and given exactly the roles posted, and root cannot edit their own account or a user that does not exist", async () => {
  const tenant = await tenantNamed("update");
  const created = await userIn("update", tenant.id, [roleA]);

  hasAlert(await submit(`/seu/identity/users/${created.id}/update`, { isActive: "true", roles: [roleB] }), /User updated\./);
  assert.equal((await userDB.findById(created.id))?.is_active, true);
  assert.deepEqual(standing((await master(created.id))?.authorised_role).map((e) => e.role), [roleB], "the roles posted replace the ones the user held");

  hasAlert(await submit(`/seu/identity/users/${created.id}/update`, { isActive: "false" }), /User updated\./);
  assert.equal((await userDB.findById(created.id))?.is_active, false);
  assert.deepEqual(standing((await master(created.id))?.authorised_role).map((e) => e.role).filter((r) => r !== "general"), [], "no role posted revokes the roles that can be revoked");

  hasAlert(await submit(`/seu/identity/users/${ROOT_USER_ID}/update`, { isActive: "true", roles: [] }), /Could not update user: you can't edit your own account from here/);
  hasAlert(await submit(`/seu/identity/users/${randomUUID()}/update`, { isActive: "true" }), /Could not update user: user not found/);
});

test("badges are granted to a user exactly as posted, and refused for a badge that does not exist, for root's own account and for a user that does not exist", async () => {
  const tenant = await tenantNamed("badges");
  const created = await userIn("badges", tenant.id);

  hasAlert(await submit(`/seu/identity/badges/${created.id}/update`, { badges: [badgeA, badgeB] }), /Badges updated\./);
  assert.deepEqual(standing((await master(created.id))?.authorised_badges).map((e) => e.badge).sort(), [badgeA, badgeB].sort());
  hasAlert(await submit(`/seu/identity/badges/${created.id}/update`, { badges: badgeA }), /Badges updated\./);
  assert.deepEqual(standing((await master(created.id))?.authorised_badges).map((e) => e.badge), [badgeA], "a badge left out is revoked");

  hasAlert(await submit(`/seu/identity/badges/${created.id}/update`, { badges: `zz-no-badge-${run}` }), new RegExp(`Could not update authorised badges: "zz-no-badge-${run}" is not a real badge\\. Allowed: `));
  assert.deepEqual(standing((await master(created.id))?.authorised_badges).map((e) => e.badge), [badgeA], "a refused update changes nothing");
  hasAlert(await submit(`/seu/identity/badges/${ROOT_USER_ID}/update`, { badges: [badgeA] }), /Could not update authorised badges: you can't edit your own account from here/);
  hasAlert(await submit(`/seu/identity/badges/${randomUUID()}/update`, { badges: [] }), /Could not update authorised badges: user not found/);
});

test("the Identity hub shows its cards, including Route Authority for a holder of the route authority badge", async () => {
  const page = await getPage(root, "/seu/identity");
  assert.equal(page.status, 200);
  assertPageMatches(page.html, /\/aisworg\/seu\/identity\/badges/);
  assertPageMatches(page.html, /\/aisworg\/seu\/route-authority/, "root holds the badge that shows the Route Authority card");
});

test("the users of the tenant admin page are those of the viewer's tenant, and a tenant admin grants them badges, but not to another tenant's user or with a badge that does not exist", async () => {
  const mine = await userIn("tenant-admin-mine", rootTenantId);
  const otherTenant = await tenantNamed("tenant-admin-other");
  const theirs = await userIn("tenant-admin-theirs", otherTenant.id);
  const grantable = await listGrantableNounVerbBadges();
  assert.ok(grantable.length > 0, "the authority vocabulary holds noun-verb badges");

  const page = await getPage(root, `/seu/tenant-admin/users?q=${encodeURIComponent(mine.email)}`);
  assert.equal(page.status, 200);
  assertPageMatches(page.html, new RegExp(mine.email));
  assertPageDoesNotMatch((await getPage(root, "/seu/tenant-admin/users")).html, new RegExp(theirs.email), "another tenant's users are not listed");

  hasAlert(await submit(`/seu/tenant-admin/users/${mine.id}/badges`, { badges: [grantable[0]] }), /Badges updated\./);
  assert.deepEqual(standing((await master(mine.id))?.authorised_badges).map((e) => e.badge), [grantable[0]]);
  hasAlert(await submit(`/seu/tenant-admin/users/${mine.id}/badges`, { badges: [" ", ""] }), /Badges updated\./);
  assert.deepEqual(standing((await master(mine.id))?.authorised_badges), [], "blank entries are ignored, so nothing is granted");

  hasAlert(await submit(`/seu/tenant-admin/users/${theirs.id}/badges`, { badges: [grantable[0]] }), /Could not update badges: that user is not in your tenant/);
  hasAlert(await submit(`/seu/tenant-admin/users/${mine.id}/badges`, { badges: `zz-no-badge-${run}` }), /Could not update badges: ".*" is not a real badge/);
  hasAlert(await submit(`/seu/tenant-admin/users/${randomUUID()}/badges`, { badges: [grantable[0]] }), /Could not update badges: user not found/);
});
