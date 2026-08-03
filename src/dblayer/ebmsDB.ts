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
      const { rows } = await query<EbmRow>(
        `INSERT INTO ebms (seu_id, template_id, profile_id, composed_packs, composition_report, status)
         VALUES ($1, $2, $3, $4, $5, 'Active')
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
