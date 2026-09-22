// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md. "Everything should be done through the
// Identity Management feature" — this is the one core module the Identity
// Management UI routes (routes/seu/web/identity.ts) call into; no other
// route creates a tenant, a badge type, or a badge grant directly.
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
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
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
  // Owner: "actions dropdown should be from ontology authorised-role...
  // Existing grant should be in a selected state." Unscoped (seu_ids: [])
  // and unexpired authorised_role codes only — this platform-wide screen
  // has no SEU context, so a SEU-scoped grant is neither shown nor
  // touchable here (setAuthorisedRoles below leaves those alone).
  authorisedRoles: string[];
  // Owner: "badge_grants on the user management should be replaced with the
  // new badges implementation" — same unscoped/unexpired-only display rule
  // as authorisedRoles above, read from participants_master.authorised_badges
  // (migration 257) instead of badge_grants.
  authorisedBadges: string[];
}

export interface IdentityDashboardView {
  tenants: TenantRow[];
  badgeTypes: BadgeTypeRow[]; // Platform-recommended + every Tenant's overrides/additions, for this pass's single-page view
  users: PlatformUserView[];
  // Ontology "authorised-role" concept codes, for the Actions column's
  // multi-select — root sees the full Platform-recommended vocabulary.
  authorisedRoleCodes: string[];
  // The live noun x verb vocabulary (authority_noun_verbs), for the new
  // Badges multi-select — same source listUsersForTenant's own grant form
  // already uses (listGrantableNounVerbBadges, below).
  authorisedBadgeCodes: string[];
}

// Tenant Management only needs the tenant list — it must NOT pay for the whole
// identity dashboard (badge grants, per-holder user lookups, platform-badge
// rollup). Kept in this core module so the "everything through core" boundary
// holds (routes/seu/web/identity.ts calls this, not tenantsDB directly).
export async function listTenantsForManagement(): Promise<TenantRow[]> {
  // CR-004: operational tenants only — the reserved 'platform' system tenant is
  // not a manageable org and never appears in Tenant Management.
  const { data } = await tenantsDB.findAllOperational();
  return data ?? [];
}

export async function getIdentityDashboardView(): Promise<IdentityDashboardView> {
  const [{ data: tenants }, badgeTypesResult] = await Promise.all([tenantsDB.findAll(), query<BadgeTypeRow>("SELECT * FROM badge_types ORDER BY tenant_id NULLS FIRST, code")]);

  const { rows: userRows } = await query<{ id: number; email: string; name: string | null; role: string; is_active: boolean; created_at: string; tenant_id: string | null }>(
    "SELECT id, email, name, role, is_active, created_at, tenant_id FROM users ORDER BY created_at DESC"
  );
  const tenantNameById = new Map<string, string>((tenants ?? []).map((t) => [t.id, t.name]));

  // authorised_role (migration 254/255) — one participants_master row per
  // user, at most, via user_id (participantsMasterDB.findByUserId's own
  // "only ever set for a Human-type master" convention). Batch-loaded here,
  // same discipline every other seed/dashboard read in this codebase uses
  // for a list this size — never a per-row live query.
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

  // authorised_badges (migration 257) — same batch-load discipline as
  // authorised_role above.
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
    tenantId: u.tenant_id,
    tenantName: u.tenant_id ? tenantNameById.get(u.tenant_id) ?? null : null,
    authorisedRoles: authorisedRolesByUserId.get(u.id) ?? [],
    authorisedBadges: authorisedBadgesByUserId.get(u.id) ?? [],
  }));

  return { tenants: tenants ?? [], badgeTypes: badgeTypesResult.rows, users, authorisedRoleCodes, authorisedBadgeCodes };
}

export type CreatePlatformUserResult = { ok: true; email: string; verificationLink: string | null } | { ok: false; detail: string };

