// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md §11/§11a. A separate, focused engine
// (matching qualityGateEngine/dependencyEngine's own pattern) rather than
// folding entity-scope matching into transitionEngine itself, which stays
// generic over entity type.
//
// §9's acting-badge mechanism: every governed action declares which *one*
// badge_grants row it's performed under — never inferred by scanning
// everything the actor holds. §11a's root bypass: holding `root` satisfies
// any Engineering-badge requirement, at any scope, without a corresponding
// badge_grants row for that specific requirement — but the actor still
// declares an acting badge for the call (their root grant), so there is no
// undeclared path (§11a, corrected).
import { badgeGrantsDB } from "../../dblayer/badgeGrantsDB.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";

export type BadgeAuthorityOutcome =
  | { allowed: true; actingBadgeType: string }
  | { allowed: false; reason: "no_acting_badge_declared" }
  | { allowed: false; reason: "acting_badge_not_found_or_inactive" }
  | { allowed: false; reason: "acting_badge_not_owned_by_actor" }
  | { allowed: false; reason: "acting_badge_type_mismatch"; requiredBadgeType: string; actingBadgeType: string }
  | { allowed: false; reason: "acting_badge_wrong_entity_type"; requiredEntityType: TransitionEntityType; actingEntityType: string | null }
  | { allowed: false; reason: "acting_badge_wrong_capability" }
  | { allowed: false; reason: "acting_badge_wrong_scope" };

// The one Layer 1 badge this design guarantees exists (§8.2) — the
// SUPERUSER_EMAIL-bootstrapped seed. A narrower Platform-layer badge could
// also be wired into this bypass later via the Identity Management UI; only
// `root` is checked here for this pass (§11a).
const ROOT_BADGE_CODE = "root";

export const badgeAuthorityEngine = {
  async evaluate(input: {
    requiredBadgeType: string;
    entityType: TransitionEntityType;
    actingBadge: { grantId: string; actorId: string };
    scopeContext: { seuId?: string | null; packCode?: string | null; capabilityId?: string | null };
  }): Promise<BadgeAuthorityOutcome> {
    const { data: grant } = await badgeGrantsDB.findById(input.actingBadge.grantId);
    if (!grant || grant.status !== "Active") return { allowed: false, reason: "acting_badge_not_found_or_inactive" };
    if (grant.holder_id !== input.actingBadge.actorId) return { allowed: false, reason: "acting_badge_not_owned_by_actor" };

    // §11a: root satisfies any Engineering-badge requirement, at any scope,
    // once the declared grant itself checks out as belonging to the actor
    // and being Active — no further scope matching for the bypass case.
    if (grant.badge_type === ROOT_BADGE_CODE) {
      return { allowed: true, actingBadgeType: grant.badge_type };
    }

    if (grant.badge_type !== input.requiredBadgeType) {
      return { allowed: false, reason: "acting_badge_type_mismatch", requiredBadgeType: input.requiredBadgeType, actingBadgeType: grant.badge_type };
    }

    if (grant.governed_entity_type !== input.entityType) {
      return { allowed: false, reason: "acting_badge_wrong_entity_type", requiredEntityType: input.entityType, actingEntityType: grant.governed_entity_type };
    }

    // Mandatory Capability-narrowing (§8.0) — only meaningful where the
    // entity type actually carries a Capability (Deliverable today).
    if (input.scopeContext.capabilityId !== undefined && input.scopeContext.capabilityId !== null) {
      if (grant.capability_id !== input.scopeContext.capabilityId) {
        return { allowed: false, reason: "acting_badge_wrong_capability" };
      }
    }

    // scope_id: SEU_or_Pack (§8.4) — the grant's scope_id must match whichever
    // of seuId/packCode the transitioning entity is actually in.
    const matchesSeu = input.scopeContext.seuId != null && grant.scope_id === input.scopeContext.seuId;
    const matchesPack = input.scopeContext.packCode != null && grant.scope_id === input.scopeContext.packCode;
    if (!matchesSeu && !matchesPack) {
      return { allowed: false, reason: "acting_badge_wrong_scope" };
    }

    return { allowed: true, actingBadgeType: grant.badge_type };
  },
};
