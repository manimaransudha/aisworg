// CR-001 — Dev-only "Act As" switcher (design/Change Requests.md).
//
// Lets the single god identity impersonate any tenant + any badge in a
// non-production environment, so denial paths and per-tenant behaviour can be
// exercised interactively — instead of the single all-passing root identity
// masking them. Every export here is a no-op / false in production: nothing in
// this module changes behaviour for a real deployment.
//
// Three load-bearing gates (all must hold for the feature to be live):
//   1. NODE_ENV !== 'production'         — dev/local/test only
//   2. DEV_ACT_AS !== 'off'              — an explicit off switch even in dev
//   3. session.user.email === SUPERUSER_EMAIL  — the ONE god identity, not any
//      root-badge holder. Even a user the god identity grants `root` to does
//      NOT qualify, because only the env-file email matches.
import type { Request } from "express";
import { tenantsDB } from "../dblayer/tenantsDB.js";
import { badgeTypesDB } from "../dblayer/badgeTypesDB.js";
import { badgeGrantsDB } from "../dblayer/badgeGrantsDB.js";
import { authorityVocabularyDB } from "../dblayer/authorityVocabularyDB.js";
import type { BadgeGrantRow, TenantRow, BadgeTypeRow, TransitionEntityType } from "../dblayer/seuTypes.js";
import { logger } from "../utils/logger.js";

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || "").toLowerCase();

export interface ActAsContext {
  tenantId: string | null;
  badgeType: string; // "root" is the default / reset (full access)
}

interface SessionUser {
  id?: number | string;
  email?: string;
  platformBadges?: string[];
}

/** Gate 1 + 2 — the feature is compiled-in and not switched off. */
export function devActAsFeatureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.DEV_ACT_AS ?? "on").toLowerCase() !== "off";
}

/** Gate 3 — this session belongs to the single env-file god identity. */
export function isGodUser(user: SessionUser | undefined | null): boolean {
  if (!SUPERUSER_EMAIL) return false;
  return (user?.email ?? "").toLowerCase() === SUPERUSER_EMAIL;
}

/** All three gates — may this request see and use the switcher at all? */
export function devActAsAvailable(req: Request): boolean {
  if (!devActAsFeatureEnabled()) return false;
  return isGodUser(req.session?.user as SessionUser | undefined);
}

/** The acting context currently set on the session (undefined if none/root). */
export function currentActAs(req: Request): ActAsContext | undefined {
  const raw = (req.session as unknown as { actAs?: ActAsContext } | undefined)?.actAs;
  if (!raw) return undefined;
  return raw;
}

/**
 * The effective Platform-layer badges for authorization THIS request. When the
 * god user is acting as a non-root badge, `root` is dropped so the root bypass
 * in requireRole/requirePlatformBadge no longer short-circuits — that is the
 * whole point: real denial paths become reachable. Acting as root (or not
 * acting at all) returns the session's true badges unchanged. Returns null when
 * the feature is not live, so callers fall back to session.user.platformBadges.
 */
export function effectivePlatformBadges(req: Request): string[] | null {
  if (!devActAsAvailable(req)) return null;
  const actAs = currentActAs(req);
  if (!actAs || actAs.badgeType === "root") return null; // unchanged (full access)
  return [actAs.badgeType];
}

/** Tenant list for the switcher dropdown (operational only — CR-004 excludes the reserved 'platform' tenant). */
export async function listTenants(): Promise<TenantRow[]> {
  const { data } = await tenantsDB.findAllOperational();
  return data ?? [];
}

/** Badge-type vocabulary for the chosen tenant (platform defaults + variants). */
export async function listBadgeTypes(tenantId: string | null): Promise<BadgeTypeRow[]> {
  const { data } = await badgeTypesDB.findAllForTenant(tenantId);
  return data ?? [];
}

