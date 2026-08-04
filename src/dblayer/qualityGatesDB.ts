import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateRow, TransitionEntityType } from "./seuTypes.js";

export const qualityGatesDB = {
  async upsert(input: {
    code: string;
    name: string;
    category?: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    criteria?: Record<string, unknown>;
    originatingPackId: string;
  }): Promise<DbResult<QualityGateRow>> {
    try {
      const { rows } = await query<QualityGateRow>(
        `INSERT INTO quality_gates (code, name, category, entity_type, from_state, to_state, criteria, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (entity_type, from_state, to_state) DO UPDATE
           SET code = EXCLUDED.code,
               name = EXCLUDED.name,
               category = EXCLUDED.category,
               criteria = EXCLUDED.criteria,
               originating_pack_id = EXCLUDED.originating_pack_id
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category ?? "Exit",
          input.entityType,
          input.fromState,
          input.toState,
          JSON.stringify(input.criteria ?? { type: "no_unresolved_obligations" }),
          input.originatingPackId,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGatesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async find(entityType: TransitionEntityType, fromState: string, toState: string): Promise<DbResult<QualityGateRow | null>> {
    try {
      const { rows } = await query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3",
        [entityType, fromState, toState]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGatesDB] find error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<QualityGateRow[]>> {
    try {
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
