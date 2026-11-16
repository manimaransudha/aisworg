import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validateQualityGateDefinitionWriteAgainstSchema } from "../routes/seu/core/qualityGateDefinitionWriteValidator.js";
import type { DbResult, QualityGateDefinitionRow } from "./seuTypes.js";
import { getPlatformTenantId, INITIAL_VERSION } from "./constants.js";

export interface QualityGateDefinitionFields {
  code: string;
  name: string;
  description: string | null;
  category: string;
  criteriaType: string;
  evidenceCategory: string | null;
}

export const qualityGateDefinitionsDB = {
  async createDraft(input: QualityGateDefinitionFields & {
    version?: string;
    authoredBy: string;
    authorBadge: string;
    draftContent?: Record<string, unknown>;
    tenantId: string;
    parentQualityGateDefinitionId?: string | null;
    schemaDefinitionId: string;
    status: QualityGateDefinitionRow["status"];
  }): Promise<DbResult<QualityGateDefinitionRow>> {
    try {
      const version = input.version ?? INITIAL_VERSION;
      const draftContent = input.draftContent ?? {};

      const errors = await validateQualityGateDefinitionWriteAgainstSchema({ ...input, version, draftContent });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<QualityGateDefinitionRow>(
        `INSERT INTO quality_gate_definitions (code, name, description, category, criteria_type, evidence_category, version, status, authored_by, author_badge, draft_content, tenant_id, parent_quality_gate_definition_id, schema_definition_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          input.code, input.name, input.description, input.category, input.criteriaType, input.evidenceCategory, version, input.status,
          input.authoredBy, input.authorBadge, JSON.stringify(draftContent), input.tenantId, input.parentQualityGateDefinitionId ?? null, schemaRow.id,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: QualityGateDefinitionFields & { version: string; draftContent: Record<string, unknown> }): Promise<DbResult<QualityGateDefinitionRow>> {
    try {
      const { rows: existingRows } = await query<{ schema_definition_id: string | null; tenant_id: string }>(
        "SELECT schema_definition_id, tenant_id FROM quality_gate_definitions WHERE id = $1", [id]
      );
      const errors = await validateQualityGateDefinitionWriteAgainstSchema({
        ...input, id, tenantId: existingRows[0]?.tenant_id, schemaDefinitionId: existingRows[0]?.schema_definition_id ?? null,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<QualityGateDefinitionRow>(
        `UPDATE quality_gate_definitions SET code = $2, name = $3, description = $4, category = $5, criteria_type = $6, evidence_category = $7, version = $8, draft_content = $9
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [
          id, input.code, input.name, input.description, input.category, input.criteriaType, input.evidenceCategory, input.version, JSON.stringify(input.draftContent),
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: QualityGateDefinitionRow["status"]): Promise<DbResult<QualityGateDefinitionRow>> {
    try {
      const { rows } = await query<QualityGateDefinitionRow>("UPDATE quality_gate_definitions SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<QualityGateDefinitionRow | null>> {
    try {
      const { rows } = await query<QualityGateDefinitionRow>("SELECT * FROM quality_gate_definitions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, version: string, tenantId?: string): Promise<DbResult<QualityGateDefinitionRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<QualityGateDefinitionRow>("SELECT * FROM quality_gate_definitions WHERE code = $1 AND version = $2", [code, version])
        : await query<QualityGateDefinitionRow>("SELECT * FROM quality_gate_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3", [code, version, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<QualityGateDefinitionRow[]>> {
    try {
      const { rows } = await query<QualityGateDefinitionRow>("SELECT * FROM quality_gate_definitions ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<QualityGateDefinitionRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<QualityGateDefinitionRow>(
        "SELECT * FROM quality_gate_definitions WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<QualityGateDefinitionRow[]>> {
    try {
      if (ids.length === 0) return { data: [] };
      const { rows } = await query<QualityGateDefinitionRow>("SELECT * FROM quality_gate_definitions WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByCodeVisibleTo(code: string, viewerTenantId: string): Promise<DbResult<QualityGateDefinitionRow | null>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<QualityGateDefinitionRow>(
        `SELECT * FROM quality_gate_definitions
         WHERE code = $1 AND status = 'Active' AND (tenant_id = $2 OR tenant_id = $3)
         ORDER BY (tenant_id = $2) DESC, created_at DESC LIMIT 1`,
        [code, viewerTenantId, PLATFORM_TENANT_ID]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findActiveByCodeVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // The Active Quality Gate Definitions for the given codes, one per code. A row owned by the viewer's tenant is preferred over the platform's.
  async findActiveByCodesVisibleTo(codes: string[], viewerTenantId: string): Promise<DbResult<QualityGateDefinitionRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<QualityGateDefinitionRow>(
        `SELECT DISTINCT ON (code) * FROM quality_gate_definitions
         WHERE code = ANY($1) AND status = 'Active' AND (tenant_id = $2 OR tenant_id = $3)
         ORDER BY code, (tenant_id = $2) DESC, created_at DESC`,
        [codes, viewerTenantId, PLATFORM_TENANT_ID]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findActiveByCodesVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActivePlatformOwned(): Promise<DbResult<QualityGateDefinitionRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    try {
      const { rows } = await query<QualityGateDefinitionRow>(
        "SELECT * FROM quality_gate_definitions WHERE status = 'Active' AND tenant_id = $1 ORDER BY code",
        [PLATFORM_TENANT_ID]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateDefinitionsDB] findActivePlatformOwned error", err as Error);
      return { error: err as Error };
    }
  },
};
