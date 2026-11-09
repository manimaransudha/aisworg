// identity (src/routes/seu/core/identity.ts): the users, roles, badges and tenants behind the Identity, Badge and Tenant Admin pages.
//
//   - Every function here is called only from a web controller, so these tests call the core functions directly.
//   - The test creates its own tenants and users under a random run tag and removes them, with their participants_master rows, at the end.
//   - Roles and badges are taken from what the Ontology and the authority vocabulary hold at run time, not from literals.
//   - SMTP settings are removed for the run, so createPlatformUser returns the verification link and sends no mail.
import { getPlatformTenantId } from "../src/dblayer/constants.js";
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { query } from "../src/utils/db.js";
import { parseListParams } from "../src/utils/listQuery.js";
import { userDB } from "../src/dblayer/userDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { NO_EXPIRY_DATE } from "../src/dblayer/constants.js";
import {
  createPlatformUser,
  createTenant,
  getIdentityCounts,
  listAdminSurfaceBadgeCodes,
  listAllTenants,
  listAuthorisedBadgeCodes,
  listAuthorisedRoleCodes,
  listGrantableNounVerbBadges,
  listPlatformUsersPaginated,
  listTenantsForManagement,
  listUserTenantFilterOptions,
  listUsersForTenant,
  setAuthorisedBadges,
  setAuthorisedRoles,
  setTenantUserAuthorisedBadges,
  updatePlatformUser,
} from "../src/routes/seu/core/identity.js";
import { PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdTenantIds: string[] = [];
const savedSmtp: Record<string, string | undefined> = {};
const SMTP_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];

let tenantA: { id: string; name: string };
let tenantB: { id: string; name: string };
let roleA: string;
let roleB: string;
let badgeA: string;
let badgeB: string;

