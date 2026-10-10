import type { Request } from "express";
import { tenantsDB } from "../dblayer/tenantsDB.js";
import { badgeTypesDB } from "../dblayer/badgeTypesDB.js";
import { participantsMasterDB } from "../dblayer/participantsMasterDB.js";
import { transitionDefinitionsDB } from "../dblayer/transitionDefinitionsDB.js";
import type { TenantRow, BadgeTypeRow } from "../dblayer/seuTypes.js";
import { logger } from "../utils/logger.js";
import { getPlatformTenantId } from "../dblayer/constants.js";

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || "").toLowerCase();

export interface ActAsContext {
  tenantId: string | null;
  badgeType: string;
}

interface SessionUser {
  id?: number | string;
  email?: string;
  platformBadges?: string[];
}

export function devActAsFeatureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.DEV_ACT_AS ?? "on").toLowerCase() !== "off";
}

export function isGodUser(user: SessionUser | undefined | null): boolean {
  if (!SUPERUSER_EMAIL) return false;
  return (user?.email ?? "").toLowerCase() === SUPERUSER_EMAIL;
}

export function devActAsAvailable(req: Request): boolean {
  if (!devActAsFeatureEnabled()) return false;
  return isGodUser(req.session?.user as SessionUser | undefined);
}

export function currentActAs(req: Request): ActAsContext | undefined {
  const raw = (req.session as unknown as { actAs?: ActAsContext } | undefined)?.actAs;
  if (!raw) return undefined;
  return raw;
}

export function effectivePlatformBadges(req: Request): string[] | null {
  if (!devActAsAvailable(req)) return null;
  const actAs = currentActAs(req);
  if (!actAs || actAs.badgeType === "root") return null;
  return [actAs.badgeType];
}

export async function listTenants(): Promise<TenantRow[]> {
  const { data } = await tenantsDB.findAllOperational();
  return data ?? [];
}

export async function listBadgeTypes(tenantId: string | null): Promise<BadgeTypeRow[]> {
  const { data } = await badgeTypesDB.findAllForTenant(tenantId);
  return data ?? [];
}

export async function listNounVerbBadgeCodes(): Promise<string[]> {
  const { data } = await transitionDefinitionsDB.listAll();
  const codes = new Set(
    (data ?? [])
      .filter((td) => td.is_active && !td.retired_at && td.verb)
      .map((td) => `${td.entity_type.toLowerCase()}_${td.verb}`)
  );
  return [...codes].sort();
}

export async function isAssumableBadgeCode(code: string, tenantId: string | null): Promise<boolean> {
  if (code === "root") return true;
  const types = await listBadgeTypes(tenantId);
  if (types.some((t) => t.code === code)) return true;
  const nounVerbCodes = await listNounVerbBadgeCodes();
  return nounVerbCodes.includes(code);
}

export async function setActingNounVerbBadge(
  req: Request,
  input: { userId: string; tenantId: string | null; badgeType: string | null; previousBadgeType: string | null }
): Promise<void> {
  if (!devActAsAvailable(req)) return;
  const toAdd = input.badgeType && input.badgeType !== "root" ? input.badgeType : null;
  const toRemove = input.previousBadgeType && input.previousBadgeType !== "root" ? input.previousBadgeType : null;
  if (!toAdd && !toRemove) return;

  const { data: existing } = await participantsMasterDB.findByUserId(input.userId);
  let master = existing;
  if (!master) {
    if (!toAdd) return;
    const created = await participantsMasterDB.create({
      tenantId: input.tenantId ?? (await getPlatformTenantId()),
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
