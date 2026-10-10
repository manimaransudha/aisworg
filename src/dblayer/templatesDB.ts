import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validateTemplateWriteAgainstSchema } from "../routes/seu/core/templateWriteValidator.js";
import type { CapabilityRow, DbResult, TemplateDeliverableSeed, TemplateRow } from "./seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "./constants.js";
import { userDB } from "./userDB.js";
 
export const templatesDB = {
  async upsert(input: {
    code: string;
    name: string;
    templateVersion?: string;
    deliverableCatalogue?: TemplateDeliverableSeed[];
    tenantId?: string;
    status?: TemplateRow["status"];
  }): Promise<DbResult<TemplateRow>> {
    try {
      const { actorId, actorBadge } = await userDB.getSuperuserId();
      const { rows } = await query<TemplateRow>(
        `INSERT INTO templates (code, name, template_version, deliverable_catalogue, tenant_id, status, authored_by, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code, template_version, tenant_id) DO UPDATE
           SET name = EXCLUDED.name, deliverable_catalogue = EXCLUDED.deliverable_catalogue
         RETURNING *`,
        [input.code, input.name, input.templateVersion ?? "1.0.0", JSON.stringify(input.deliverableCatalogue ?? []), input.tenantId ?? (await getPlatformTenantId()), input.status ?? "Active", actorId, actorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async createDraft(input: { code: string; name: string; templateVersion?: string; authoredBy: string; authorBadge: string; draftContent?: Record<string, unknown>; tenantId?: string; parentTemplateId?: string | null; schemaDefinitionId: string }): Promise<DbResult<TemplateRow>> {
    try {
      const templateVersion = input.templateVersion ?? "1.0.0";
      const draftContent = input.draftContent ?? {};

      const errors = await validateTemplateWriteAgainstSchema({
        code: input.code,
        name: input.name,
        templateVersion,
        draftContent,
        tenantId: input.tenantId,
        schemaDefinitionId: input.schemaDefinitionId,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<TemplateRow>(
        `INSERT INTO templates (code, name, template_version, status, deliverable_catalogue, authored_by, author_badge, draft_content, tenant_id, parent_template_id, schema_definition_id)
         VALUES ($1, $2, $3, 'Draft', '[]', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [input.code, input.name, templateVersion, input.authoredBy, input.authorBadge, JSON.stringify(draftContent), input.tenantId ?? (await getPlatformTenantId()), input.parentTemplateId ?? null, schemaRow?.id ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: { code: string; name: string; templateVersion: string; draftContent: Record<string, unknown> }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows: existingRows } = await query<{ schema_definition_id: string | null; tenant_id: string }>(
        "SELECT schema_definition_id, tenant_id FROM templates WHERE id = $1", [id]
      );

      const errors = await validateTemplateWriteAgainstSchema({
        id,
        code: input.code,
        name: input.name,
        templateVersion: input.templateVersion,
        draftContent: input.draftContent,
        tenantId: existingRows[0]?.tenant_id,
        schemaDefinitionId: existingRows[0]?.schema_definition_id ?? null,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<TemplateRow>(
        `UPDATE templates SET code = $2, name = $3, template_version = $4, draft_content = $5 WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.code, input.name, input.templateVersion, JSON.stringify(input.draftContent)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async setDraftContent(id: string, draftContent: Record<string, unknown>): Promise<DbResult<TemplateRow>> {
    try {
      const { rows: existingRows } = await query<{ code: string; name: string; template_version: string; schema_definition_id: string | null; tenant_id: string }>(
        "SELECT code, name, template_version, schema_definition_id, tenant_id FROM templates WHERE id = $1", [id]
      );
      const existing = existingRows[0];
      if (!existing) return { error: new Error(`Template "${id}" not found`) };

      const errors = await validateTemplateWriteAgainstSchema({
        id,
        code: existing.code,
        name: existing.name,
        templateVersion: existing.template_version,
        draftContent,
        tenantId: existing.tenant_id,
        schemaDefinitionId: existing.schema_definition_id,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<TemplateRow>(`UPDATE templates SET draft_content = $2 WHERE id = $1 RETURNING *`, [id, JSON.stringify(draftContent)]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] setDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async setDeliverableCatalogue(id: string, deliverableCatalogue: TemplateDeliverableSeed[]): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        "UPDATE templates SET deliverable_catalogue = $2 WHERE id = $1 RETURNING *",
        [id, JSON.stringify(deliverableCatalogue)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] setDeliverableCatalogue error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: TemplateRow["status"]): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>("UPDATE templates SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatusActedBy(status: TemplateRow["status"], authorityBadge: string, actorId: number | null): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = actorId == null
        ? await query<TemplateRow>(
            `SELECT DISTINCT t.* FROM templates t
             JOIN events e ON e.originating_object_type = 'Template' AND e.originating_object_id = t.id
             WHERE t.status = $1 AND e.authority_badge = $2
             ORDER BY t.created_at DESC`,
            [status, authorityBadge]
          )
        : await query<TemplateRow>(
            `SELECT DISTINCT t.* FROM templates t
             JOIN events e ON e.originating_object_type = 'Template' AND e.originating_object_id = t.id
             WHERE t.status = $1 AND e.authority_badge = $2 AND e.actor_id = $3
             ORDER BY t.created_at DESC`,
            [status, authorityBadge, String(actorId)]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findByStatusActedBy error", err as Error);
      return { error: err as Error };
    }
  },

  async findDrafts(authoredBy?: number | null): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = authoredBy == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE status IN ('Draft', 'Validated') ORDER BY created_at DESC")
        : await query<TemplateRow>("SELECT * FROM templates WHERE status IN ('Draft', 'Validated') AND authored_by = $1 ORDER BY created_at DESC", [authoredBy]);
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findDrafts error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, templateVersion: string, tenantId?: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND template_version = $2", [code, templateVersion])
        : await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND template_version = $2 AND tenant_id = $3", [code, templateVersion, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByCode(code: string, tenantId?: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code])
        : await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", [code, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllActive(): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE status = 'Active' ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findAllActive error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<TemplateRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<TemplateRow>(
        "SELECT * FROM templates WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveVisibleTo(viewerTenantId: string): Promise<DbResult<TemplateRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<TemplateRow>(
        "SELECT * FROM templates WHERE status = 'Active' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatus(status: TemplateRow["status"], viewerTenantId: string | null): Promise<DbResult<TemplateRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = viewerTenantId == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<TemplateRow>(
            "SELECT * FROM templates WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async setRequiredCapabilities(templateId: string, capabilityIds: string[], authorId?: string, authorBadge?: string): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM template_capabilities WHERE template_id = $1", [templateId]);
      if (capabilityIds.length > 0 && (!authorId || !authorBadge)) {
        throw new Error("setRequiredCapabilities: authorId/authorBadge are required when capabilityIds is non-empty");
      }
      for (const capabilityId of capabilityIds) {
        await query(
          `INSERT INTO template_capabilities (template_id, capability_id, author_id, author_badge)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (template_id, capability_id) DO NOTHING`,
          [templateId, capabilityId, authorId, authorBadge]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[templatesDB] setRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async getRequiredCapabilities(templateId: string): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>(
        `SELECT c.* FROM capabilities c
         JOIN template_capabilities tc ON tc.capability_id = c.id
         WHERE tc.template_id = $1
         ORDER BY c.code`,
        [templateId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] getRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async setMandatoryPacks(templateId: string, packCodes: string[], authorId: string, authorBadge: string): Promise<DbResult<void>> {
    return templatesDB.setPackSelection(templateId, "mandatory", packCodes, authorId, authorBadge);
  },

  async getMandatoryPackCodes(templateId: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM template_packs WHERE template_id = $1 ORDER BY pack_code",
        [templateId]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[templatesDB] getMandatoryPackCodes error", err as Error);
      return { error: err as Error };
    }
  },

  async setPackSelection(templateId: string, listKind: string, packCodes: string[], authorId: string, authorBadge: string): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM template_packs WHERE template_id = $1 AND list_kind = $2", [templateId, listKind]);
      for (const packCode of packCodes) {
        await query(
          "INSERT INTO template_packs (template_id, pack_code, list_kind, author_id, author_badge) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (template_id, pack_code, list_kind) DO NOTHING",
          [templateId, packCode, listKind, authorId, authorBadge]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[templatesDB] setPackSelection error", err as Error);
      return { error: err as Error };
    }
  },

  async getPackSelection(templateId: string, listKind: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM template_packs WHERE template_id = $1 AND list_kind = $2 ORDER BY pack_code",
        [templateId, listKind]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[templatesDB] getPackSelection error", err as Error);
      return { error: err as Error };
    }
  },
};
