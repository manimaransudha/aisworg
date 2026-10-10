import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validateProfileWriteAgainstSchema } from "../routes/seu/core/profileWriteValidator.js";
import type { DbResult, ProfileRow } from "./seuTypes.js";
import { getPlatformTenantId  } from "./constants.js";
 

export const profilesDB = {
  async upsert(input: {
    code: string;
    name: string;
    baseTemplateId: string;
    authoredBy: string;
    authorBadge: string;
    environment?: string;
    profileVersion?: string;
    tenantId?: string;
    status?: ProfileRow["status"];
  }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, authored_by, author_badge, environment, profile_version, tenant_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (code, profile_version, tenant_id) DO UPDATE
           SET name = EXCLUDED.name, base_template_id = EXCLUDED.base_template_id,
               environment = EXCLUDED.environment
         RETURNING *`,
        [
          input.code,
          input.name,
          input.baseTemplateId,
          input.authoredBy,
          input.authorBadge,
          input.environment ?? "development",
          input.profileVersion ?? "1.0.0",
          input.tenantId ?? (await getPlatformTenantId()),
          input.status ?? "Active",
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async create(input: {
    baseTemplateId: string;
    baseTemplateCode: string;
    authoredBy: string;
    authorBadge: string;
    environment?: string;
  }): Promise<DbResult<ProfileRow>> {
    try {
      const code = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = `Custom profile for ${input.baseTemplateId}`;
      const environment = input.environment ?? "development";
      const profileVersion = "1.0.0";

      const errors = await validateProfileWriteAgainstSchema({
        code,
        name,
        environment,
        profileVersion,
        draftContent: { baseTemplateCode: input.baseTemplateCode },
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findLatest("Profile");

      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, authored_by, author_badge, environment, status, schema_definition_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'Active', $7)
         RETURNING *`,
        [code, name, input.baseTemplateId, input.authoredBy, input.authorBadge, environment, schemaRow?.id ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async createDraft(input: {
    code: string;
    name: string;
    baseTemplateId: string;
    environment?: string;
    authoredBy: string;
    authorBadge: string;
    draftContent?: Record<string, unknown>;
    profileVersion?: string;
    tenantId?: string;
    parentProfileId?: string | null;
    schemaDefinitionId: string;
  }): Promise<DbResult<ProfileRow>> {
    try {
      const environment = input.environment ?? "development";
      const profileVersion = input.profileVersion ?? "1.0.0";
      const draftContent = input.draftContent ?? {};

      const errors = await validateProfileWriteAgainstSchema({
        code: input.code,
        name: input.name,
        environment,
        profileVersion,
        draftContent,
        tenantId: input.tenantId,
        schemaDefinitionId: input.schemaDefinitionId,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<ProfileRow>(
        `INSERT INTO profiles (code, name, base_template_id, environment, status, authored_by, author_badge, draft_content, profile_version, tenant_id, parent_profile_id, schema_definition_id)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.baseTemplateId,
          environment,
          input.authoredBy,
          input.authorBadge,
          JSON.stringify(draftContent),
          profileVersion,
          input.tenantId ?? (await getPlatformTenantId()),
          input.parentProfileId ?? null,
          schemaRow?.id ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async setDraftContent(id: string, draftContent: Record<string, unknown>): Promise<DbResult<ProfileRow>> {
    try {
      const { rows: existingRows } = await query<{ code: string; name: string; environment: string; profile_version: string; schema_definition_id: string | null; tenant_id: string }>(
        "SELECT code, name, environment, profile_version, schema_definition_id, tenant_id FROM profiles WHERE id = $1", [id]
      );
      const existing = existingRows[0];
      if (!existing) return { error: new Error(`Profile "${id}" not found`) };

      const errors = await validateProfileWriteAgainstSchema({
        id,
        code: existing.code,
        name: existing.name,
        environment: existing.environment,
        profileVersion: existing.profile_version,
        draftContent,
        tenantId: existing.tenant_id,
        schemaDefinitionId: existing.schema_definition_id,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<ProfileRow>(`UPDATE profiles SET draft_content = $2 WHERE id = $1 RETURNING *`, [id, JSON.stringify(draftContent)]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[profilesDB] setDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: { name: string; baseTemplateId: string; environment?: string; draftContent: Record<string, unknown>; profileVersion: string }): Promise<DbResult<ProfileRow>> {
    try {
      const { rows: existingRows } = await query<{ code: string; schema_definition_id: string | null; tenant_id: string }>(
        "SELECT code, schema_definition_id, tenant_id FROM profiles WHERE id = $1", [id]
      );
      const existing = existingRows[0];
      if (!existing) return { error: new Error(`Profile "${id}" not found`) };

      const environment = input.environment ?? "development";

      const errors = await validateProfileWriteAgainstSchema({
        id,
        code: existing.code,
        name: input.name,
        environment,
        profileVersion: input.profileVersion,
        draftContent: input.draftContent,
        tenantId: existing.tenant_id,
        schemaDefinitionId: existing.schema_definition_id,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<ProfileRow>(
        `UPDATE profiles SET name = $2, base_template_id = $3, environment = $4, draft_content = $5, profile_version = $6
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.name, input.baseTemplateId, environment, JSON.stringify(input.draftContent), input.profileVersion]
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

  async findAll(): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles ORDER BY category, code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<ProfileRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<ProfileRow>(
        "SELECT * FROM profiles WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY category, code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveVisibleTo(viewerTenantId: string): Promise<DbResult<ProfileRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<ProfileRow>(
        "SELECT * FROM profiles WHERE status = 'Active' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatus(status: ProfileRow["status"], viewerTenantId: string | null): Promise<DbResult<ProfileRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = viewerTenantId == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<ProfileRow>(
            "SELECT * FROM profiles WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },

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

  async findDrafts(authoredBy?: string | null): Promise<DbResult<ProfileRow[]>> {
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
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, profileVersion: string, tenantId?: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND profile_version = $2", [code, profileVersion])
        : await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND profile_version = $2 AND tenant_id = $3", [code, profileVersion, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByCode(code: string, tenantId?: string): Promise<DbResult<ProfileRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code])
        : await query<ProfileRow>("SELECT * FROM profiles WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", [code, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[profilesDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByBaseTemplateId(templateId: string): Promise<DbResult<ProfileRow[]>> {
    try {
      const { rows } = await query<ProfileRow>("SELECT * FROM profiles WHERE base_template_id = $1 ORDER BY created_at", [templateId]);
      return { data: rows };
    } catch (err) {
      logger.error("[profilesDB] findByBaseTemplateId error", err as Error);
      return { error: err as Error };
    }
  },

  async setPackSelection(profileId: string, listKind: string, packCodes: string[], authorId: string, authorBadge: string): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM profile_packs WHERE profile_id = $1 AND list_kind = $2", [profileId, listKind]);
      for (const packCode of packCodes) {
        await query(
          "INSERT INTO profile_packs (profile_id, pack_code, list_kind, author_id, author_badge) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (profile_id, pack_code, list_kind) DO NOTHING",
          [profileId, packCode, listKind, authorId, authorBadge]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[profilesDB] setPackSelection error", err as Error);
      return { error: err as Error };
    }
  },

  async getPackSelection(profileId: string, listKind: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM profile_packs WHERE profile_id = $1 AND list_kind = $2 ORDER BY pack_code",
        [profileId, listKind]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[profilesDB] getPackSelection error", err as Error);
      return { error: err as Error };
    }
  },

  async setOptionalPacks(profileId: string, packCodes: string[], authorId: string, authorBadge: string): Promise<DbResult<void>> {
    return profilesDB.setPackSelection(profileId, "optional", packCodes, authorId, authorBadge);
  },

  async getOptionalPackCodes(profileId: string): Promise<DbResult<string[]>> {
    return profilesDB.getPackSelection(profileId, "optional");
  },
};