// Root creating a platform user account (this tab's own concern) is
// deliberately separate from granting that user any Platform-layer badge
// (the Badge Grants tab) — account creation and badge issuance are two
// steps, matching §9's top-down chain (nothing is granted implicitly by
// existing). Reuses the same local-pending + email-verification mechanism
// routes/web/auth.js's existing (legacy-role) User Management already uses,
// rather than inventing a second account-creation path. The legacy `role`
// column is left at its default ('general') — that axis is untouched by
// Phase 10 (design doc §5) and irrelevant to what badges this account can
// later be granted.
// Owner: "Type should be renamed to Tenant. The dropdown should have the
// tenants list. Include a authorised_role dropdown" — collapses the old
// Type (Platform/Tenant) + conditional tenant picker into one dropdown of
// every real tenant, Platform's own reserved row included; `type` is no
// longer a human choice, it's derived from which tenant was picked
// (tenant.is_system — true only for the reserved 'platform' row today).
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
  const created = await userDB.createLocalPending({ email: input.email, name: input.name || input.email, role: "general", verification_token: token, verification_expires: expires, type, tenant_id: tenant.id });

  // Owner: "I said badge has to be empty. badge is in participants_master."
  // — authorised_role is exactly whatever the admin selected on the create
  // form, nothing implied. No forced 'general' here; NON_REVOCABLE_ROLES
  // (setAuthorisedRoles below) only ever stops a HELD 'general' grant from
  // being revoked later — it doesn't grant one on creation.
  const rolesResult = await setAuthorisedRoles({ id: created.id, roles: input.authorisedRoles ?? [], actingUserEmail: null });
  if (!rolesResult.ok) return { ok: false, detail: `user created, but authorised roles failed: ${rolesResult.detail}` };

  const result = await emailService.sendVerification({ to: input.email, name: input.name || input.email, token });
  return { ok: true, email: input.email, verificationLink: result.link ?? null };
}

export type UpdatePlatformUserResult = { ok: true } | { ok: false; detail: string };

// Owner: "In aisworg/seu/identity/users page, add an action button to edit
// the users." Active is still edited here (userDB.setActive, keyed by
// email — see the self-edit guard comment below for why email not id).
// Role editing moved to setAuthorisedRoles below (owner: "omit the legacy
// role column... actions dropdown should be from ontology authorised-role")
// — the legacy `role` column itself is untouched, just no longer editable
// from this page. Badges are a separate, already-built flow
// (issueBadgeGrant/revokeBadgeGrant, Badge Management) — not duplicated here.
export async function updatePlatformUser(input: { id: number; isActive: boolean; actingUserEmail: string | null }): Promise<UpdatePlatformUserResult> {
  const user = await userDB.findById(input.id);
  if (!user) return { ok: false, detail: "user not found" };
  // Self-edit guard, by EMAIL not id — same as the legacy /auth/users page's
  // own guard, and NOT interchangeable here: this app's dev/test auto-login
  // shim (src/app.js) hardcodes a fixed id:1 session identity whose EMAIL
  // happens to match a real seeded user row that itself has a DIFFERENT real
  // database id — an id-based comparison silently never matches for that
  // shim identity (confirmed live: the guard never fired), while email
  // always correctly identifies who's actually acting, in the shim and in
  // real OAuth login alike.
  if (input.actingUserEmail && user.email === input.actingUserEmail) return { ok: false, detail: "you can't edit your own account from here" };
  await userDB.setActive(user.email, input.isActive);
  return { ok: true };
}

// Owner: "provide all participants with general role... to denote always" —
// 'general' is the platform's own default standing grant (migration 255's
// column default; every onboarding adapter sets it). Owner, this session:
// "Don't allow revoke of general because that is a default" — once a user
// holds it unscoped, it's never dropped here even if deselected.
const NON_REVOCABLE_ROLES = new Set(["general"]);

