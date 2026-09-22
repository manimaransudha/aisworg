// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md §9's Provisioning section. Called once per
// login (the same point session identity is already established), from
// every buildSessionUser() call site in routes/web/auth.js.
//
// One idempotent check, keyed on "no root row exists at all," not "no
// Active row" — the detail that makes revocation real (an Active-only check
// would silently re-create a deliberately revoked grant on the next login):
// SUPERUSER_EMAIL bootstraps the one seed Platform badge, `root`. The
// universal Viewer default this used to also grant is retired (owner,
// 2026-09-22: "Remove the viewer grants") — not a real badge in the current
// model.
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { PLATFORM_TENANT_ID } from "../../dblayer/constants.js";
import { badgeAuthorityEngine } from "../engine/badgeAuthorityEngine.js";
import { logger } from "../../utils/logger.js";

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || "").toLowerCase();

// Owner (2026-09-22): "getPlatformBadges() should return badges:platform
// ontology concept_type" then "getPlatformBadges() should not get from
// badge_grants" — the full admin-surface vocabulary (migration 256:
// badges:platform's identity_manage/tenant_manage/ontology_manage/
// platform_manage, and badges:tenant's own set, e.g. tenant_manage — the
// Ontology-registered successor to the old Layer-2a tenant_admin badge_types
// row) is the ONLY source now, not badge_grants.
async function listPlatformSessionBadgeCodesFromOntology(): Promise<string[]> {
  const [{ data: platformConcepts }, { data: tenantConcepts }] = await Promise.all([
    ontologyDB.findConceptsByType("badges:platform", { isRoot: true, tenantId: null }),
    ontologyDB.findConceptsByType("badges:tenant", { isRoot: true, tenantId: null }),
  ]);
  return [...new Set([...(platformConcepts ?? []), ...(tenantConcepts ?? [])].map((c) => c.code))];
}

// Layer 1 (Platform) badge codes this holder currently holds Active — design
// doc §10's session shape: `platformBadges: string[]`, cached at login,
// checked only by the new platform-badge-gated SEU admin actions. `root` and
// every badges:platform/badges:tenant Ontology code are resolved via
// badgeAuthorityEngine.getHeldBadges — the same participants_master.
// authorised_badges check every other real authority decision now uses
// (owner: "this should write to participants_master") — badge_grants is no
// longer read here at all.
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

// Owner (2026-09-22): "Comment out bootstrapBadge... Remove the viewer
// grants" then "ensureBadgeBootstrap ... this has to be in place" then "this
// should write to participants_master" — viewer stays retired; the
// SUPERUSER_EMAIL -> root grant is restored, writing to the real god
// identity's own participants_master.authorised_badges (migration 257),
// same shape/mechanism seedIdentityBaseline.ts already uses for user 1, not
// badge_grants. getPlatformBadges above reads it back via
// badgeAuthorityEngine.getHeldBadges, so requirePlatformBadge's session
// cache still sees it.
export async function ensureBadgeBootstrap(user: { id: number | string; email: string }): Promise<void> {
  try {
    if (user.email?.toLowerCase() !== SUPERUSER_EMAIL || !SUPERUSER_EMAIL) return;
    const userId = Number(user.id);
    if (!Number.isInteger(userId)) return;

    const { data: existing } = await participantsMasterDB.findByUserId(userId);
    let master = existing;
    if (!master) {
      const created = await participantsMasterDB.create({
        tenantId: PLATFORM_TENANT_ID,
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
    // Bootstrap failure must never block login — it's a best-effort side
    // effect of an existing session flow, not the flow itself.
    logger.error("[badgeBootstrap] unexpected error", err as Error);
  }
}
