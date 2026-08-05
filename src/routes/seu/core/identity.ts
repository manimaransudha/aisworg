// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md. "Everything should be done through the
// Identity Management feature" — this is the one core module the Identity
// Management UI routes (routes/seu/web/identity.ts) call into; no other
// route creates a tenant, a badge type, or a badge grant directly.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const crypto = require("crypto");

import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { badgeTypesDB } from "../../../dblayer/badgeTypesDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { userDB } from "../../../dblayer/userDB.js";
import { emailService } from "../../../domain/auth/emailService.js";
import { query } from "../../../utils/db.js";
import type { BadgeGrantRow, BadgeScopeKind, BadgeTypeRow, TenantRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

export interface BadgeGrantView extends BadgeGrantRow {
  holderEmail: string | null;
}

export interface PlatformUserView {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  platformBadges: string[]; // Layer 1 badges this user holds — what "platform user" means at the badge layer, distinct from the legacy role column
}

export interface IdentityDashboardView {
  tenants: TenantRow[];
  badgeTypes: BadgeTypeRow[]; // Platform-recommended + every Tenant's overrides/additions, for this pass's single-page view
  grants: BadgeGrantView[];
  users: PlatformUserView[];
}

export async function getIdentityDashboardView(): Promise<IdentityDashboardView> {
  const [{ data: tenants }, badgeTypesResult] = await Promise.all([tenantsDB.findAll(), query<BadgeTypeRow>("SELECT * FROM badge_types ORDER BY tenant_id NULLS FIRST, code")]);

  const { rows: grantRows } = await query<BadgeGrantRow>("SELECT * FROM badge_grants ORDER BY created_at DESC LIMIT 200");
  const grants: BadgeGrantView[] = [];
  for (const grant of grantRows) {
    let holderEmail: string | null = null;
    if (grant.holder_type === "User") {
      const { rows } = await query<{ email: string }>("SELECT email FROM users WHERE id = $1", [grant.holder_id]);
      holderEmail = rows[0]?.email ?? null;
    }
    grants.push({ ...grant, holderEmail });
  }

  const { rows: userRows } = await query<{ id: number; email: string; name: string | null; role: string; is_active: boolean; created_at: string }>(
    "SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  const { rows: platformBadgeRows } = await query<{ holder_id: string; badge_type: string }>(
    "SELECT bg.holder_id, bg.badge_type FROM badge_grants bg JOIN badge_types bt ON bt.code = bg.badge_type AND bt.tenant_id IS NULL WHERE bg.status = 'Active' AND bt.scope_kind = 'None' AND bg.badge_type != 'viewer'"
  );
  const badgesByHolder = new Map<string, string[]>();
  for (const row of platformBadgeRows) {
    const list = badgesByHolder.get(row.holder_id) ?? [];
    list.push(row.badge_type);
    badgesByHolder.set(row.holder_id, list);
  }
  const users: PlatformUserView[] = userRows.map((u) => ({ ...u, platformBadges: badgesByHolder.get(String(u.id)) ?? [] }));

  return { tenants: tenants ?? [], badgeTypes: badgeTypesResult.rows, grants, users };
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
export async function createPlatformUser(input: { email: string; name?: string }): Promise<CreatePlatformUserResult> {
  const existing = await userDB.findByEmail(input.email);
  if (existing) return { ok: false, detail: `a user already exists for ${input.email}` };

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await userDB.createLocalPending({ email: input.email, name: input.name || input.email, role: "general", verification_token: token, verification_expires: expires });
  const result = await emailService.sendVerification({ to: input.email, name: input.name || input.email, token });
  return { ok: true, email: input.email, verificationLink: result.link ?? null };
}

export type CreateTenantResult =
  | { ok: true; tenant: TenantRow; grant: BadgeGrantRow }
  | { ok: false; reason: "email_not_found" | "validation_failed"; detail: string };

// §8.2's "Grants Tenant Admin badges" — creating a Tenant and granting its
// first Tenant Admin badge are bundled as one action by the root holder, not
// two separate steps (design doc §9's provisioning chain).
export async function createTenantWithFirstAdmin(input: { code: string; name: string; adminEmail: string }): Promise<CreateTenantResult> {
  const admin = await userDB.findByEmail(input.adminEmail);
  if (!admin) return { ok: false, reason: "email_not_found", detail: `no user found for ${input.adminEmail}` };

  const { data: tenant, error } = await tenantsDB.create({ code: input.code, name: input.name });
  if (error || !tenant) return { ok: false, reason: "validation_failed", detail: error?.message ?? "failed to create tenant" };

  const grantResult = await badgeGrantsDB.create({
    holderId: String(admin.id),
    badgeType: "tenant_admin",
    scopeId: tenant.id,
  });
  if ("validationErrors" in grantResult) {
    return { ok: false, reason: "validation_failed", detail: grantResult.validationErrors.join("; ") };
  }
  if (grantResult.error || !grantResult.data) {
    return { ok: false, reason: "validation_failed", detail: grantResult.error?.message ?? "failed to grant Tenant Admin badge" };
  }
  return { ok: true, tenant, grant: grantResult.data };
}

export type IssueBadgeGrantResult = { ok: true; grant: BadgeGrantRow } | { ok: false; reason: "email_not_found" | "validation_failed"; detail: string };

export async function issueBadgeGrant(input: {
  holderEmail: string;
  badgeType: string;
  governedEntityType?: TransitionEntityType | null;
  capabilityId?: string | null;
  scopeId?: string | null;
}): Promise<IssueBadgeGrantResult> {
  const holder = await userDB.findByEmail(input.holderEmail);
  if (!holder) return { ok: false, reason: "email_not_found", detail: `no user found for ${input.holderEmail}` };

  const result = await badgeGrantsDB.create({
    holderId: String(holder.id),
    badgeType: input.badgeType,
    governedEntityType: input.governedEntityType ?? null,
    capabilityId: input.capabilityId ?? null,
    scopeId: input.scopeId ?? null,
  });
  if ("validationErrors" in result) return { ok: false, reason: "validation_failed", detail: result.validationErrors.join("; ") };
  if (result.error || !result.data) return { ok: false, reason: "validation_failed", detail: result.error?.message ?? "failed to create grant" };
  return { ok: true, grant: result.data };
}

export async function revokeBadgeGrant(id: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const { data, error } = await badgeGrantsDB.revoke(id);
  if (error || !data) return { ok: false, detail: error?.message ?? "grant not found" };
  return { ok: true };
}

export type CreateTenantBadgeResult = { ok: true; badgeType: BadgeTypeRow } | { ok: false; detail: string };

// §8.1: rename (same code, this Tenant's own name) or add a genuinely new,
// derived badge (new code, must declare derived_from) — both go through
// badgeTypesDB.create, which enforces §8.1's boundaries (single writer
// function, design doc §9's Enforcement point).
export async function createOrRenameTenantBadge(input: { tenantId: string; code: string; name: string; scopeKind: BadgeScopeKind; derivedFrom?: string | null }): Promise<CreateTenantBadgeResult> {
  const result = await badgeTypesDB.create({
    tenantId: input.tenantId,
    code: input.code,
    name: input.name,
    scopeKind: input.scopeKind,
    derivedFrom: input.derivedFrom ?? null,
  });
  if ("validationErrors" in result) return { ok: false, detail: result.validationErrors.join("; ") };
  if (result.error || !result.data) return { ok: false, detail: result.error?.message ?? "failed to create badge type" };
  return { ok: true, badgeType: result.data };
}
