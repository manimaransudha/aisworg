import type { Request } from "express";
import { badgeAuthorityEngine } from "../engine/badgeAuthorityEngine.js";
import type { RouteAuthorityMatch } from "./routeAuthorityCache.js";

export interface HeldBadges {
  isRoot: boolean;
  badgeTypes: Set<string>;
  has: (badgeType: string) => boolean;
}

export async function resolveHeldBadges(req: Request): Promise<HeldBadges> {
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return { isRoot: false, badgeTypes: new Set(), has: () => false };
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
  return { isRoot, badgeTypes, has: (badgeType: string) => isRoot || badgeTypes.has(badgeType) };
}

export function resolveAuthorBadge(authRow: RouteAuthorityMatch | undefined, held: HeldBadges): string | undefined {
  if (held.isRoot) return "root";
  if (!authRow || authRow.badges.length === 0) return "system";
  return authRow.badges.find((b) => held.has(b));
}
