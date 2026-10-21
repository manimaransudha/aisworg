import type { Request } from "express";
import { badgeAuthorityEngine } from "../engine/badgeAuthorityEngine.js";
import { lookupRouteAuthority, type RouteAuthorityMatch } from "./routeAuthorityCache.js";

export interface HeldBadges {
  isRoot: boolean;
  badgeTypes: Set<string>;
  has: (badgeType: string) => boolean;
  hasVerb: (entityType: string, verb: string | null) => boolean;
}

export async function resolveHeldBadges(req: Request): Promise<HeldBadges> {
  const actorId = requireActorId(req);
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
  const has = (badgeType: string): boolean => isRoot || badgeTypes.has(badgeType);
  return { isRoot, badgeTypes, has, hasVerb: (entityType: string, verb: string | null) => !!verb && has(`${entityType.toLowerCase()}_${verb}`) };
}

export function resolveAuthorBadge(authRow: RouteAuthorityMatch | undefined, held: HeldBadges): string {
  if (held.isRoot) return "root";
  if (!authRow || authRow.badges.length === 0) return "system";
  const badge = authRow.badges.find((b) => held.has(b));
  if (!badge) throw new Error("No held badge authorises this action — cannot record an author badge");
  return badge;
}

export function requireActorId(req: Request): string {
  const id = req.session?.user?.id;
  if (id === undefined || id === null) throw new Error("No authenticated user in session — cannot determine actorId");
  return String(id);
}

export async function resolveAuthorBadgeForRequest(req: Request): Promise<string> {
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  return resolveAuthorBadge(authRow, held);
}

export async function resolveActorAndBadge(req: Request): Promise<{ actorId: string; authorBadge: string }> {
  const actorId = requireActorId(req);
  const authorBadge = await resolveAuthorBadgeForRequest(req);
  return { actorId, authorBadge };
}
