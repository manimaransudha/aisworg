import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { DbResult, ServiceDefinitionRow, ServiceLevelExpectation } from "./seuTypes.js";

// CR-086 follow-on — Service Definition (Book 3 Ch.11), a first-class
// authored entity. Own table (153_service_definitions.sql), mirroring
// deliverableDefinitionsDB.ts's own shape column-for-column.
export const serviceDefinitionsDB = {
  async createDraft(input: {
    code: string;
    name: string;
    capabilityCode: string;
    purpose?: string | null;
    inputs?: string | null;
    outputs?: string | null;
    serviceLevel?: ServiceLevelExpectation[];
    governance?: string | null;
    success?: string | null;
    consumers?: string[];
    version?: string;
    authoredBy?: number | null;
    draftContent?: Record<string, unknown>;
    tenantId?: string;
    parentServiceDefinitionId?: string | null;
  }): Promise<DbResult<ServiceDefinitionRow>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>(
        `INSERT INTO service_definitions (code, name, capability_code, purpose, inputs, outputs, service_level, governance, success, consumers, version, status, authored_by, draft_content, tenant_id, parent_service_definition_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Defined', $12, $13, $14, $15)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.capabilityCode,
          input.purpose ?? null,
          input.inputs ?? null,
          input.outputs ?? null,
          JSON.stringify(input.serviceLevel ?? []),
          input.governance ?? null,
          input.success ?? null,
          input.consumers ?? [],
          input.version ?? "1.0.0",
          input.authoredBy ?? null,
          JSON.stringify(input.draftContent ?? {}),
          input.tenantId ?? PLATFORM_TENANT_ID,
          input.parentServiceDefinitionId ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(
    id: string,
    input: {
      code: string; name: string; capabilityCode: string; purpose: string | null; inputs: string | null; outputs: string | null;
      serviceLevel: ServiceLevelExpectation[]; governance: string | null; success: string | null; consumers: string[]; version: string; draftContent: Record<string, unknown>;
    }
  ): Promise<DbResult<ServiceDefinitionRow>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>(
        `UPDATE service_definitions SET code = $2, name = $3, capability_code = $4, purpose = $5, inputs = $6, outputs = $7, service_level = $8, governance = $9, success = $10, consumers = $11, version = $12, draft_content = $13
         WHERE id = $1 AND status = 'Defined' RETURNING *`,
        [id, input.code, input.name, input.capabilityCode, input.purpose, input.inputs, input.outputs, JSON.stringify(input.serviceLevel), input.governance, input.success, input.consumers, input.version, JSON.stringify(input.draftContent)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: ServiceDefinitionRow["status"]): Promise<DbResult<ServiceDefinitionRow>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>("UPDATE service_definitions SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ServiceDefinitionRow | null>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>("SELECT * FROM service_definitions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, version: string, tenantId?: string): Promise<DbResult<ServiceDefinitionRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<ServiceDefinitionRow>("SELECT * FROM service_definitions WHERE code = $1 AND version = $2", [code, version])
        : await query<ServiceDefinitionRow>("SELECT * FROM service_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3", [code, version, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveByCode(code: string, tenantId: string): Promise<DbResult<ServiceDefinitionRow | null>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>(
        "SELECT * FROM service_definitions WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1",
        [code, tenantId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-086 follow-on — core/packs.ts's own contributionServices[].code now
  // resolves against a real Service Definition (owner: "the services form
  // should show all services tied to the capabilities... in contributions.
  // capability[]"); a Pack authored under a non-Platform tenant still needs
  // to see Platform's own (the common case — most real Service Definitions
  // are Platform-owned, same visibility every other Platform+tenant Registry
  // lookup on this page already grants). Prefers the viewer's own tenant's
  // row over Platform's when both exist for the same code (same tie-break
  // findAllVisibleTo's own ORDER BY code implies elsewhere).
  async findActiveByCodeVisibleTo(code: string, viewerTenantId: string): Promise<DbResult<ServiceDefinitionRow | null>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>(
        `SELECT * FROM service_definitions
         WHERE code = $1 AND status = 'Active' AND (tenant_id = $2 OR tenant_id = $3)
         ORDER BY (tenant_id = $2) DESC, created_at DESC LIMIT 1`,
        [code, viewerTenantId, PLATFORM_TENANT_ID]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findActiveByCodeVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<ServiceDefinitionRow[]>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>("SELECT * FROM service_definitions ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<ServiceDefinitionRow[]>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>(
        "SELECT * FROM service_definitions WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Feeds the Inherit dropdown — every Active row Platform-owns.
  async findActivePlatformOwned(): Promise<DbResult<ServiceDefinitionRow[]>> {
    try {
      const { rows } = await query<ServiceDefinitionRow>(
        "SELECT * FROM service_definitions WHERE status = 'Active' AND tenant_id = $1 ORDER BY code",
        [PLATFORM_TENANT_ID]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[serviceDefinitionsDB] findActivePlatformOwned error", err as Error);
      return { error: err as Error };
    }
  },
};
