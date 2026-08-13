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
  // Authorised iff the actor holds `root` (bypass) OR holds the required
  // `noun_verb` badge, Active. No role, no scope, no governed_entity_type,
  // no acting-badge declaration.
  async authorise(input: { actorId: string; requiredBadge: string }): Promise<
    { allowed: true; via: "root" | "badge" } | { allowed: false; reason: "missing_badge" }
  > {
    const { data: grants } = await badgeGrantsDB.findActiveForHolder(input.actorId);
    const active = (grants ?? []).filter((g) => g.status === "Active");
    if (active.some((g) => g.badge_type === ROOT_BADGE_CODE)) return { allowed: true, via: "root" };
    if (active.some((g) => g.badge_type === input.requiredBadge)) return { allowed: true, via: "badge" };
    return { allowed: false, reason: "missing_badge" };
  },
};
