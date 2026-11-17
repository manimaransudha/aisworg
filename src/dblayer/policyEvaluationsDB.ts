import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, PolicyEvaluationRow } from "./seuTypes.js";

export const policyEvaluationsDB = {
  async create(input: {
    policyCode: string;
    policyId: string;
    constraintType: string;
    seuId: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    outcome: string;
  }): Promise<DbResult<PolicyEvaluationRow>> {
    try {
      const { rows } = await query<PolicyEvaluationRow>(
        `INSERT INTO policy_evaluations (policy_code, policy_id, constraint_type, seu_id, entity_type, entity_id, from_state, to_state, outcome)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [input.policyCode, input.policyId, input.constraintType, input.seuId, input.entityType, input.entityId, input.fromState, input.toState, input.outcome]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policyEvaluationsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<PolicyEvaluationRow[]>> {
    try {
      const { rows } = await query<PolicyEvaluationRow>("SELECT * FROM policy_evaluations WHERE seu_id = $1 ORDER BY evaluated_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[policyEvaluationsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },
};
