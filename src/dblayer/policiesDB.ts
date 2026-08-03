import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { ConstraintType, DbResult, PolicyRow } from "./seuTypes.js";

export const policiesDB = {
  async upsert(input: {
    code: string;
    name: string;
    category?: string;
    constraintType?: ConstraintType;
    governedTransition: string;
    condition?: Record<string, unknown>;
    severity?: string;
    originatingPackId: string;
  }): Promise<DbResult<PolicyRow>> {
    try {
      const { rows } = await query<PolicyRow>(
        `INSERT INTO policies (code, name, category, constraint_type, governed_transition, condition, severity, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name, category = EXCLUDED.category, constraint_type = EXCLUDED.constraint_type,
               governed_transition = EXCLUDED.governed_transition, condition = EXCLUDED.condition,
               severity = EXCLUDED.severity
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category ?? "Engineering",
          input.constraintType ?? "Policy",
          input.governedTransition,
          JSON.stringify(input.condition ?? { type: "always_true" }),
          input.severity ?? "Medium",
          input.originatingPackId,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policiesDB] upsert error", err as Error);
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
};
