import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateOutcomeInput, QualityGateOutcomeRow } from "./seuTypes.js";

export const qualityGateOutcomesDB = {
  async create(input: QualityGateOutcomeInput): Promise<DbResult<QualityGateOutcomeRow>> {
    try {
      const { rows } = await query<QualityGateOutcomeRow>(
        `INSERT INTO quality_gate_outcomes
           (seu_id, deliverable_id, tenant_id, actor_id, actor_badge, evaluation_ids, conditions, outcome, confidence_level, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
         RETURNING *`,
        [input.seu_id, input.deliverable_id, input.tenant_id, input.actor_id, input.actor_badge, input.evaluation_ids, JSON.stringify(input.conditions), input.outcome, input.confidence_level, input.rationale]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateOutcomesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findByDeliverableId(deliverableId: string): Promise<DbResult<QualityGateOutcomeRow[]>> {
    try {
      const { rows } = await query<QualityGateOutcomeRow>("SELECT * FROM quality_gate_outcomes WHERE deliverable_id = $1 ORDER BY evaluated_at DESC", [deliverableId]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateOutcomesDB] findByDeliverableId error", err as Error);
      return { error: err as Error };
    }
  },
};
