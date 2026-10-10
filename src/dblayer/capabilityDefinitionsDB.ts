import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validateCapabilityDefinitionWriteAgainstSchema } from "../routes/seu/core/capabilityDefinitionWriteValidator.js";
import type { DbResult, CapabilityDefinitionRow, CapabilityRole } from "./seuTypes.js";
import { getPlatformTenantId } from "./constants.js";
 
export const capabilityDefinitionsDB = {
  async createDraft(input: {
    code: string;
    defaultLabel: string;
    description?: string | null;
    roles?: CapabilityRole[];
    version?: string;
    authoredBy: string;
    authorBadge: string;
    draftContent?: Record<string, unknown>;
    tenantId?: string;
    parentCapabilityDefinitionId?: string | null;
    schemaDefinitionId: string;
  }): Promise<DbResult<CapabilityDefinitionRow>> {
    try {
      const version = input.version ?? "1.0.0";
      const draftContent = input.draftContent ?? {};
      const tenantId = input.tenantId ?? (await getPlatformTenantId());

      const { rows: dupRows } = await query<{ id: string }>(
        "SELECT id FROM capability_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3",
        [input.code, version, tenantId]
      );
      if (dupRows.length > 0) return { data: undefined } as DbResult<CapabilityDefinitionRow>;

      const errors = await validateCapabilityDefinitionWriteAgainstSchema({
        code: input.code,
        defaultLabel: input.defaultLabel,
        description: input.description,
        roles: input.roles,
        version,
        draftContent,
        tenantId: input.tenantId,
        schemaDefinitionId: input.schemaDefinitionId,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<CapabilityDefinitionRow>(
        `INSERT INTO capability_definitions (code, default_label, description, roles, version, status, authored_by, author_badge, draft_content, tenant_id, parent_capability_definition_id, schema_definition_id)
         VALUES ($1, $2, $3, $4, $5, 'Defined', $6, $7, $8, $9, $10, $11)
         ON CONFLICT (code, version, tenant_id) DO NOTHING
         RETURNING *`,
        [
          input.code,
          input.defaultLabel,
          input.description ?? null,
          JSON.stringify(input.roles ?? []),
          version,
          input.authoredBy,
          input.authorBadge,
          JSON.stringify(draftContent),
          tenantId,
          input.parentCapabilityDefinitionId ?? null,
          schemaRow?.id ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(
    id: string,
    input: {
      code: string; defaultLabel: string; description: string | null; roles: CapabilityRole[]; version: string; draftContent: Record<string, unknown>;
    }
  ): Promise<DbResult<CapabilityDefinitionRow>> {
    try {
      const { rows: existingRows } = await query<{ schema_definition_id: string | null; tenant_id: string }>(
        "SELECT schema_definition_id, tenant_id FROM capability_definitions WHERE id = $1", [id]
      );

      const errors = await validateCapabilityDefinitionWriteAgainstSchema({
        id,
        code: input.code,
        defaultLabel: input.defaultLabel,
        description: input.description,
        roles: input.roles,
        version: input.version,
        draftContent: input.draftContent,
        tenantId: existingRows[0]?.tenant_id,
        schemaDefinitionId: existingRows[0]?.schema_definition_id ?? null,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<CapabilityDefinitionRow>(
        `UPDATE capability_definitions SET code = $2, default_label = $3, description = $4, roles = $5, version = $6, draft_content = $7
         WHERE id = $1 AND status = 'Defined' RETURNING *`,
        [id, input.code, input.defaultLabel, input.description, JSON.stringify(input.roles), input.version, JSON.stringify(input.draftContent)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: CapabilityDefinitionRow["status"], authorityBadge: string | null, authoredBy: string): Promise<DbResult<CapabilityDefinitionRow>> {
    try {
      const { rows } = await query<CapabilityDefinitionRow>(
        "UPDATE capability_definitions SET status = $1, author_badge = COALESCE($2, author_badge), authored_by = $3 WHERE id = $4 RETURNING *",
        [status, authorityBadge, authoredBy, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<CapabilityDefinitionRow | null>> {
    try {
      const { rows } = await query<CapabilityDefinitionRow>("SELECT * FROM capability_definitions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, version: string, tenantId?: string): Promise<DbResult<CapabilityDefinitionRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<CapabilityDefinitionRow>("SELECT * FROM capability_definitions WHERE code = $1 AND version = $2", [code, version])
        : await query<CapabilityDefinitionRow>("SELECT * FROM capability_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3", [code, version, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByCode(code: string, tenantId: string): Promise<DbResult<CapabilityDefinitionRow | null>> {
    try {
      const { rows } = await query<CapabilityDefinitionRow>(
        "SELECT * FROM capability_definitions WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1",
        [code, tenantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<CapabilityDefinitionRow[]>> {
    try {
      const { rows } = await query<CapabilityDefinitionRow>("SELECT * FROM capability_definitions ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<CapabilityDefinitionRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<CapabilityDefinitionRow>(
        "SELECT * FROM capability_definitions WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActivePlatformOwned(): Promise<DbResult<CapabilityDefinitionRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<CapabilityDefinitionRow>(
        "SELECT * FROM capability_definitions WHERE status = 'Active' AND tenant_id = $1 ORDER BY code",
        [PLATFORM_TENANT_ID]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[capabilityDefinitionsDB] findActivePlatformOwned error", err as Error);
      return { error: err as Error };
    }
  },
};
