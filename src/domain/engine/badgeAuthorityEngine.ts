import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";

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
    const { data: master } = await participantsMasterDB.findById(actorId);
    const now = new Date();
    const badgeTypes = new Set(
      (master?.authorised_badges ?? []).filter((entry) => !isExpired(entry.effective_till, now)).map((entry) => entry.badge)
    );
    return { isRoot: badgeTypes.has(ROOT_BADGE_CODE), badgeTypes };
}

export const badgeAuthorityEngine = {
  getHeldBadges,

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