/**
 * Is `code` something the switcher can actually assume? Either a Layer 1/2
 * badge_types row (root, tenant_admin, viewer, …) or a live CR-006 noun_verb
 * work badge (e.g. "deliverable_approve") — migration 043 retired the old
 * Creator/Reviewer/Approver badge_types family those used to be covered by,
 * so they now only exist in authority_noun_verbs.
 */
export async function isAssumableBadgeCode(code: string, tenantId: string | null): Promise<boolean> {
  if (code === "root") return true;
  const types = await listBadgeTypes(tenantId);
  if (types.some((t) => t.code === code)) return true;
  const { data: pairs } = await authorityVocabularyDB.listActiveMappingPairs();
  return (pairs ?? []).some((p) => `${p.noun_code.toLowerCase()}_${p.verb_code}` === code);
}

/**
 * Find-or-mint an Active grant of `badgeType` for `holderId` at the given
 * scope. Minting is permitted ONLY because the feature is live (dev + god
 * user); returns null and mints nothing otherwise, so production is untouched.
 * Root and other unscoped (scope_kind 'None') badges are minted holder-wide;
 * Tenant-scoped badges are scoped to the tenant; SEU/Pack-scoped badges are
 * scoped to the supplied scopeId (the SEU or Pack the action targets).
 */
export async function findOrMintGrant(
  req: Request,
  input: {
    holderId: string;
    badgeType: string;
    tenantId: string | null;
    entityType?: TransitionEntityType | null;
    capabilityId?: string | null;
    scopeId?: string | null;
  }
): Promise<BadgeGrantRow | null> {
  if (!devActAsAvailable(req)) return null;

  const bt = await badgeTypesDB.resolveForTenant(input.badgeType, input.tenantId);
  const badgeTypeRow = bt.data;

  // Derive the scope the grant must carry from the badge type's scope_kind.
  // No badge_types row (migration 043 retired the old Creator/Reviewer/
  // Approver family) doesn't mean the code is bogus — it may be a live
  // CR-006 noun_verb work badge (e.g. "deliverable_approve"), which is
  // always unscoped (scope is a separate gate the noun_verb authority check
  // never applies — badgeAuthorityEngine.authorise). Left as fully unscoped
  // here; badgeGrantsDB.create's own validateBadgeGrant resolves it against
  // authority_noun_verbs (or rejects it) below.
  let governedEntityType: TransitionEntityType | null = null;
  let capabilityId: string | null = null;
  let scopeId: string | null = null;
  if (badgeTypeRow) {
    switch (badgeTypeRow.scope_kind) {
      case "None":
        break; // unscoped (e.g. root)
      case "Tenant":
        scopeId = input.tenantId;
        break;
      case "SEU":
      case "Pack":
      case "SEU_or_Pack":
        governedEntityType = input.entityType ?? null;
        capabilityId = input.capabilityId ?? null;
        scopeId = input.scopeId ?? null;
        break;
    }
  }

  // Look for an existing Active grant that matches this scope exactly.
  const existing = await badgeGrantsDB.findActiveByHolderAndType(input.holderId, input.badgeType);
  const match = (existing.data ?? []).find(
    (g) =>
      (g.governed_entity_type ?? null) === governedEntityType &&
      (g.capability_id ?? null) === capabilityId &&
      (g.scope_id ?? null) === scopeId
  );
  if (match) return match;

  const created = await badgeGrantsDB.create({
    holderType: "User",
    holderId: input.holderId,
    badgeType: input.badgeType,
    governedEntityType,
    capabilityId,
    scopeId,
  });
  if ("data" in created) {
    logger.info(`[dev/actAs] minted "${input.badgeType}" grant for holder ${input.holderId} (scope_kind ${badgeTypeRow?.scope_kind ?? "None (noun_verb)"})`);
    return created.data ?? null;
  }
  const why = "validationErrors" in created ? created.validationErrors.join("; ") : created.error.message;
  logger.warn(`[dev/actAs] could not mint "${input.badgeType}" grant: ${why}`);
  return null;
}
