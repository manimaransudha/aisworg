// CR-015 — Pack categories as data (Ch.5 §6/§17). A new category is an INSERT
// here, not a migration. Soft-retire via is_active (never delete/rename), same
// discipline as authority_nouns.
import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

export interface PackCategoryRow {
  code: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export const packCategoriesDB = {
  async findActive(): Promise<DbResult<PackCategoryRow[]>> {
    try {
      const { rows } = await query<PackCategoryRow>("SELECT * FROM pack_category WHERE is_active = TRUE ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[packCategoriesDB] findActive error", err as Error);
      return { error: err as Error };
    }
  },

  async isActive(code: string): Promise<boolean> {
    try {
      const { rows } = await query<{ ok: boolean }>(
        "SELECT TRUE AS ok FROM pack_category WHERE code = $1 AND is_active = TRUE",
        [code]
      );
      return rows.length > 0;
    } catch (err) {
      logger.error("[packCategoriesDB] isActive error", err as Error);
      return false;
    }
  },
};