async function makeTenant(label: string): Promise<{ id: string; name: string }> {
  const { data, error } = await tenantsDB.create({ code: `idt-${label}-${run}`, name: `Identity ${label} ${run}`, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  if (error || !data) throw error ?? new Error("tenant not created");
  createdTenantIds.push(data.id);
  return { id: data.id, name: data.name };
}

async function makeUser(label: string, tenantId: string): Promise<{ id: string; email: string }> {
  const email = `idt-${run}-${label}@test.local`;
  createdEmails.push(email);
  const user = await userDB.createLocalPending({ email, name: `Identity ${label} ${run}`, verification_token: randomUUID(), verification_expires: new Date(Date.now() + 60_000), type: "Tenant", tenant_id: tenantId });
  return { id: user.id, email: user.email };
}

async function masterRowCount(userId: string): Promise<number> {
  const { rows } = await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM participants_master WHERE user_id = $1", [userId]);
  return rows[0]!.n;
}

async function standingRoles(userId: string): Promise<string[]> {
  const { data } = await participantsMasterDB.findByUserId(userId);
  return (data?.authorised_role ?? []).filter((e) => e.seu_ids.length === 0).map((e) => e.role).sort();
}

async function standingBadges(userId: string): Promise<string[]> {
  const { data } = await participantsMasterDB.findByUserId(userId);
  return (data?.authorised_badges ?? []).filter((e) => e.seu_ids.length === 0).map((e) => e.badge).sort();
}

before(async () => {
  for (const key of SMTP_KEYS) {
    savedSmtp[key] = process.env[key];
    delete process.env[key];
  }
  tenantA = await makeTenant("a");
  tenantB = await makeTenant("b");

  const roles = (await listAuthorisedRoleCodes()).filter((r) => r !== "general" && r !== "superuser");
  assert.ok(roles.length >= 2, "the Ontology must hold at least two grantable authorised roles");
  [roleA, roleB] = [roles[0]!, roles[1]!];

  const badges = await listAuthorisedBadgeCodes();
  assert.ok(badges.length >= 2, "the authority vocabulary must hold at least two grantable badges");
  [badgeA, badgeB] = [badges[0]!, badges[1]!];
});

after(async () => {
  for (const key of SMTP_KEYS) {
    if (savedSmtp[key] === undefined) delete process.env[key];
    else process.env[key] = savedSmtp[key];
  }
  await query("DELETE FROM participants_master WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))", [createdEmails]);
  await query("DELETE FROM participants_master WHERE tenant_id = ANY($1::uuid[])", [createdTenantIds]);
  await query("DELETE FROM users WHERE email = ANY($1::text[])", [createdEmails]);
  await query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [createdTenantIds]);
});

// ---- tenants ----------------------------------------------------------------

test("createTenant creates a non-system tenant and refuses a second one with the same code", async () => {
  const code = `idt-created-${run}`;
  const first = await createTenant({ code, name: "Identity created", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  createdTenantIds.push(first.tenant.id);
  assert.equal(first.tenant.code, code);
  assert.equal(first.tenant.is_system, false);

  const second = await createTenant({ code, name: "Identity created again", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE, is_system: false });
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.reason, "validation_failed");
  assert.ok(second.detail.length > 0);
});

test("listTenantsForManagement lists the non-system tenants and listAllTenants also lists the system tenant", async () => {
  const managed = await listTenantsForManagement();
  assert.ok(managed.some((t) => t.id === tenantA.id));
  assert.ok(managed.every((t) => !t.is_system));

  const all = await listAllTenants();
  const platformTenantId = await getPlatformTenantId();
  assert.ok(all.some((t) => t.id === tenantA.id));
  assert.ok(all.some((t) => t.id === platformTenantId && t.is_system));
});

// ---- creating users ---------------------------------------------------------

test("createPlatformUser creates a pending Tenant user, grants the roles and returns the verification link", async () => {
  const email = `idt-${run}-created@test.local`;
  createdEmails.push(email);
  const result = await createPlatformUser({ email, name: "Identity created", tenantId: tenantA.id, authorisedRoles: [roleA] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, email);
  assert.ok(result.verificationLink?.includes("/aisworg/auth/verify?token="), `unexpected link ${result.verificationLink}`);

  const user = await userDB.findByEmail(email);
  assert.ok(user);
  assert.equal(user.type, "Tenant");
  assert.equal(user.is_active, false);
  assert.equal(user.tenant_id, tenantA.id);
  assert.deepEqual(await standingRoles(user.id), [roleA]);
  assert.equal(await masterRowCount(user.id), 1);
});

test("createPlatformUser makes a user in the tenant given; the user's type follows the tenant's is_system", async () => {
  const testPlatformTenantId = PLATFORM_TENANT_ID;
  const tenant = await tenantsDB.findById(testPlatformTenantId);
  assert.equal(tenant.data?.is_system, false);

  const email = `idt-${run}-platform@test.local`;
  createdEmails.push(email);
  const result = await createPlatformUser({ email, tenantId: testPlatformTenantId });
  assert.equal(result.ok, true);
  const user = await userDB.findByEmail(email);
  assert.equal(user?.type, "Tenant");
  assert.equal(user?.tenant_id, testPlatformTenantId);
  assert.equal(user?.name, email, "the name defaults to the email");
});

test("createPlatformUser refuses an existing email, an unknown tenant and an unknown role", async () => {
  const existing = await makeUser("existing", tenantA.id);
  const duplicate = await createPlatformUser({ email: existing.email, tenantId: tenantA.id });
  assert.deepEqual(duplicate, { ok: false, detail: `a user already exists for ${existing.email}` });

  const missingTenantId = randomUUID();
  const email = `idt-${run}-no-tenant@test.local`;
  createdEmails.push(email);
  const noTenant = await createPlatformUser({ email, tenantId: missingTenantId });
  assert.deepEqual(noTenant, { ok: false, detail: `tenant not found: ${missingTenantId}` });
  assert.equal(await userDB.findByEmail(email), null);

  const badRoleEmail = `idt-${run}-bad-role@test.local`;
  createdEmails.push(badRoleEmail);
  await assert.rejects(createPlatformUser({ email: badRoleEmail, tenantId: tenantA.id, authorisedRoles: [`not-a-role-${run}`] }));
  assert.equal(await userDB.findByEmail(badRoleEmail), null, "no user is created when a role is not canonical");
});

// ---- activating users -------------------------------------------------------

test("updatePlatformUser activates and deactivates a user, and refuses an unknown user and the acting user", async () => {
  const user = await makeUser("active", tenantA.id);

  assert.deepEqual(await updatePlatformUser({ id: user.id, isActive: true, actingUserEmail: null }), { ok: true });
  assert.equal((await userDB.findById(user.id))?.is_active, true);
  assert.deepEqual(await updatePlatformUser({ id: user.id, isActive: false, actingUserEmail: "someone.else@test.local" }), { ok: true });
  assert.equal((await userDB.findById(user.id))?.is_active, false);

  assert.deepEqual(await updatePlatformUser({ id: randomUUID(), isActive: true, actingUserEmail: null }), { ok: false, detail: "user not found" });
  assert.deepEqual(await updatePlatformUser({ id: user.id, isActive: true, actingUserEmail: user.email }), { ok: false, detail: "you can't edit your own account from here" });
  assert.equal((await userDB.findById(user.id))?.is_active, false, "a refused update changes nothing");
});

// ---- roles ------------------------------------------------------------------

test("setAuthorisedRoles creates one participant master for the user and reuses it on every later call", async () => {
  const user = await makeUser("roles-once", tenantA.id);
  assert.equal(await masterRowCount(user.id), 0);

  assert.deepEqual(await setAuthorisedRoles({ id: user.id, roles: [roleA], actingUserEmail: null }), { ok: true });
  assert.equal(await masterRowCount(user.id), 1);
  const { data: master } = await participantsMasterDB.findByUserId(user.id);
  assert.equal(master?.tenant_id, tenantA.id);
  assert.equal(master?.type, "Human");

  assert.deepEqual(await setAuthorisedRoles({ id: user.id, roles: [roleA, roleB], actingUserEmail: null }), { ok: true });
  assert.equal(await masterRowCount(user.id), 1, "a second save must update the same participant master");
  assert.deepEqual(await standingRoles(user.id), [roleA, roleB].sort());
});

test("setAuthorisedRoles removes an unselected standing role and keeps the general role and the SEU-scoped roles", async () => {
  const user = await makeUser("roles-keep", tenantA.id);
  await setAuthorisedRoles({ id: user.id, roles: [roleA], actingUserEmail: null });
  const { data: master } = await participantsMasterDB.findByUserId(user.id);
  assert.ok(master);
  const scoped = { role: roleB, effective_till: NO_EXPIRY_DATE, seu_ids: [randomUUID()] };
  await participantsMasterDB.setAuthorisedRole(master.id, [...master.authorised_role, { role: "general", effective_till: NO_EXPIRY_DATE, seu_ids: [] }, scoped]);

  assert.deepEqual(await setAuthorisedRoles({ id: user.id, roles: [], actingUserEmail: null }), { ok: true });
  const { data: after } = await participantsMasterDB.findByUserId(user.id);
  assert.deepEqual(await standingRoles(user.id), ["general"], "roleA is revoked and general stays");
  assert.deepEqual(after?.authorised_role.filter((e) => e.seu_ids.length > 0), [scoped], "the SEU-scoped grant stays");
});

test("setAuthorisedRoles refuses an unknown user and the acting user, and rejects a role that is not canonical", async () => {
  const user = await makeUser("roles-refused", tenantA.id);
  assert.deepEqual(await setAuthorisedRoles({ id: randomUUID(), roles: [], actingUserEmail: null }), { ok: false, detail: "user not found" });
  assert.deepEqual(await setAuthorisedRoles({ id: user.id, roles: [roleA], actingUserEmail: user.email }), { ok: false, detail: "you can't edit your own account from here" });
  await assert.rejects(setAuthorisedRoles({ id: user.id, roles: [`not-a-role-${run}`], actingUserEmail: null }));
  assert.equal(await masterRowCount(user.id), 0, "a refused save creates no participant master");
});

// ---- badges -----------------------------------------------------------------

test("setAuthorisedBadges grants real badges on one participant master and revokes the unselected standing ones", async () => {
  const user = await makeUser("badges", tenantA.id);

  assert.deepEqual(await setAuthorisedBadges({ id: user.id, badges: [badgeA], actingUserEmail: null }), { ok: true });
  assert.equal(await masterRowCount(user.id), 1);
  assert.deepEqual(await standingBadges(user.id), [badgeA]);

  assert.deepEqual(await setAuthorisedBadges({ id: user.id, badges: [badgeA, badgeB], actingUserEmail: null }), { ok: true });
  assert.equal(await masterRowCount(user.id), 1, "a second save must update the same participant master");
  assert.deepEqual(await standingBadges(user.id), [badgeA, badgeB].sort());

  const { data: master } = await participantsMasterDB.findByUserId(user.id);
  assert.ok(master);
  const scoped = { badge: badgeA, effective_till: NO_EXPIRY_DATE, seu_ids: [randomUUID()] };
  await participantsMasterDB.setAuthorisedBadges(master.id, [...master.authorised_badges, scoped]);

  assert.deepEqual(await setAuthorisedBadges({ id: user.id, badges: [badgeB], actingUserEmail: null }), { ok: true });
  const { data: after } = await participantsMasterDB.findByUserId(user.id);
  assert.deepEqual(await standingBadges(user.id), [badgeB], "badgeA is revoked as a standing grant");
  assert.deepEqual(after?.authorised_badges.filter((e) => e.seu_ids.length > 0), [scoped], "the SEU-scoped grant stays");
});

test("setAuthorisedBadges refuses a badge that is not real, an unknown user and the acting user", async () => {
  const user = await makeUser("badges-refused", tenantA.id);
  const fake = `not_a_badge_${run}`;
  const notReal = await setAuthorisedBadges({ id: user.id, badges: [badgeA, fake], actingUserEmail: null });
  assert.equal(notReal.ok, false);
  if (!notReal.ok) assert.ok(notReal.detail.startsWith(`"${fake}" is not a real badge. Allowed: `), notReal.detail);
  assert.equal(await masterRowCount(user.id), 0, "a refused save creates no participant master");

  assert.deepEqual(await setAuthorisedBadges({ id: randomUUID(), badges: [], actingUserEmail: null }), { ok: false, detail: "user not found" });
  assert.deepEqual(await setAuthorisedBadges({ id: user.id, badges: [badgeA], actingUserEmail: user.email }), { ok: false, detail: "you can't edit your own account from here" });
});

test("setTenantUserAuthorisedBadges grants within the acting tenant and refuses an unknown user or another tenant's user", async () => {
  const own = await makeUser("tenant-own", tenantA.id);
  const other = await makeUser("tenant-other", tenantB.id);

  assert.deepEqual(await setTenantUserAuthorisedBadges({ actingTenantId: tenantA.id, userId: own.id, badges: [badgeA] }), { ok: true });
  assert.deepEqual(await standingBadges(own.id), [badgeA]);

  assert.deepEqual(await setTenantUserAuthorisedBadges({ actingTenantId: tenantA.id, userId: randomUUID(), badges: [] }), { ok: false, detail: "user not found" });
  assert.deepEqual(await setTenantUserAuthorisedBadges({ actingTenantId: tenantA.id, userId: other.id, badges: [badgeA] }), { ok: false, detail: "that user is not in your tenant" });
  assert.equal(await masterRowCount(other.id), 0, "a refused grant touches nothing");
});

// ---- badge and role vocabularies --------------------------------------------

test("the badge vocabularies are sorted, without duplicates, and the grantable badges are the union of the two lists", async () => {
  const nounVerb = await listGrantableNounVerbBadges();
  const adminSurface = await listAdminSurfaceBadgeCodes();
  const all = await listAuthorisedBadgeCodes();

  for (const list of [nounVerb, adminSurface, all]) {
    assert.deepEqual(list, [...new Set(list)].sort());
  }
  assert.ok(nounVerb.every((b) => b.includes("_")), "a noun-verb badge is <noun>_<verb>");
  assert.deepEqual(all, [...new Set([...nounVerb, ...adminSurface])].sort());
});

test("listAuthorisedRoleCodes lists the Ontology's authorised roles", async () => {
  const roles = await listAuthorisedRoleCodes();
  assert.ok(roles.includes(roleA));
  assert.ok(roles.includes(roleB));
});

// ---- listing users ----------------------------------------------------------

test("listPlatformUsersPaginated lists a tenant's users with the standing roles and badges of each", async () => {
  const user = await makeUser("list", tenantA.id);
  await setAuthorisedRoles({ id: user.id, roles: [roleA, roleB], actingUserEmail: null });
  await setAuthorisedBadges({ id: user.id, badges: [badgeA], actingUserEmail: null });
  const { data: master } = await participantsMasterDB.findByUserId(user.id);
  assert.ok(master);
  await participantsMasterDB.setAuthorisedRole(master.id, [
    ...master.authorised_role,
    { role: "general", effective_till: "2000-01-01", seu_ids: [] },
    { role: "participant", effective_till: NO_EXPIRY_DATE, seu_ids: [randomUUID()] },
  ]);
  const noGrants = await makeUser("list-no-master", tenantA.id);

  const params = parseListParams({ q: `idt-${run}`, pageSize: "100" }, { sortable: ["email", "name", "created"], defaultSort: "created", defaultDir: "desc" });
  const page = await listPlatformUsersPaginated(params, tenantA.id);
  assert.equal(page.total, page.items.length, "every user of this run in the tenant matches the search");
  assert.ok(page.items.every((u) => u.tenantId === tenantA.id && u.tenantName === tenantA.name));

  const row = page.items.find((u) => u.id === user.id);
  assert.ok(row);
  assert.deepEqual([...row.authorisedRoles].sort(), [roleA, roleB].sort(), "an expired grant and an SEU-scoped grant are left out");
  assert.equal(row.role, row.authorisedRoles.join(", "));
  assert.deepEqual(row.authorisedBadges, [badgeA]);
  assert.equal(row.created_at, new Date(row.created_at).toISOString());

  const bare = page.items.find((u) => u.id === noGrants.id);
  assert.deepEqual([bare?.authorisedRoles, bare?.authorisedBadges, bare?.role], [[], [], ""]);
});

test("listPlatformUsersPaginated without a tenant lists users of every tenant, and an empty result needs no authorisation lookup", async () => {
  const user = await makeUser("list-other", tenantB.id);
  const all = await listPlatformUsersPaginated(parseListParams({ q: `idt-${run}`, pageSize: "100" }, { sortable: ["email"], defaultSort: "email" }));
  assert.ok(all.items.some((u) => u.id === user.id && u.tenantId === tenantB.id));
  assert.ok(all.items.some((u) => u.tenantId === tenantA.id));

  const none = await listPlatformUsersPaginated(parseListParams({ q: `no-such-user-${randomUUID()}` }, { sortable: ["email"], defaultSort: "email" }));
  assert.equal(none.total, 0);
  assert.deepEqual(none.items, []);
});

test("listUsersForTenant lists only that tenant's users with their standing roles and badges", async () => {
  const empty = await makeTenant("empty");
  assert.deepEqual(await listUsersForTenant(empty.id), []);

  const user = await makeUser("for-tenant", tenantB.id);
  await setAuthorisedRoles({ id: user.id, roles: [roleA], actingUserEmail: null });
  await setAuthorisedBadges({ id: user.id, badges: [badgeB], actingUserEmail: null });
  const { data: master } = await participantsMasterDB.findByUserId(user.id);
  assert.ok(master);
  await participantsMasterDB.setAuthorisedBadges(master.id, [
    ...master.authorised_badges,
    { badge: badgeA, effective_till: "2000-01-01", seu_ids: [] },
    { badge: badgeA, effective_till: NO_EXPIRY_DATE, seu_ids: [randomUUID()] },
  ]);

  const users = await listUsersForTenant(tenantB.id);
  assert.ok(users.every((u) => u.tenantId === tenantB.id && u.tenantName === tenantB.name));
  assert.ok(!users.some((u) => u.email.startsWith(`idt-${run}-list@`)), "a user of another tenant is not listed");
  const row = users.find((u) => u.id === user.id);
  assert.ok(row);
  assert.deepEqual(row.authorisedRoles, [roleA]);
  assert.deepEqual(row.authorisedBadges, [badgeB], "an expired grant and an SEU-scoped grant are left out");
  assert.equal(row.role, roleA);
  assert.equal(row.created_at, new Date(row.created_at).toISOString());
});

// ---- counts and filters -----------------------------------------------------

test("getIdentityCounts counts the non-system tenants and every user", async () => {
  const counts = await getIdentityCounts();
  assert.ok(counts.tenants >= 2, "tenants A and B are non-system tenants");
  const { rows } = await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users WHERE email = ANY($1::text[])", [createdEmails]);
  assert.ok(counts.users >= rows[0]!.n, "the count includes the users this run created");
});

test("listUserTenantFilterOptions lists the tenants that have users, sorted by name", async () => {
  await makeUser("filter-a", tenantA.id);
  const noUsers = await makeTenant("no-users");
  const options = await listUserTenantFilterOptions();
  assert.ok(options.some((o) => o.id === tenantA.id && o.name === tenantA.name));
  assert.ok(!options.some((o) => o.id === noUsers.id), "a tenant with no users is not offered");
  assert.deepEqual(options.map((o) => o.name), options.map((o) => o.name).sort((a, b) => a.localeCompare(b)));
});
