import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { DELIVERABLE_BADGE_PREFIX, isPlatformSystemActor } from "../../dblayer/constants.js";

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

  // The badge an actor authors a row under: "root" for a root holder, otherwise the required badge itself.
  // Throws when the actor holds neither, so a creation never records a badge the actor does not hold.
  async resolveAuthorBadge(actorId: string, requiredBadge: string): Promise<string> {
    const { isRoot, badgeTypes } = await getHeldBadges(actorId);
    if (isRoot) return ROOT_BADGE_CODE;
    if (badgeTypes.has(requiredBadge)) return requiredBadge;
    throw new Error(`actor "${actorId}" does not hold ${requiredBadge}`);
  },

  async authorise(input: { actorId: string; requiredBadge: string | string[] }): Promise<
    { allowed: true; via: "root" | "badge"; matchedBadge?: string } | { allowed: false; reason: "missing_badge" }
  > {
    const { isRoot, badgeTypes } = await getHeldBadges(input.actorId);
    if (isRoot) return { allowed: true, via: "root" };
    const required = Array.isArray(input.requiredBadge) ? input.requiredBadge : [input.requiredBadge];
    if (required.every((b) => b.startsWith(DELIVERABLE_BADGE_PREFIX)) && (await isPlatformSystemActor(input.actorId))) {
      return { allowed: true, via: "badge", matchedBadge: required[0] };
    }
    const matched = required.find((b) => badgeTypes.has(b));
    if (matched) return { allowed: true, via: "badge", matchedBadge: matched };
    return { allowed: false, reason: "missing_badge" };
  },
};
