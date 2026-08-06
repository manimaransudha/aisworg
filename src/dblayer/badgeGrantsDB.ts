import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { BadgeGrantRow, BadgeGrantStatus, BadgeTypeRow, DbResult, TransitionEntityType } from "./seuTypes.js";

export type BadgeGrantValidationResult = { ok: true; badgeType: BadgeTypeRow } | { ok: false; errors: string[] };

// Single writer for badge_grants — design doc §9's Enforcement point.
// Validates the scope_id/scope_kind invariant a plain CHECK can't reach
// (badge_types.scope_kind lives in a different row of a different table).
// capability_id's mandatory-when-Deliverable invariant is same-row and
// already enforced by a DB CHECK constraint (012_badge_model.sql) — not
// re-checked here.
//
// Simplification for this pass, not the design doc's own decision: resolving
// which badge_types row a `badge_type` code refers to should, in principle,
// use the grant's own tenant context — but Phase 12 hasn't retrofitted
// tenant_id onto seus/packs yet, so there's no "which tenant does this SEU
// belong to" to resolve against. With exactly one seeded Tenant for Phase 10,
// this looks up the code against the Platform default first, then any
// existing badge_types row for that code — unambiguous today, revisit once
// Phase 12's retrofit makes multi-tenant resolution meaningful here.
async function resolveBadgeType(code: string): Promise<BadgeTypeRow | null> {
  const platformDefault = await query<BadgeTypeRow>("SELECT * FROM badge_types WHERE code = $1 AND tenant_id IS NULL", [code]);
  if (platformDefault.rows[0]) return platformDefault.rows[0];
  const anyTenant = await query<BadgeTypeRow>("SELECT * FROM badge_types WHERE code = $1 LIMIT 1", [code]);
  return anyTenant.rows[0] ?? null;
}

async function validateScopeId(scopeKind: BadgeTypeRow["scope_kind"], scopeId: string | null): Promise<string[]> {
  const errors: string[] = [];

  if (scopeKind === "None") {
    if (scopeId !== null) errors.push('scope_kind "None" requires scope_id to be NULL');
    return errors;
  }

  if (scopeId === null) {
    errors.push(`scope_kind "${scopeKind}" requires a non-NULL scope_id`);
    return errors;
  }

  if (scopeKind === "Tenant") {
    const { rows } = await query("SELECT 1 FROM tenants WHERE id = $1", [scopeId]);
    if (!rows[0]) errors.push(`scope_id "${scopeId}" does not resolve to a real tenant`);
    return errors;
  }

  if (scopeKind === "SEU") {
    // id::text sidesteps Postgres's implicit uuid cast throwing a hard error
    // on a non-UUID-shaped scope_id, instead of a clean "doesn't resolve"
    // validation error — reachable for real once a Pack-code scope_id
    // (SEU_or_Pack, below) exists, since it's never UUID-shaped.
    const { rows } = await query("SELECT 1 FROM seus WHERE id::text = $1", [scopeId]);
    if (!rows[0]) errors.push(`scope_id "${scopeId}" does not resolve to a real SEU`);
    return errors;
  }

  if (scopeKind === "Pack") {
    const { rows } = await query("SELECT 1 FROM packs WHERE code = $1", [scopeId]);
    if (!rows[0]) errors.push(`scope_id "${scopeId}" does not resolve to a real Pack code`);
    return errors;
  }

  // SEU_or_Pack (§8.4/012_badge_model.sql's header comment): Creator/Reviewer/
  // Approver grants scoped to either one SEU instance or one Pack code.
  const [seu, pack] = await Promise.all([
    query("SELECT 1 FROM seus WHERE id::text = $1", [scopeId]),
    query("SELECT 1 FROM packs WHERE code = $1", [scopeId]),
  ]);
  if (!seu.rows[0] && !pack.rows[0]) {
    errors.push(`scope_id "${scopeId}" does not resolve to a real SEU id or a real Pack code`);
  }
  return errors;
}

