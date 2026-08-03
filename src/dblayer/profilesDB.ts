import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, PackRow, ProfileRow } from "./seuTypes.js";

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

  async setOptionalPacks(profileId: string, packIds: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM profile_packs WHERE profile_id = $1", [profileId]);
      for (const packId of packIds) {
        await query("INSERT INTO profile_packs (profile_id, pack_id) VALUES ($1, $2)", [profileId, packId]);
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[profilesDB] setOptionalPacks error", err as Error);
      return { error: err as Error };
    }
  },

  async getOptionalPacks(profileId: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>(
        `SELECT p.* FROM packs p
         JOIN profile_packs pp ON pp.pack_id = p.id
         WHERE pp.profile_id = $1
         ORDER BY p.code`,
        [profileId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] getOptionalPacks error", err as Error);
      return { error: err as Error };
    }
  },
};
