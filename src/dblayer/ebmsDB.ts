import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EbmCompositionReport, EbmComposedPack, EbmRow, EbmStatus } from "./seuTypes.js";

export const ebmsDB = {
  async create(input: {
    seuId: string;
    templateId: string;
    profileId: string;
    authorId: string;
    authorBadge: string;
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
    behaviors?: Record<string, unknown> | null;
    applicableQualityGateIds?: string[];
    applicablePolicyIds?: string[];
    seuScopedPolicyIds?: string[];
  }): Promise<DbResult<EbmRow>> {
    try {
      const { rows } = await query<EbmRow>(
        `INSERT INTO ebms (seu_id, template_id, profile_id, author_id, author_badge, composed_packs, composition_report, behaviors, applicable_quality_gate_ids, applicable_policy_ids, seu_scoped_policy_ids, status, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Composed', (SELECT COALESCE(MAX(version), 0) + 1 FROM ebms WHERE seu_id = $1))
         RETURNING *`,
        [
          input.seuId,
          input.templateId,
          input.profileId,
          input.authorId,
          input.authorBadge,
          JSON.stringify(input.composedPacks),
          JSON.stringify(input.compositionReport),
          input.behaviors ? JSON.stringify(input.behaviors) : null,
          input.applicableQualityGateIds ?? [],
          input.applicablePolicyIds ?? [],
          input.seuScopedPolicyIds ?? [],
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ebmsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<EbmRow | null>> {
    try {
      const { rows } = await query<EbmRow>("SELECT * FROM ebms WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[ebmsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: EbmStatus): Promise<DbResult<EbmRow>> {
    try {
      const { rows } = await query<EbmRow>("UPDATE ebms SET status = $2 WHERE id = $1 RETURNING *", [id, status]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[ebmsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
