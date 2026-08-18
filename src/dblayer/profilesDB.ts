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

  // Entity-direct authoring (bug fix correcting CR-014): a Draft Profile row is
  // the authoring document. base_template_id is NOT NULL, so a Draft must name a
  // real base Template up front (chosen on the create form); the rest of the
  // authored content lives in draft_content until publish.
  async createDraft(input: { code: string; name: string; baseTemplateId: string; environment?: string; authoredBy?: number | null; draftContent?: Record<string, unknown> }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, environment, status, authored_by, draft_content)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6)
         RETURNING *`,
        [input.code, input.name, input.baseTemplateId, input.environment ?? "development", input.authoredBy ?? null, JSON.stringify(input.draftContent ?? {})]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: { name: string; baseTemplateId: string; environment?: string; configParameters?: Record<string, unknown>; draftContent: Record<string, unknown> }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>(
        `UPDATE profiles SET name = $2, base_template_id = $3, environment = $4, config_parameters = $5, draft_content = $6
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.name, input.baseTemplateId, input.environment ?? "development", JSON.stringify(input.configParameters ?? {}), JSON.stringify(input.draftContent)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: ProfileRow["status"]): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>("UPDATE profiles SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllActive(): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE status = 'Active' ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findAllActive error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, per-verb tabs — see packsDB.findByStatusActedBy.
  async findByStatusActedBy(status: ProfileRow["status"], authorityBadge: string, actorId: number | null): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = actorId == null
        ? await query<ProfileRow>(
            `SELECT DISTINCT p.* FROM profiles p
             JOIN events e ON e.originating_object_type = 'Profile' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2
             ORDER BY p.created_at DESC`,
            [status, authorityBadge]
          )
        : await query<ProfileRow>(
            `SELECT DISTINCT p.* FROM profiles p
             JOIN events e ON e.originating_object_type = 'Profile' AND e.originating_object_id = p.id
             WHERE p.status = $1 AND e.authority_badge = $2 AND e.actor_id = $3
             ORDER BY p.created_at DESC`,
            [status, authorityBadge, String(actorId)]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByStatusActedBy error", err as Error);
      return { error: err as Error };
    }
  },

  async findDrafts(authoredBy?: number | null): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = authoredBy == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE status IN ('Draft', 'Validated') ORDER BY created_at DESC")
        : await query<ProfileRow>("SELECT * FROM profiles WHERE status IN ('Draft', 'Validated') AND authored_by = $1 ORDER BY created_at DESC", [authoredBy]);
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findDrafts error", err as Error);
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

  // Ebook Library — Full Demo Walkthrough.md, real finding #3: lets
  // commissioning check for an already-published Profile before falling
  // back to synthesizing a throwaway one.
  async findByBaseTemplateId(templateId: string): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE base_template_id = $1 ORDER BY created_at", [templateId]);
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByBaseTemplateId error", err as Error);
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
