// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md §9's Provisioning section. Called once per
// login (the same point session identity is already established), from
// every buildSessionUser() call site in routes/web/auth.js.
//
// Two independent, idempotent checks, both keyed on "no row exists at all,"
// not "no Active row" — the detail that makes revocation real (an
// Active-only check would silently re-create a deliberately revoked grant
// on the next login):
//   0. Every identity gets the universal Viewer default — never NULL/empty.
//   1. SUPERUSER_EMAIL bootstraps the one seed Platform badge, `root`.
import { badgeGrantsDB } from "../../dblayer/badgeGrantsDB.js";
import { badgeTypesDB } from "../../dblayer/badgeTypesDB.js";
import { logger } from "../../utils/logger.js";

const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || "").toLowerCase();

// Layer 1 (Platform) badge codes this holder currently holds Active — design
// doc §10's session shape: `platformBadges: string[]`, cached at login,
// checked only by the new platform-badge-gated SEU admin actions.
export async function getPlatformBadges(holderId: string): Promise<string[]> {
  const { data: grants } = await badgeGrantsDB.findActiveForHolder(holderId);
  if (!grants) return [];
  const platformScopeKinds = new Set(["None"]);
  const badgeTypeCache = new Map<string, string>(); // code -> scope_kind
  const result: string[] = [];
  for (const grant of grants) {
    if (grant.badge_type === "viewer") continue; // Viewer is unscoped too, but not a Platform-administrative badge
    let scopeKind = badgeTypeCache.get(grant.badge_type);
    if (scopeKind === undefined) {
      const { data: badgeType } = await badgeTypesDB.findPlatformDefault(grant.badge_type);
      scopeKind = badgeType?.scope_kind ?? "";
      badgeTypeCache.set(grant.badge_type, scopeKind);
    }
    if (platformScopeKinds.has(scopeKind)) result.push(grant.badge_type);
  }
  return result;
}

export async function ensureBadgeBootstrap(user: { id: number | string; email: string }): Promise<void> {
  const holderId = String(user.id);

  try {
    const { data: hasAny } = await badgeGrantsDB.anyExistsForHolder(holderId);
    if (!hasAny) {
      const { data: viewer } = await badgeTypesDB.findRegistrationDefault();
      if (viewer) {
        const result = await badgeGrantsDB.create({ holderId, badgeType: viewer.code });
        if ("validationErrors" in result) {
          logger.error(`[badgeBootstrap] Viewer grant failed for ${user.email}: ${result.validationErrors.join("; ")}`);
        }
      } else {
        logger.error("[badgeBootstrap] no badge_types row has is_registration_default = TRUE — cannot grant the universal default");
      }
    }

    if (user.email?.toLowerCase() === SUPERUSER_EMAIL && SUPERUSER_EMAIL) {
      const { data: hasRoot } = await badgeGrantsDB.anyExistsForHolder(holderId, "root");
      if (!hasRoot) {
        const result = await badgeGrantsDB.create({ holderId, badgeType: "root" });
        if ("validationErrors" in result) {
          logger.error(`[badgeBootstrap] root grant failed for ${user.email}: ${result.validationErrors.join("; ")}`);
        } else {
          logger.info(`[badgeBootstrap] granted root to ${user.email} (SUPERUSER_EMAIL)`);
        }
      }
    }
  } catch (err) {
    // Bootstrap failure must never block login — it's a best-effort side
    // effect of an existing session flow, not the flow itself.
    logger.error("[badgeBootstrap] unexpected error", err as Error);
  }
}
