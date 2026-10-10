import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { badgeAuthorityEngine } from "../engine/badgeAuthorityEngine.js";
import { logger } from "../../utils/logger.js";
import { getPlatformTenantId  } from "../../dblayer/constants.js";

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || "").toLowerCase();

async function listPlatformSessionBadgeCodesFromOntology(): Promise<string[]> {
  const [{ data: platformConcepts }, { data: tenantConcepts }] = await Promise.all([
    ontologyDB.findConceptsByType("badges:platform", { isRoot: true, tenantId: null }),
    ontologyDB.findConceptsByType("badges:tenant", { isRoot: true, tenantId: null }),
  ]);
  return [...new Set([...(platformConcepts ?? []), ...(tenantConcepts ?? [])].map((c) => c.code))];
}

export async function getPlatformBadges(holderId: string): Promise<string[]> {
  const result: string[] = [];
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(holderId);
  if (isRoot) result.push("root");

  const sessionOntologyCodes = await listPlatformSessionBadgeCodesFromOntology();
  for (const code of sessionOntologyCodes) {
    if (badgeTypes.has(code)) result.push(code);
  }
  return result;
}

export async function ensureBadgeBootstrap(user: { id: string | string; email: string }): Promise<void> {
  try {
    if (user.email?.toLowerCase() !== SUPERUSER_EMAIL || !SUPERUSER_EMAIL) return;
    const userId = user.id;

    const { data: existing } = await participantsMasterDB.findByUserId(userId);
    let master = existing;
    if (!master) {
      const created = await participantsMasterDB.create({
        tenantId: await getPlatformTenantId(),
        type: "Human",
        displayName: user.email,
        userId,
      });
      master = created.data ?? null;
      if (!master) {
        logger.error(`[badgeBootstrap] could not create participants_master row for ${user.email}`);
        return;
      }
    }

    if (master.authorised_badges.some((b) => b.badge === "root")) return;
    const { error } = await participantsMasterDB.setAuthorisedBadges(master.id, [...master.authorised_badges, { badge: "root", effective_till: "9999-12-31", seu_ids: [] }]);
    if (error) {
      logger.error(`[badgeBootstrap] root grant failed for ${user.email}: ${error.message}`);
    } else {
      logger.info(`[badgeBootstrap] granted root (authorised_badges) to ${user.email} (SUPERUSER_EMAIL)`);
    }
  } catch (err) {
    logger.error("[badgeBootstrap] unexpected error", err as Error);
  }
}
