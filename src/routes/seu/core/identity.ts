import { createRequire } from "module";
const require = createRequire(import.meta.url);
const crypto = require("crypto");

import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { userDB } from "../../../dblayer/userDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { authorityVocabularyDB } from "../../../dblayer/authorityVocabularyDB.js";
import { emailService } from "../../../domain/auth/emailService.js";
import { query } from "../../../utils/db.js";
import { ontologyDB, type OntologyViewer } from "../../../dblayer/ontologyDB.js";
import { assertCanonicalCategory } from "./ontology.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { createParticipantMaster } from "./participantsMaster.js";
import type { BadgeTypeRow, TenantRow } from "../../../dblayer/seuTypes.js";

export interface PlatformUserView {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  tenantId: string | null;
  tenantName: string | null;
  authorisedRoles: string[];
  authorisedBadges: string[];
}

export interface IdentityDashboardView {
  tenants: TenantRow[];
  badgeTypes: BadgeTypeRow[];
  users: PlatformUserView[];
  authorisedRoleCodes: string[];
  authorisedBadgeCodes: string[];
}

export async function listTenantsForManagement(): Promise<TenantRow[]> {
  const { data } = await tenantsDB.findAllOperational();
  return data ?? [];
}

export async function getIdentityDashboardView(): Promise<IdentityDashboardView> {
  const [{ data: tenants }, badgeTypesResult] = await Promise.all([tenantsDB.findAll(), query<BadgeTypeRow>("SELECT * FROM badge_types ORDER BY tenant_id NULLS FIRST, code")]);

  const { rows: userRows } = await query<{ id: number; email: string; name: string | null; is_active: boolean; created_at: string; tenant_id: string | null }>(
    "SELECT id, email, name, is_active, created_at, tenant_id FROM users ORDER BY created_at DESC"
  );
  const tenantNameById = new Map<string, string>((tenants ?? []).map((t) => [t.id, t.name]));

  const { rows: masterRows } = await query<{ user_id: number; authorised_role: Array<{ role: string; effective_till: string; seu_ids: string[] }> }>(
    "SELECT user_id, authorised_role FROM participants_master WHERE user_id IS NOT NULL"
  );
  const now = new Date();
  const authorisedRolesByUserId = new Map<number, string[]>(
    masterRows.map((m) => [
      m.user_id,
      m.authorised_role.filter((e) => e.seu_ids.length === 0 && new Date(e.effective_till).getTime() >= now.getTime()).map((e) => e.role),
    ])
  );

  const { data: authorisedRoleConcepts } = await ontologyDB.findConceptsByType("authorised-role", { isRoot: true, tenantId: null });
  const authorisedRoleCodes = (authorisedRoleConcepts ?? []).map((c) => c.code);

  const { rows: masterBadgeRows } = await query<{ user_id: number; authorised_badges: Array<{ badge: string; effective_till: string; seu_ids: string[] }> }>(
    "SELECT user_id, authorised_badges FROM participants_master WHERE user_id IS NOT NULL"
  );
  const authorisedBadgesByUserId = new Map<number, string[]>(
    masterBadgeRows.map((m) => [
      m.user_id,
      m.authorised_badges.filter((e) => e.seu_ids.length === 0 && new Date(e.effective_till).getTime() >= now.getTime()).map((e) => e.badge),
    ])
  );
  const [nounVerbBadgeCodes, adminSurfaceBadgeCodes] = await Promise.all([listGrantableNounVerbBadges(), listAdminSurfaceBadgeCodes()]);
  const authorisedBadgeCodes = [...new Set([...nounVerbBadgeCodes, ...adminSurfaceBadgeCodes])].sort();

  const users: PlatformUserView[] = userRows.map((u) => ({
    ...u,
    role: (authorisedRolesByUserId.get(u.id) ?? []).join(", "),
    tenantId: u.tenant_id,
    tenantName: u.tenant_id ? tenantNameById.get(u.tenant_id) ?? null : null,
    authorisedRoles: authorisedRolesByUserId.get(u.id) ?? [],
    authorisedBadges: authorisedBadgesByUserId.get(u.id) ?? [],
  }));

  return { tenants: tenants ?? [], badgeTypes: badgeTypesResult.rows, users, authorisedRoleCodes, authorisedBadgeCodes };
}

export type CreatePlatformUserResult = { ok: true; email: string; verificationLink: string | null } | { ok: false; detail: string };

