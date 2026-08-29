// CR-076 — the one shared "which badges does this request's actor hold"
// primitive. Before this, ontology.ts/objectives.ts/sdkAuthoring.ts each
// hand-rolled an identical copy: query badgeGrantsDB.findActiveForHolder,
// build a Set, special-case root. requireBadge (middleware/requireBadge.ts)
// and requireTenantScope both use this; a page needing several
// page-specific booleans (canRetireObjective, canProposeObjective, ...)
// still derives them locally from the Set this returns, same as before —
// only the query + root-check is centralized, not the per-page meaning.
import type { Request } from "express";
import { badgeGrantsDB } from "../../dblayer/badgeGrantsDB.js";

export interface HeldBadges {
  isRoot: boolean;
  // Every noun_verb badge_type the actor holds an Active grant for. Empty
  // for root — root bypasses via `isRoot`, not by being pre-populated here.
  badgeTypes: Set<string>;
  has: (badgeType: string) => boolean;
}

export async function resolveHeldBadges(req: Request): Promise<HeldBadges> {
  // CR-071's own corrected finding: session.user.platformBadges can only
  // ever hold a Layer-1, "None"-scope badge (root/tenant_admin/viewer) —
  // getPlatformBadges silently drops any noun_verb grant. root itself does
  // have a real "None"-scope badge_types row, so this part is correct.
  const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  let badgeTypes = new Set<string>();
  if (!isRoot && actorId) {
    const { data: grants } = await badgeGrantsDB.findActiveForHolder(actorId);
    badgeTypes = new Set((grants ?? []).map((g) => g.badge_type));
  }
  return { isRoot, badgeTypes, has: (badgeType: string) => isRoot || badgeTypes.has(badgeType) };
}
