import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { DbResult, DeliverableDefinitionRow } from "./seuTypes.js";

// CR-049 Phase 1 — Deliverable Definition, a first-class authored entity.
// Own table (081_deliverable_definitions.sql), mirroring templatesDB.ts's own
// shape column-for-column — no join-table functions needed here (no Pack
// selections, no capabilities; a Definition has neither).
export const deliverableDefinitionsDB = {
  async createDraft(input: {
    code: string;
    description?: string | null;
    version?: string;
    authoredBy?: number | null;
    draftContent?: Record<string, unknown>;
    tenantId?: string;
    parentDeliverableDefinitionId?: string | null;
  }): Promise<DbResult<DeliverableDefinitionRow>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>(
        `INSERT INTO deliverable_definitions (code, description, version, status, authored_by, draft_content, tenant_id, parent_deliverable_definition_id)
         VALUES ($1, $2, $3, 'Draft', $4, $5, $6, $7)
         RETURNING *`,
        [
          input.code,
          input.description ?? null,
          input.version ?? "1.0.0",
          input.authoredBy ?? null,
          JSON.stringify(input.draftContent ?? {}),
          input.tenantId ?? PLATFORM_TENANT_ID,
          input.parentDeliverableDefinitionId ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: { code: string; description: string | null; version: string; draftContent: Record<string, unknown> }): Promise<DbResult<DeliverableDefinitionRow>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>(
        `UPDATE deliverable_definitions SET code = $2, description = $3, version = $4, draft_content = $5 WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.code, input.description, input.version, JSON.stringify(input.draftContent)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: DeliverableDefinitionRow["status"]): Promise<DbResult<DeliverableDefinitionRow>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>("UPDATE deliverable_definitions SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<DeliverableDefinitionRow | null>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>("SELECT * FROM deliverable_definitions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, version: string, tenantId?: string): Promise<DbResult<DeliverableDefinitionRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<DeliverableDefinitionRow>("SELECT * FROM deliverable_definitions WHERE code = $1 AND version = $2", [code, version])
        : await query<DeliverableDefinitionRow>("SELECT * FROM deliverable_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3", [code, version, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  // The one row (if any) currently Active for a code+tenant — reactivation's
  // supersede step (core/deliverableDefinitions.ts) uses this, mirrors
  // templatesDB.findActiveByCode exactly.
  async findActiveByCode(code: string, tenantId: string): Promise<DbResult<DeliverableDefinitionRow | null>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>(
        "SELECT * FROM deliverable_definitions WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1",
        [code, tenantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<DeliverableDefinitionRow[]>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>("SELECT * FROM deliverable_definitions ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<DeliverableDefinitionRow[]>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>(
        "SELECT * FROM deliverable_definitions WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Every Active row Platform-owns — feeds the Inherit dropdown (CR-049 only
  // describes inheriting from Platform's own canonical Definition, not from
  // another tenant's).
  async findActivePlatformOwned(): Promise<DbResult<DeliverableDefinitionRow[]>> {
    try {
      const { rows } = await query<DeliverableDefinitionRow>(
        "SELECT * FROM deliverable_definitions WHERE status = 'Active' AND tenant_id = $1 ORDER BY code",
        [PLATFORM_TENANT_ID]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findActivePlatformOwned error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatus(status: DeliverableDefinitionRow["status"], viewerTenantId: string | null): Promise<DbResult<DeliverableDefinitionRow[]>> {
    try {
      const { rows } = viewerTenantId == null
        ? await query<DeliverableDefinitionRow>("SELECT * FROM deliverable_definitions WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<DeliverableDefinitionRow>(
            "SELECT * FROM deliverable_definitions WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[deliverableDefinitionsDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
