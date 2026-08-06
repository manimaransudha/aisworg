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

  // Some rules (e.g. Phase 10's authority-deliverable-creator/-approver, seeded
  // directly by 012_badge_model.sql) don't originate from any Pack's own
  // contributions — seedSeu.ts's code -> id resolution needs a live lookup
  // for those, not just the in-memory map built from one Pack's contributed
  // rules.
  async findByCode(code: string): Promise<DbResult<AuthorityRuleRow | null>> {
    try {
      const { rows } = await query<AuthorityRuleRow>("SELECT * FROM authority_rules WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[authorityRulesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },
};