async function validateBadgeGrant(input: {
  badgeType: string;
  governedEntityType: TransitionEntityType | null;
  capabilityId: string | null;
  scopeId: string | null;
}): Promise<BadgeGrantValidationResult> {
  const errors: string[] = [];

  const badgeType = await resolveBadgeType(input.badgeType);
  if (!badgeType) {
    return { ok: false, errors: [`badge_type "${input.badgeType}" does not resolve to any badge_types row`] };
  }

  errors.push(...(await validateScopeId(badgeType.scope_kind, input.scopeId)));

  // governed_entity_type is only meaningful for entity-type-scoped badges
  // (Creator/Reviewer/Approver, §8.4) — everything else (Viewer/Platform/
  // Tenant Admin) must leave it NULL, the same discipline as scope_id/None.
  const isEntityTypeBadge = badgeType.scope_kind === "SEU" || badgeType.scope_kind === "Pack" || badgeType.scope_kind === "SEU_or_Pack";
  if (isEntityTypeBadge && !input.governedEntityType) {
    errors.push(`badge_type "${input.badgeType}" requires governed_entity_type to be set`);
  }
  if (!isEntityTypeBadge && input.governedEntityType) {
    errors.push(`badge_type "${input.badgeType}" is not entity-type-scoped — governed_entity_type must be NULL`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, badgeType };
}

export const badgeGrantsDB = {
  // The single point of entry for creating a grant — no other code path
  // inserts into badge_grants directly (design doc §9's Enforcement point).
  async create(input: {
    holderType?: string;
    holderId: string;
    badgeType: string;
    governedEntityType?: TransitionEntityType | null;
    capabilityId?: string | null;
    scopeId?: string | null;
  }): Promise<DbResult<BadgeGrantRow> | { error: Error; validationErrors: string[] }> {
    const validation = await validateBadgeGrant({
      badgeType: input.badgeType,
      governedEntityType: input.governedEntityType ?? null,
      capabilityId: input.capabilityId ?? null,
      scopeId: input.scopeId ?? null,
    });
    if (!validation.ok) {
      return { error: new Error("badge grant validation failed"), validationErrors: validation.errors };
    }
    try {
      const { rows } = await query<BadgeGrantRow>(
        `INSERT INTO badge_grants (holder_type, holder_id, badge_type, governed_entity_type, capability_id, scope_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.holderType ?? "User", input.holderId, input.badgeType, input.governedEntityType ?? null, input.capabilityId ?? null, input.scopeId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[badgeGrantsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async revoke(id: string): Promise<DbResult<BadgeGrantRow>> {
    try {
      const { rows } = await query<BadgeGrantRow>("UPDATE badge_grants SET status = 'Revoked' WHERE id = $1 RETURNING *", [id]);
      if (!rows[0]) return { error: new Error("badge grant not found") };
      return { data: rows[0] };
    } catch (err) {
      logger.error("[badgeGrantsDB] revoke error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<BadgeGrantRow | null>> {
    try {
      const { rows } = await query<BadgeGrantRow>("SELECT * FROM badge_grants WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[badgeGrantsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // "No row exists at all" — not "no Active row" — is what makes the
  // SUPERUSER_EMAIL bootstrap's revocability real (design doc §9): an
  // Active-only check would silently re-create a deliberately revoked grant
  // on the next login.
  async anyExistsForHolder(holderId: string, badgeType?: string): Promise<DbResult<boolean>> {
    try {
      const { rows } = badgeType
        ? await query("SELECT 1 FROM badge_grants WHERE holder_id = $1 AND badge_type = $2 LIMIT 1", [holderId, badgeType])
        : await query("SELECT 1 FROM badge_grants WHERE holder_id = $1 LIMIT 1", [holderId]);
      return { data: rows.length > 0 };
    } catch (err) {
      logger.error("[badgeGrantsDB] anyExistsForHolder error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveForHolder(holderId: string): Promise<DbResult<BadgeGrantRow[]>> {
    try {
      const { rows } = await query<BadgeGrantRow>("SELECT * FROM badge_grants WHERE holder_id = $1 AND status = 'Active' ORDER BY created_at", [holderId]);
      return { data: rows };
    } catch (err) {
      logger.error("[badgeGrantsDB] findActiveForHolder error", err as Error);
      return { error: err as Error };
    }
  },

  // For a per-action badge picker (design doc §10's badge-switcher isn't
  // built yet, §17.2 — this is the minimal, honest interim: which of the
  // actor's held grants could actually satisfy this specific action, so the
  // UI can offer a real choice instead of a blind text field). Root always
  // qualifies (§11a); otherwise the grant must match badge type, entity
  // type, Capability, and scope exactly — the same test badgeAuthorityEngine
  // itself applies, kept in sync deliberately rather than re-derived there.
  async findEligibleForAction(input: {
    holderId: string;
    requiredBadgeType: string;
    entityType: TransitionEntityType;
    scopeContext: { seuId?: string | null; packCode?: string | null; capabilityId?: string | null };
  }): Promise<DbResult<BadgeGrantRow[]>> {
    try {
      const { rows } = await query<BadgeGrantRow>(
        "SELECT * FROM badge_grants WHERE holder_id = $1 AND status = 'Active' ORDER BY created_at",
        [input.holderId]
      );
      const eligible = rows.filter((grant) => {
        if (grant.badge_type === "root") return true;
        if (grant.badge_type !== input.requiredBadgeType) return false;
        if (grant.governed_entity_type !== input.entityType) return false;
        if (input.scopeContext.capabilityId != null && grant.capability_id !== input.scopeContext.capabilityId) return false;
        const matchesSeu = input.scopeContext.seuId != null && grant.scope_id === input.scopeContext.seuId;
        const matchesPack = input.scopeContext.packCode != null && grant.scope_id === input.scopeContext.packCode;
        return matchesSeu || matchesPack;
      });
      return { data: eligible };
    } catch (err) {
      logger.error("[badgeGrantsDB] findEligibleForAction error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByHolderAndType(holderId: string, badgeType: string): Promise<DbResult<BadgeGrantRow[]>> {
    try {
      const { rows } = await query<BadgeGrantRow>(
        "SELECT * FROM badge_grants WHERE holder_id = $1 AND badge_type = $2 AND status = 'Active' ORDER BY created_at",
        [holderId, badgeType]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[badgeGrantsDB] findActiveByHolderAndType error", err as Error);
      return { error: err as Error };
    }
  },
};

export type { BadgeGrantStatus };