export async function createPlatformUser(input: { email: string; name?: string; tenantId: string; authorisedRoles?: string[] }): Promise<CreatePlatformUserResult> {
  const existing = await userDB.findByEmail(input.email);
  if (existing) return { ok: false, detail: `a user already exists for ${input.email}` };

  const { data: tenant } = await tenantsDB.findById(input.tenantId);
  if (!tenant) return { ok: false, detail: `tenant not found: ${input.tenantId}` };
  const type: "Platform" | "Tenant" = tenant.is_system ? "Platform" : "Tenant";

  const viewer: OntologyViewer = { isRoot: true, tenantId: null };
  for (const role of input.authorisedRoles ?? []) {
    await assertCanonicalCategory("authorised-role", role, viewer);
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const created = await userDB.createLocalPending({ email: input.email, name: input.name || input.email, verification_token: token, verification_expires: expires, type, tenant_id: tenant.id });

  const rolesResult = await setAuthorisedRoles({ id: created.id, roles: input.authorisedRoles ?? [], actingUserEmail: null });
  if (!rolesResult.ok) return { ok: false, detail: `user created, but authorised roles failed: ${rolesResult.detail}` };

  const result = await emailService.sendVerification({ to: input.email, name: input.name || input.email, token });
  return { ok: true, email: input.email, verificationLink: result.link ?? null };
}

export type UpdatePlatformUserResult = { ok: true } | { ok: false; detail: string };

export async function updatePlatformUser(input: { id: string; isActive: boolean; actingUserEmail: string | null }): Promise<UpdatePlatformUserResult> {
  const user = await userDB.findById(input.id);
  if (!user) return { ok: false, detail: "user not found" };
  if (input.actingUserEmail && user.email === input.actingUserEmail) return { ok: false, detail: "you can't edit your own account from here" };
  await userDB.setActive(user.email, input.isActive);
  return { ok: true };
}

const NON_REVOCABLE_ROLES = new Set(["general"]);

export async function setAuthorisedRoles(input: { id: string; roles: string[]; actingUserEmail: string | null }): Promise<UpdatePlatformUserResult> {
  const user = await userDB.findById(input.id);
  if (!user) return { ok: false, detail: "user not found" };
  if (input.actingUserEmail && user.email === input.actingUserEmail) return { ok: false, detail: "you can't edit your own account from here" };

  const viewer: OntologyViewer = { isRoot: true, tenantId: null };
  for (const role of input.roles) {
    await assertCanonicalCategory("authorised-role", role, viewer);
  }

  const { data: existingMaster } = await participantsMasterDB.findById(input.id);
  const master = existingMaster ?? (await createParticipantMaster({
    tenantId: user.tenant_id,
    type: "Human",
    displayName: user.name || user.email,
    userId: input.id,
  }));

  const selected = new Set(input.roles);
  const kept = master.authorised_role.filter((entry) => entry.seu_ids.length > 0 || selected.has(entry.role) || NON_REVOCABLE_ROLES.has(entry.role));
  const alreadyKeptRoles = new Set(kept.filter((entry) => entry.seu_ids.length === 0).map((entry) => entry.role));
  const added = [...selected].filter((role) => !alreadyKeptRoles.has(role)).map((role) => ({ role, effective_till: "9999-12-31", seu_ids: [] as string[] }));

  const { error } = await participantsMasterDB.setAuthorisedRole(master.id, [...kept, ...added]);
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

export async function listAdminSurfaceBadgeCodes(): Promise<string[]> {
  const viewer: OntologyViewer = { isRoot: true, tenantId: null };
  const [{ data: platformConcepts }, { data: tenantConcepts }] = await Promise.all([
    ontologyDB.findConceptsByType("badges:platform", viewer),
    ontologyDB.findConceptsByType("badges:tenant", viewer),
  ]);
  return [...new Set([...(platformConcepts ?? []), ...(tenantConcepts ?? [])].map((c) => c.code))].sort();
}

export async function setAuthorisedBadges(input: { id: string; badges: string[]; actingUserEmail: string | null }): Promise<UpdatePlatformUserResult> {
  const user = await userDB.findById(input.id);
  if (!user) return { ok: false, detail: "user not found" };
  if (input.actingUserEmail && user.email === input.actingUserEmail) return { ok: false, detail: "you can't edit your own account from here" };

  const [nounVerbBadges, adminSurfaceBadges] = await Promise.all([listGrantableNounVerbBadges(), listAdminSurfaceBadgeCodes()]);
  const grantable = new Set([...nounVerbBadges, ...adminSurfaceBadges]);
  for (const badge of input.badges) {
    if (!grantable.has(badge)) return { ok: false, detail: `"${badge}" is not a real badge. Allowed: ${[...grantable].join(", ") || "(none registered)"}` };
  }

  const { data: existingMaster } = await participantsMasterDB.findById(input.id);
  const master = existingMaster ?? (await createParticipantMaster({
    tenantId: user.tenant_id,
    type: "Human",
    displayName: user.name || user.email,
    userId: input.id,
  }));

  const selected = new Set(input.badges);
  const kept = master.authorised_badges.filter((entry) => entry.seu_ids.length > 0 || selected.has(entry.badge));
  const alreadyKeptBadges = new Set(kept.filter((entry) => entry.seu_ids.length === 0).map((entry) => entry.badge));
  const added = [...selected].filter((badge) => !alreadyKeptBadges.has(badge)).map((badge) => ({ badge, effective_till: "9999-12-31", seu_ids: [] as string[] }));

  const { error } = await participantsMasterDB.setAuthorisedBadges(master.id, [...kept, ...added]);
  if (error) return { ok: false, detail: error.message };
  return { ok: true };
}

export type CreateTenantResult =
  | { ok: true; tenant: TenantRow }
  | { ok: false; reason: "validation_failed"; detail: string };

export async function createTenant(input: { code: string; name: string; authorId: string; authorBadge: string, is_system: false }): Promise<CreateTenantResult> {
  const { data: tenant, error } = await tenantsDB.create({ code: input.code, name: input.name, authorId: input.authorId, authorBadge: input.authorBadge, is_system: input.is_system });
  if (error || !tenant) return { ok: false, reason: "validation_failed", detail: error?.message ?? "failed to create tenant" };
  return { ok: true, tenant };
}

export type TenantUserView = PlatformUserView;

export async function listUsersForTenant(tenantId: string): Promise<TenantUserView[]> {
  const { rows: userRows } = await query<{ id: number; email: string; name: string | null; is_active: boolean; created_at: string }>(
    "SELECT id, email, name, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantId]
  );
  if (userRows.length === 0) return [];

  const now = new Date();
  const { rows: masterRows } = await query<{
    user_id: number;
    authorised_role: Array<{ role: string; effective_till: string; seu_ids: string[] }>;
    authorised_badges: Array<{ badge: string; effective_till: string; seu_ids: string[] }>;
  }>(
    "SELECT user_id, authorised_role, authorised_badges FROM participants_master WHERE user_id = ANY($1::int[])",
    [userRows.map((u) => u.id)]
  );
  const authorisedRolesByUserId = new Map<number, string[]>(
    masterRows.map((m) => [
      m.user_id,
      m.authorised_role.filter((e) => e.seu_ids.length === 0 && new Date(e.effective_till).getTime() >= now.getTime()).map((e) => e.role),
    ])
  );
  const authorisedBadgesByUserId = new Map<number, string[]>(
    masterRows.map((m) => [
      m.user_id,
      m.authorised_badges.filter((e) => e.seu_ids.length === 0 && new Date(e.effective_till).getTime() >= now.getTime()).map((e) => e.badge),
    ])
  );

  const { data: tenant } = await tenantsDB.findById(tenantId);
  return userRows.map((u) => ({
    ...u,
    role: (authorisedRolesByUserId.get(u.id) ?? []).join(", "),
    platformBadges: [],
    tenantId,
    tenantName: tenant?.name ?? null,
    authorisedRoles: authorisedRolesByUserId.get(u.id) ?? [],
    authorisedBadges: authorisedBadgesByUserId.get(u.id) ?? [],
  }));
}

export async function listGrantableNounVerbBadges(): Promise<string[]> {
  const { data } = await authorityVocabularyDB.listActiveMappingPairs();
  return [...new Set((data ?? []).map((r) => `${r.noun_code.toLowerCase()}_${r.verb_code}`))].sort();
}

export async function setTenantUserAuthorisedBadges(input: { actingTenantId: string; userId: string; badges: string[] }): Promise<UpdatePlatformUserResult> {
  const holder = await userDB.findById(input.userId);
  if (!holder) return { ok: false, detail: "user not found" };
  if (holder.tenant_id !== input.actingTenantId) return { ok: false, detail: "that user is not in your tenant" };

  return setAuthorisedBadges({ id: input.userId, badges: input.badges, actingUserEmail: null });
}
