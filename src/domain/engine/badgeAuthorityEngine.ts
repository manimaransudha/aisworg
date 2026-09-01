// CR-006 — authorisation is noun × verb. A governed transition requires the
// actor to hold the transition's `noun_verb` badge (or `root`, which bypasses,
// §11a). This is the ONE authorisation function; the legacy acting-badge +
// governed_entity_type + capability + SEU/Pack scope check (badgeAuthorityEngine
// .evaluate) is retired — scope is a separate gate, not this layer.
import { badgeGrantsDB } from "../../dblayer/badgeGrantsDB.js";

// The one Layer 1 badge this design guarantees exists (§8.2) — the
// SUPERUSER_EMAIL-bootstrapped seed. `root` bypasses every requirement (§11a).
const ROOT_BADGE_CODE = "root";

export const badgeAuthorityEngine = {
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
    const { data: grants } = await badgeGrantsDB.findActiveForHolder(input.actorId);
    const active = (grants ?? []).filter((g) => g.status === "Active");
    if (active.some((g) => g.badge_type === ROOT_BADGE_CODE)) return { allowed: true, via: "root" };
    const required = Array.isArray(input.requiredBadge) ? input.requiredBadge : [input.requiredBadge];
    const matched = active.find((g) => required.includes(g.badge_type));
    if (matched) return { allowed: true, via: "badge", matchedBadge: matched.badge_type };
    return { allowed: false, reason: "missing_badge" };
  },
};
