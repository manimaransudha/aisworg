import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { ConstraintType, DbResult, PolicyRow, PolicyScope } from "./seuTypes.js";

export const policiesDB = {
  async upsert(input: {
    code: string;
    name: string;
    category?: string;
    constraintType?: ConstraintType;
    scope?: PolicyScope;
    governedTransition?: string | null;
    condition?: Record<string, unknown>;
    severity?: string;
    originatingPackId: string;
    applicabilityDeliverableNames?: string[];
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<PolicyRow>> {
    try {
      const { rows } = await query<PolicyRow>(
        `INSERT INTO policies (code, name, category, constraint_type, scope, governed_transition, condition, severity, originating_pack_id, applicability_deliverable_names, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (originating_pack_id, code) DO UPDATE
           SET name = EXCLUDED.name, category = EXCLUDED.category, constraint_type = EXCLUDED.constraint_type,
               scope = EXCLUDED.scope, governed_transition = EXCLUDED.governed_transition, condition = EXCLUDED.condition,
               severity = EXCLUDED.severity, applicability_deliverable_names = EXCLUDED.applicability_deliverable_names,
               author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category ?? "Engineering",
          input.constraintType ?? "Policy",
          input.scope ?? "Transition",
          input.governedTransition ?? null,
          JSON.stringify(input.condition ?? { type: "always_true" }),
          input.severity ?? "Medium",
          input.originatingPackId,
          input.applicabilityDeliverableNames ?? [],
          input.authorId,
          input.authorBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policiesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<PolicyRow | null>> {
    try {
      const { rows } = await query<PolicyRow>("SELECT * FROM policies WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[policiesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<PolicyRow[]>> {
    try {
      if (ids.length === 0) return { data: [] };
      const { rows } = await query<PolicyRow>("SELECT * FROM policies WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findByPackIds(packIds: string[]): Promise<DbResult<PolicyRow[]>> {
    if (packIds.length === 0) return { data: [] };
    try {
      const { rows } = await query<PolicyRow>("SELECT * FROM policies WHERE originating_pack_id = ANY($1::uuid[])", [packIds]);
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findByPackIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findByPackCode(packCode: string): Promise<DbResult<Array<PolicyRow & { pack_name: string; pack_code: string }>>> {
    try {
      const { rows } = await query<PolicyRow & { pack_name: string; pack_code: string }>(
        `SELECT p.*, pk.name AS pack_name, pk.code AS pack_code
         FROM policies p
         JOIN packs pk ON pk.id = p.originating_pack_id
         WHERE pk.code = $1
         ORDER BY pk.name, p.name`,
        [packCode]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findByPackCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<PolicyRow[]>> {
    try {
      const { rows } = await query<PolicyRow>("SELECT * FROM policies ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
