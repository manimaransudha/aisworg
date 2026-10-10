import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { userDB } from "./userDB.js";
import type { BadgeScopeKind, BadgeTypeRow, DbResult } from "./seuTypes.js";

export type BadgeTypeValidationResult = { ok: true } | { ok: false; errors: string[] };

async function validateBadgeType(input: { tenantId: string | null; code: string; scopeKind: BadgeScopeKind; derivedFrom: string | null }): Promise<BadgeTypeValidationResult> {
  const errors: string[] = [];

  if (input.tenantId === null) {
    if (input.derivedFrom !== null) errors.push("a Platform-recommended badge (tenant_id = NULL) must not set derived_from");
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  if (!input.derivedFrom) {
    errors.push("a Tenant-added badge must declare derived_from — which Platform-recommended badge it's a variant of (§8.1)");
    return { ok: false, errors };
  }

  const { rows } = await query<Pick<BadgeTypeRow, "scope_kind">>(
    "SELECT scope_kind FROM badge_types WHERE code = $1 AND tenant_id IS NULL",
    [input.derivedFrom]
  );
  const parent = rows[0];
  if (!parent) {
    errors.push(`derived_from "${input.derivedFrom}" does not resolve to a genuine Platform-recommended badge`);
  } else if (parent.scope_kind === "None") {
    errors.push(`derived_from "${input.derivedFrom}" is an unscoped Layer 1 (Platform) badge — Layer 1 badges are excluded from Tenant customization (§8.1)`);
  } else if (parent.scope_kind !== input.scopeKind) {
    errors.push(`derived badge's scope_kind ("${input.scopeKind}") must match its parent's ("${parent.scope_kind}") — a derived badge inherits its parent's scope boundary, it doesn't redefine it`);
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export const badgeTypesDB = {
  async create(input: { tenantId: string | null; code: string; name: string; scopeKind: BadgeScopeKind; derivedFrom?: string | null; tiered?: boolean }): Promise<DbResult<BadgeTypeRow> | { error: Error; validationErrors: string[] }> {
    const derivedFrom = input.derivedFrom ?? null;
    const validation = await validateBadgeType({ tenantId: input.tenantId, code: input.code, scopeKind: input.scopeKind, derivedFrom });
    if (!validation.ok) {
      return { error: new Error("badge type validation failed"), validationErrors: validation.errors };
    }
    try {
      const { actorId, actorBadge } = await userDB.getSuperuserId();
      const { rows } = await query<BadgeTypeRow>(
        `INSERT INTO badge_types (tenant_id, code, name, scope_kind, derived_from, tiered, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [input.tenantId, input.code, input.name, input.scopeKind, derivedFrom, input.tiered ?? false, actorId, actorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[badgeTypesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async rename(id: string, name: string): Promise<DbResult<BadgeTypeRow>> {
    try {
      const { rows } = await query<BadgeTypeRow>("UPDATE badge_types SET name = $1 WHERE id = $2 RETURNING *", [name, id]);
      if (!rows[0]) return { error: new Error("badge type not found") };
      return { data: rows[0] };
    } catch (err) {
      logger.error("[badgeTypesDB] rename error", err as Error);
      return { error: err as Error };
    }
  },

  async resolveForTenant(code: string, tenantId: string | null): Promise<DbResult<BadgeTypeRow | null>> {
    try {
      if (tenantId) {
        const tenantRow = await query<BadgeTypeRow>("SELECT * FROM badge_types WHERE code = $1 AND tenant_id = $2", [code, tenantId]);
        if (tenantRow.rows[0]) return { data: tenantRow.rows[0] };
      }
      const { rows } = await query<BadgeTypeRow>("SELECT * FROM badge_types WHERE code = $1 AND tenant_id IS NULL", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[badgeTypesDB] resolveForTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllForTenant(tenantId: string | null): Promise<DbResult<BadgeTypeRow[]>> {
    try {
      const { rows } = await query<BadgeTypeRow>(
        "SELECT * FROM badge_types WHERE tenant_id IS NULL OR tenant_id = $1 ORDER BY tenant_id NULLS FIRST, code",
        [tenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[badgeTypesDB] findAllForTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findPlatformDefault(code: string): Promise<DbResult<BadgeTypeRow | null>> {
    try {
      const { rows } = await query<BadgeTypeRow>("SELECT * FROM badge_types WHERE code = $1 AND tenant_id IS NULL", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[badgeTypesDB] findPlatformDefault error", err as Error);
      return { error: err as Error };
    }
  },

  async findRegistrationDefault(): Promise<DbResult<BadgeTypeRow | null>> {
    try {
      const { rows } = await query<BadgeTypeRow>("SELECT * FROM badge_types WHERE is_registration_default = TRUE AND tenant_id IS NULL LIMIT 1");
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[badgeTypesDB] findRegistrationDefault error", err as Error);
      return { error: err as Error };
    }
  },
};
