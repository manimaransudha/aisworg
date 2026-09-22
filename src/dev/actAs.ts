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
import { participantsMasterDB } from "../dblayer/participantsMasterDB.js";
import { transitionDefinitionsDB } from "../dblayer/transitionDefinitionsDB.js";
import { PLATFORM_TENANT_ID } from "../dblayer/constants.js";
import type { TenantRow, BadgeTypeRow } from "../dblayer/seuTypes.js";
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
 * Owner (2026-09-22): "Dropdown should have the nounxverb in the transition
 * definition mapping" — the real, live noun_verb vocabulary, derived
 * directly from transition_definitions (entity_type + verb) rather than the
 * separate authority_noun_verbs vocabulary table. Active, non-retired rows
 * with a real verb only.
 */
export async function listNounVerbBadgeCodes(): Promise<string[]> {
  const { data } = await transitionDefinitionsDB.listAll();
  const codes = new Set(
    (data ?? [])
      .filter((td) => td.is_active && !td.retired_at && td.verb)
      .map((td) => `${td.entity_type.toLowerCase()}_${td.verb}`)
  );
  return [...codes].sort();
}

/**
 * Is `code` something the switcher can actually assume? Either a Layer 1/2
 * badge_types row (root, tenant_admin, …) or a live noun_verb badge named by
 * a real transition_definitions row.
 */
export async function isAssumableBadgeCode(code: string, tenantId: string | null): Promise<boolean> {
  if (code === "root") return true;
  const types = await listBadgeTypes(tenantId);
  if (types.some((t) => t.code === code)) return true;
  const nounVerbCodes = await listNounVerbBadgeCodes();
  return nounVerbCodes.includes(code);
}

/**
 * Owner (2026-09-22): "dev/actAs.ts should add the badge to the user in
 * participants_master" — badgeAuthorityEngine.getHeldBadges (the ONE
 * noun_verb authority check, post-consolidation) reads
 * participants_master.authorised_badges for the REAL acting user's own
 * numeric actorId; there is no badge_grants fallback any more ("there is no
 * fallback to legacy"). So simulating a noun_verb badge means writing it
 * directly onto that real user's own row — no synthetic holder identity
 * needed or possible any more.
 *
 * Reconciles to exactly one simulated badge at a time: removes
 * `previousBadgeType` (whatever Act-As itself last added, tracked on the
 * session — never touches a badge genuinely granted through Identity
 * Management with the same code, since this only ever removes the ONE code
 * Act-As itself is tracking) before adding `badgeType`. Either may be null/
 * "root" to mean "nothing to add" / "nothing to remove".
 */
export async function setActingNounVerbBadge(
  req: Request,
  input: { userId: number; tenantId: string | null; badgeType: string | null; previousBadgeType: string | null }
): Promise<void> {
  if (!devActAsAvailable(req)) return;
  const toAdd = input.badgeType && input.badgeType !== "root" ? input.badgeType : null;
  const toRemove = input.previousBadgeType && input.previousBadgeType !== "root" ? input.previousBadgeType : null;
  if (!toAdd && !toRemove) return;

  const { data: existing } = await participantsMasterDB.findByUserId(input.userId);
  let master = existing;
  if (!master) {
    if (!toAdd) return; // nothing held, nothing to remove, nothing to add
    const created = await participantsMasterDB.create({
      tenantId: input.tenantId ?? PLATFORM_TENANT_ID,
      type: "Human",
      displayName: `Dev Act-As (user ${input.userId})`,
      userId: input.userId,
    });
    master = created.data ?? null;
    if (!master) {
      logger.warn(`[dev/actAs] could not create participants_master row for user ${input.userId}`);
      return;
    }
  }

  let badges = toRemove ? master.authorised_badges.filter((b) => b.badge !== toRemove) : master.authorised_badges;
  if (toAdd && !badges.some((b) => b.badge === toAdd)) {
    badges = [...badges, { badge: toAdd, effective_till: "9999-12-31", seu_ids: [] }];
  }

  const { error } = await participantsMasterDB.setAuthorisedBadges(master.id, badges);
  if (error) {
    logger.warn(`[dev/actAs] could not update authorised_badges for user ${input.userId}: ${error.message}`);
    return;
  }
  logger.info(`[dev/actAs] user ${input.userId} authorised_badges: removed ${toRemove ?? "(none)"}, added ${toAdd ?? "(none)"}`);
}