// Owner: "dropdown is multi-select. Existing grant should be in a selected
// state. so add or revoke will work" — reconciles this user's UNSCOPED
// (seu_ids: []) authorised_role grants to exactly the given set: adds a
// standing grant (effective_till 9999-12-31, seu_ids: []) for any newly
// selected role, drops any unscoped grant whose role was deselected (except
// NON_REVOCABLE_ROLES), and leaves any SEU-scoped grant untouched (this
// platform-wide screen has no SEU context to revoke one correctly). Same
// self-edit guard as updatePlatformUser — deselecting your own only
// `superuser` grant here would otherwise lock the acting admin out.
export async function setAuthorisedRoles(input: { id: number; roles: string[]; actingUserEmail: string | null }): Promise<UpdatePlatformUserResult> {
  const user = await userDB.findById(input.id);
  if (!user) return { ok: false, detail: "user not found" };
  if (input.actingUserEmail && user.email === input.actingUserEmail) return { ok: false, detail: "you can't edit your own account from here" };

  const viewer: OntologyViewer = { isRoot: true, tenantId: null };
  for (const role of input.roles) {
    await assertCanonicalCategory("authorised-role", role, viewer);
  }

  const { data: existingMaster } = await participantsMasterDB.findByUserId(input.id);
  const master = existingMaster ?? (await createParticipantMaster({
    tenantId: user.tenant_id ?? PLATFORM_TENANT_ID,
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

// Owner (2026-09-22): "web/ontology.ts should have badge ontology_manage" —
// the Ontology-registered admin-surface badges (concept_types
// badges:platform/badges:tenant, migration 256: identity_manage,
// tenant_manage, ontology_manage, platform_manage), alongside the real
// noun_verb vocabulary. Unioned, not scoped per platform/tenant — "badge
// does not need seuid" (owner) already settled authorised_badges as
// unscoped, same discipline here.
export async function listAdminSurfaceBadgeCodes(): Promise<string[]> {
  const viewer: OntologyViewer = { isRoot: true, tenantId: null };
  const [{ data: platformConcepts }, { data: tenantConcepts }] = await Promise.all([
    ontologyDB.findConceptsByType("badges:platform", viewer),
    ontologyDB.findConceptsByType("badges:tenant", viewer),
  ]);
  return [...new Set([...(platformConcepts ?? []), ...(tenantConcepts ?? [])].map((c) => c.code))].sort();
}

// Owner: "badge_grants on the user management should be replaced with the
// new badges implementation" — same reconcile shape as setAuthorisedRoles
// above (add newly selected, drop deselected, leave any SEU-scoped entry
// untouched), validated against the real noun x verb vocabulary
// (listGrantableNounVerbBadges) plus the Ontology-registered admin-surface
// badges above. No NON_REVOCABLE_ROLES equivalent — badges have no sticky
// default.
export async function setAuthorisedBadges(input: { id: number; badges: string[]; actingUserEmail: string | null }): Promise<UpdatePlatformUserResult> {
  const user = await userDB.findById(input.id);
  if (!user) return { ok: false, detail: "user not found" };
  if (input.actingUserEmail && user.email === input.actingUserEmail) return { ok: false, detail: "you can't edit your own account from here" };

  const [nounVerbBadges, adminSurfaceBadges] = await Promise.all([listGrantableNounVerbBadges(), listAdminSurfaceBadgeCodes()]);
  const grantable = new Set([...nounVerbBadges, ...adminSurfaceBadges]);
  for (const badge of input.badges) {
    if (!grantable.has(badge)) return { ok: false, detail: `"${badge}" is not a real badge. Allowed: ${[...grantable].join(", ") || "(none registered)"}` };
  }

  const { data: existingMaster } = await participantsMasterDB.findByUserId(input.id);
  const master = existingMaster ?? (await createParticipantMaster({
    tenantId: user.tenant_id ?? PLATFORM_TENANT_ID,
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

// CR-005 — tenant creation is decoupled from tenant-admin assignment. This
// creates the Tenant only; its first admin is created separately via
// createPlatformUser(type='Tenant', tenant_id=<this tenant>) and then granted
// the tenant_admin badge through the existing issueBadgeGrant path. (Previously
// createTenantWithFirstAdmin bundled all three, which made a Tenant unable to
// exist before its admin — the conflict CR-005 resolves.)
export async function createTenant(input: { code: string; name: string }): Promise<CreateTenantResult> {
  const { data: tenant, error } = await tenantsDB.create({ code: input.code, name: input.name });
  if (error || !tenant) return { ok: false, reason: "validation_failed", detail: error?.message ?? "failed to create tenant" };
  return { ok: true, tenant };
}


// --- Tenant Admin (tenant_super role) — a separate, tenant-scoped view. ----
// Owner: "there has to be a separate view for tenant_admins... user
// management screen should list users scoped to that tenant... tenant_admin
// can allocate badges to users" — the badges that can be allotted correspond
// to the Deliverable noun (transition_definitions has the valid verbs, so
// the badge is noun_verb). Gated by requireRole('tenant_super')
// (middleware/auth.js), not requirePlatformBadge — a deliberately separate
// authority axis from root's own Identity Management above, scoped by
// req.session.user.tenant_id rather than any badge.

// Same PlatformUserView shape as the platform-wide dashboard, filtered to one
// tenant — deliberately not a call to getIdentityDashboardView (that loads
// every tenant's users/grants; a tenant_super only ever needs its own).
export type TenantUserView = PlatformUserView;

// Owner (2026-09-22): "write to participants_master and remove badge_grants"
// — authorisedBadges (participants_master, migration 257) replaces the old
// badge_grants-based revocableGrants entirely; there's no per-grant id to
// revoke by any more, just a reconcile-to-selection (setTenantUserAuthorisedBadges
// below), same shape as Identity Management's own setAuthorisedBadges.
export async function listUsersForTenant(tenantId: string): Promise<TenantUserView[]> {
  const { rows: userRows } = await query<{ id: number; email: string; name: string | null; role: string; is_active: boolean; created_at: string }>(
    "SELECT id, email, name, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantId]
  );
  if (userRows.length === 0) return [];

  const now = new Date();
  const { rows: masterBadgeRows } = await query<{ user_id: number; authorised_badges: Array<{ badge: string; effective_till: string; seu_ids: string[] }> }>(
    "SELECT user_id, authorised_badges FROM participants_master WHERE user_id = ANY($1::int[])",
    [userRows.map((u) => u.id)]
  );
  const authorisedBadgesByUserId = new Map<number, string[]>(
    masterBadgeRows.map((m) => [
      m.user_id,
      m.authorised_badges.filter((e) => e.seu_ids.length === 0 && new Date(e.effective_till).getTime() >= now.getTime()).map((e) => e.badge),
    ])
  );

  // tenantId is this function's own input (every row shares it); tenantName
  // and authorisedRoles are Identity Management's own (getIdentityDashboardView)
  // concern, deliberately not loaded here — this function stays the
  // lightweight, this-tenant-only read its own header comment describes.
  const { data: tenant } = await tenantsDB.findById(tenantId);
  return userRows.map((u) => ({
    ...u,
    platformBadges: [],
    tenantId,
    tenantName: tenant?.name ?? null,
    authorisedRoles: [],
    authorisedBadges: authorisedBadgesByUserId.get(u.id) ?? [],
  }));
}

// Owner: tenant_admin's own grant screen should not be limited to Deliverable
// — every real noun_verb badge (lifecycle transition verbs AND
// creation-authority verbs like propose/define/create, per
// [[creation-authority-not-a-transition]]) should be grantable. authority_noun_verbs
// (authorityVocabularyDB) is the live, Ontology-driven mapping table itself —
// the same source badgeGrantsDB's own resolveNounVerbBadge validates a grant
// against — so this list and that later validation can never disagree.
// Deliberately narrower than "every badge_type": platform-scoped badges
// (root, tenant_admin, pack_all, viewer) have no noun in this mapping table
// at all, so they stay structurally excluded, not filtered out by convention.
export async function listGrantableNounVerbBadges(): Promise<string[]> {
  const { data } = await authorityVocabularyDB.listActiveMappingPairs();
  return [...new Set((data ?? []).map((r) => `${r.noun_code.toLowerCase()}_${r.verb_code}`))].sort();
}

// Owner (2026-09-22): "write to participants_master and remove badge_grants"
// — reconciles this tenant user's noun_verb authorised_badges to exactly the
// given set (same add/drop-by-selection shape as setAuthorisedBadges),
// restricted to a user already confirmed to belong to the acting
// tenant_super's own tenant — a userId picked from that tenant's own User
// Management list, not a free-typed email, so there's no cross-tenant path
// to begin with; checked again here regardless, since the route boundary is
// the only real enforcement point. Delegates to setAuthorisedBadges itself
// (root of Identity Management's own Badge Management) rather than
// re-implementing the same reconcile logic a second time.
export async function setTenantUserAuthorisedBadges(input: { actingTenantId: string; userId: number; badges: string[] }): Promise<UpdatePlatformUserResult> {
  const holder = await userDB.findById(input.userId);
  if (!holder) return { ok: false, detail: "user not found" };
  if (holder.tenant_id !== input.actingTenantId) return { ok: false, detail: "that user is not in your tenant" };

  return setAuthorisedBadges({ id: input.userId, badges: input.badges, actingUserEmail: null });
}
