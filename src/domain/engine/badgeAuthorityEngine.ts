// CR-006 — authorisation is noun × verb. A governed transition requires the
// actor to hold the transition's `noun_verb` badge (or `root`, which bypasses,
// §11a). This is the ONE authorisation function; the legacy acting-badge +
// governed_entity_type + capability + SEU/Pack scope check (badgeAuthorityEngine
// .evaluate) is retired — scope is a separate gate, not this layer.
//
// Owner (2026-09-22): "requireBadge is the only place this should change.
// Everything else should include requireBadge" — the actual fix, since
// requireBadge (an Express middleware needing req.session.user) can't run
// from the many callers here that have no HTTP request at all (event-bus
// subscribers like deliverableKickoffHandler, passing only event.actor_id —
// domain/engine/executionEngine.ts, transitionEngine.ts, triggerEngine.ts,
// core/commissioning.ts, core/objectives.ts, core/qualityGateWaivers.ts):
// getHeldBadges is now the ONE query, live, no session caching. Both this
// file's own authorise() and requireBadge's own resolveHeldBadges
// (domain/identity/heldBadges.ts) call it — no more two
// independently-drifting implementations of the same check.
//
// Owner, same session: "badge_grants on the user management should be
// replaced with the new badges implementation" — the real data source moved
// to participants_master.authorised_badges (migration 257), the same
// standing-grant shape authorised_role already uses. seu_ids is carried on
// every entry but never checked here ("badge does not need seuid" — always
// platform-wide). actorId is a users.id (every real caller — requireBadge,
// transitionEngine, executionEngine, commissioning — passes one); resolved
// to that user's own participants_master row via user_id.
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";

// The one Layer 1 badge this design guarantees exists (§8.2) — the
// SUPERUSER_EMAIL-bootstrapped seed. `root` bypasses every requirement (§11a).
const ROOT_BADGE_CODE = "root";

export interface HeldBadgeState {
  isRoot: boolean;
  badgeTypes: Set<string>;
}

function isExpired(effectiveTill: string, now: Date): boolean {
  const till = new Date(effectiveTill);
  return !Number.isNaN(till.getTime()) && till.getTime() < now.getTime();
}

async function getHeldBadges(actorId: string): Promise<HeldBadgeState> {
  const numericId = actorId.trim() !== "" ? Number(actorId) : NaN;
  if (Number.isInteger(numericId)) {
    const { data: master } = await participantsMasterDB.findByUserId(numericId);
    const now = new Date();
    const badgeTypes = new Set(
      (master?.authorised_badges ?? []).filter((entry) => !isExpired(entry.effective_till, now)).map((entry) => entry.badge)
    );
    return { isRoot: badgeTypes.has(ROOT_BADGE_CODE), badgeTypes };
  }
  // Owner (2026-09-22): "there is no fallback to legacy. comment it out." A
  // non-numeric actorId (e.g. dev/actAs.ts's synthetic "dev-actas:5:..."
  // holder ids) now resolves to no held badges at all — no badge_grants
  // fallback.
  return { isRoot: false, badgeTypes: new Set() };
  // const { data: grants } = await badgeGrantsDB.findActiveForHolder(actorId);
  // const badgeTypes = new Set((grants ?? []).map((g) => g.badge_type));
  // return { isRoot: badgeTypes.has(ROOT_BADGE_CODE), badgeTypes };
}

export const badgeAuthorityEngine = {
  getHeldBadges,

  // Authorised iff the actor holds `root` (bypass) OR holds ANY ONE of the
  // required badge(s), Active. No role, no scope, no governed_entity_type,
  // no acting-badge declaration.
  //
  // requiredBadge accepts a single badge (the common case — one noun_verb)
  // or an array (owner, 2026-08-30: some governed edges are intentionally
  // reachable by more than one badge, e.g. Pack's Draft->Validated by
  // pack_validate OR pack_define OR pack_reject — otherwise a pack_define-
  // only author could never move their own Pack out of Draft). matchedBadge
  // reports which one actually satisfied it, for the caller's own accountability
  // record (transitionEngine's authorityBadge) — "authorised under pack_define"
  // is a different, real fact from "authorised under pack_validate".
  async authorise(input: { actorId: string; requiredBadge: string | string[] }): Promise<
    { allowed: true; via: "root" | "badge"; matchedBadge?: string } | { allowed: false; reason: "missing_badge" }
  > {
    const { isRoot, badgeTypes } = await getHeldBadges(input.actorId);
    if (isRoot) return { allowed: true, via: "root" };
    const required = Array.isArray(input.requiredBadge) ? input.requiredBadge : [input.requiredBadge];
    const matched = required.find((b) => badgeTypes.has(b));
    if (matched) return { allowed: true, via: "badge", matchedBadge: matched };
    return { allowed: false, reason: "missing_badge" };
  },
};
