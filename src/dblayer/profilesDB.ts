import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ProfileRow } from "./seuTypes.js";

// Also owns profile_packs — Profile owns everything selectable/optional on top
// of the Template's mandatory set (Build Plan §5 item 6).
export const profilesDB = {
  async upsert(input: {
    code: string;
    name: string;
    baseTemplateId: string;
    configParameters?: Record<string, unknown>;
    environment?: string;
  }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, config_parameters, environment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name, base_template_id = EXCLUDED.base_template_id,
               config_parameters = EXCLUDED.config_parameters, environment = EXCLUDED.environment
         RETURNING *`,
        [input.code, input.name, input.baseTemplateId, JSON.stringify(input.configParameters ?? {}), input.environment ?? "development"]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async create(input: {
    baseTemplateId: string;
    environment?: string;
    configParameters?: Record<string, unknown>;
  }): Promise<DbResult<ProfileRow>> {
    try {
      const code = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, config_parameters, environment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [code, `Custom profile for ${input.baseTemplateId}`, input.baseTemplateId, JSON.stringify(input.configParameters ?? {}), input.environment ?? "development"]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // Stores the Pack's *code*, not a specific row id — bug fix, see
  // 013_template_profile_pack_by_code.sql. Same reasoning as
  // templatesDB.setMandatoryPacks: which Version a code resolves to is
  // decided fresh at every commissioning, not frozen here.
  async setOptionalPacks(profileId: string, packCodes: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM profile_packs WHERE profile_id = $1", [profileId]);
      for (const packCode of packCodes) {
        await query("INSERT INTO profile_packs (profile_id, pack_code) VALUES ($1, $2)", [profileId, packCode]);
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[profilesDB] setOptionalPacks error", err as Error);
      return { error: err as Error };
    }
  },

  async getOptionalPackCodes(profileId: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM profile_packs WHERE profile_id = $1 ORDER BY pack_code",
        [profileId]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[profilesDB] getOptionalPackCodes error", err as Error);
      return { error: err as Error };
    }
  },
};
