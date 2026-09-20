// CR-109 §6.1 — Governance Evaluation Outcome. Written exactly once, by
// executionEngine.execute(), for the passing evaluation that is about to
// become a Command (see migration 233's header, and
// GovernanceEvaluationOutcomeInput in seuTypes.ts). Read back by the Work
// Item Generator via commands.governance_outcome_id (§6.3).
import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, GovernanceEvaluationOutcomeInput, GovernanceEvaluationOutcomeRow } from "./seuTypes.js";

export const governanceEvaluationOutcomesDB = {
  async create(input: GovernanceEvaluationOutcomeInput): Promise<DbResult<GovernanceEvaluationOutcomeRow>> {
    try {
      const { rows } = await query<GovernanceEvaluationOutcomeRow>(
        `INSERT INTO governance_evaluation_outcomes
           (seu_id, entity_type, entity_id, from_state, to_state, outcome, rationale,
            quality_gate_id, quality_gate_outcome, applicable_authority_rule_id,
            satisfied_policy_ids, deviated_policy_ids, consulted_obligation_ids,
            open_attention_item_ids, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          input.seu_id,
          input.entity_type,
          input.entity_id,
          input.from_state,
          input.to_state,
          input.outcome,
          input.rationale,
          input.quality_gate_id,
          input.quality_gate_outcome,
          input.applicable_authority_rule_id,
          input.satisfied_policy_ids,
          input.deviated_policy_ids,
          input.consulted_obligation_ids,
          input.open_attention_item_ids,
          input.originating_pack_id,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[governanceEvaluationOutcomesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<GovernanceEvaluationOutcomeRow | null>> {
    try {
      const { rows } = await query<GovernanceEvaluationOutcomeRow>("SELECT * FROM governance_evaluation_outcomes WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[governanceEvaluationOutcomesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },
};
