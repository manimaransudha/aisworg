import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AuthorityRuleRow, DbResult } from "./seuTypes.js";

export const authorityRulesDB = {
  async upsert(input: {
    code: string;
    governedTransition: string;
    authorisedRole: string;
    originatingPackId?: string | null;
    requiredBadgeType?: string | null;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<AuthorityRuleRow>> {
    try {
      const { rows } = await query<AuthorityRuleRow>(
        `INSERT INTO authority_rules (code, governed_transition, authorised_role, originating_pack_id, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE
           SET governed_transition = EXCLUDED.governed_transition, authorised_role = EXCLUDED.authorised_role,
                author_id = EXCLUDED.author_id, author_badge = EXCLUDED.author_badge
         RETURNING *`,
        [
          input.code,
          input.governedTransition,
          input.authorisedRole,
          input.originatingPackId ?? null,
          input.authorId,
          input.authorBadge,
        ]
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
