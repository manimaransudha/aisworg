import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EbmCompositionReport, EbmComposedPack, EbmRow } from "./seuTypes.js";

export const ebmsDB = {
  async create(input: {
    seuId: string;
    templateId: string;
    profileId: string;
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
  }): Promise<DbResult<EbmRow>> {
    try {
      // FR-3.3/3.10: versioned per SEU — 1 for the first EBM, prior+1 on a
      // recomposition that supersedes an earlier one for the same SEU.
      const { rows } = await query<EbmRow>(
        `INSERT INTO ebms (seu_id, template_id, profile_id, composed_packs, composition_report, status, version)
         VALUES ($1, $2, $3, $4, $5, 'Active', (SELECT COALESCE(MAX(version), 0) + 1 FROM ebms WHERE seu_id = $1))
         RETURNING *`,
        [input.seuId, input.templateId, input.profileId, JSON.stringify(input.composedPacks), JSON.stringify(input.compositionReport)]
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
};
