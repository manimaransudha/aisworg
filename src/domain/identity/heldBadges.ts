// CR-076 — the one shared "which badges does this request's actor hold"
// primitive. Before this, ontology.ts/objectives.ts/sdkAuthoring.ts each
// hand-rolled an identical copy: query badgeGrantsDB.findActiveForHolder,
// build a Set, special-case root. requireBadge (middleware/requireBadge.ts)
// and requireTenantScope both use this; a page needing several
// page-specific booleans (canRetireObjective, canProposeObjective, ...)
// still derives them locally from the Set this returns, same as before —
// only the query + root-check is centralized, not the per-page meaning.
//
// Owner (2026-09-22): "requireBadge is the only place this should change.
// Everything else should include requireBadge" — consolidated onto
// badgeAuthorityEngine.getHeldBadges, the SAME live badge_grants query
// domain/engine code (executionEngine.ts, transitionEngine.ts, ...) already
// uses directly (those callers have no req/session at all — event-bus
// subscribers, not HTTP requests — so they can't go through this file or
// requireBadge; this file goes through their shared primitive instead, so
// there's one query, not two independently-drifting copies of it). Root is
// no longer read off the session-cached platformBadges — it's the same live
// check every other actor's badges get, so a revoked root grant takes
// effect on the very next request instead of surviving until re-login.
import type { Request } from "express";
import { badgeAuthorityEngine } from "../engine/badgeAuthorityEngine.js";

export interface HeldBadges {
  isRoot: boolean;
  // Every Active badge_type the actor holds, root included (unlike the old
  // "empty for root" shape) — `.has()` below short-circuits on isRoot first,
  // so no caller needs badgeTypes to exclude it.
  badgeTypes: Set<string>;
  has: (badgeType: string) => boolean;
}

export async function resolveHeldBadges(req: Request): Promise<HeldBadges> {
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return { isRoot: false, badgeTypes: new Set(), has: () => false };
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
  return { isRoot, badgeTypes, has: (badgeType: string) => isRoot || badgeTypes.has(badgeType) };
}
