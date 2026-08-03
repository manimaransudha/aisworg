import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AuthorityRuleRow, DbResult } from "./seuTypes.js";

export const authorityRulesDB = {
  async upsert(input: {
    code: string;
    governedTransition: string;
    authorisedRole: string;
    originatingPackId: string;
  }): Promise<DbResult<AuthorityRuleRow>> {
    try {
      const { rows } = await query<AuthorityRuleRow>(
        `INSERT INTO authority_rules (code, governed_transition, authorised_role, originating_pack_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
           SET governed_transition = EXCLUDED.governed_transition, authorised_role = EXCLUDED.authorised_role
         RETURNING *`,
        [input.code, input.governedTransition, input.authorisedRole, input.originatingPackId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[authorityRulesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<AuthorityRuleRow | null>> {
    try {
      const { rows } = await query<AuthorityRuleRow>("SELECT * FROM authority_rules WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[authorityRulesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },
};
