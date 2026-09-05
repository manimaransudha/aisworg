import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { DbResult, PolicyDefinitionRow, PolicyCondition } from "./seuTypes.js";

// CR-089 — Policy Definition (Book 3 Ch.24), a new standalone table
// (167_policy_definitions.sql), mirroring serviceDefinitionsDB.ts's own shape
// column-for-column. No relationship to any other entity (owner: "there is
// no relationship with any other entity") — unlike Service Definition, there
// is no capabilityCode-equivalent foreign concept threaded through every
// method here.
export const policyDefinitionsDB = {
  async createDraft(input: {
    code: string;
    name: string;
    description?: string | null;
    category: string;
    constraintType?: "Policy" | "Standard";
    applicabilityDeliverableNames?: string[];
    applicabilityEnvironments?: string[];
    applicabilityDeliverableLifecycle?: string[];
    conditions?: PolicyCondition[];
    version?: string;
    authoredBy?: number | null;
    draftContent?: Record<string, unknown>;
    tenantId?: string;
    parentPolicyDefinitionId?: string | null;
  }): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        `INSERT INTO policy_definitions (code, name, description, category, constraint_type, applicability_deliverable_names, applicability_environments, applicability_deliverable_lifecycle, conditions, version, status, authored_by, draft_content, tenant_id, parent_policy_definition_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Draft', $11, $12, $13, $14)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.description ?? null,
          input.category,
          input.constraintType ?? "Policy",
          input.applicabilityDeliverableNames ?? [],
          input.applicabilityEnvironments ?? [],
          input.applicabilityDeliverableLifecycle ?? [],
          JSON.stringify(input.conditions ?? []),
          input.version ?? "1.0.0",
          input.authoredBy ?? null,
          JSON.stringify(input.draftContent ?? {}),
          input.tenantId ?? PLATFORM_TENANT_ID,
          input.parentPolicyDefinitionId ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policyDefinitionsDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(
    id: string,
    input: {
      code: string; name: string; description: string | null; category: string; constraintType: "Policy" | "Standard";
      applicabilityDeliverableNames: string[]; applicabilityEnvironments: string[]; applicabilityDeliverableLifecycle: string[];
      conditions: PolicyCondition[]; version: string; draftContent: Record<string, unknown>;
    }
  ): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        `UPDATE policy_definitions SET code = $2, name = $3, description = $4, category = $5, constraint_type = $6, applicability_deliverable_names = $7, applicability_environments = $8, applicability_deliverable_lifecycle = $9, conditions = $10, version = $11, draft_content = $12
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [
          id, input.code, input.name, input.description, input.category, input.constraintType,
          input.applicabilityDeliverableNames, input.applicabilityEnvironments, input.applicabilityDeliverableLifecycle,
          JSON.stringify(input.conditions), input.version, JSON.stringify(input.draftContent),
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policyDefinitionsDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: PolicyDefinitionRow["status"]): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>("UPDATE policy_definitions SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policyDefinitionsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<PolicyDefinitionRow | null>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>("SELECT * FROM policy_definitions WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[policyDefinitionsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCodeAndVersion(code: string, version: string, tenantId?: string): Promise<DbResult<PolicyDefinitionRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<PolicyDefinitionRow>("SELECT * FROM policy_definitions WHERE code = $1 AND version = $2", [code, version])
        : await query<PolicyDefinitionRow>("SELECT * FROM policy_definitions WHERE code = $1 AND version = $2 AND tenant_id = $3", [code, version, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[policyDefinitionsDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<PolicyDefinitionRow[]>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>("SELECT * FROM policy_definitions ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[policyDefinitionsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<PolicyDefinitionRow[]>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        "SELECT * FROM policy_definitions WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[policyDefinitionsDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Pack authoring's own contributionPolicies[] resolution (mirrors
  // serviceDefinitionsDB.findActiveByCodeVisibleTo exactly) — prefers the
  // viewer's own tenant's row over Platform's when both exist for the same
  // code.
  async findActiveByCodeVisibleTo(code: string, viewerTenantId: string): Promise<DbResult<PolicyDefinitionRow | null>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        `SELECT * FROM policy_definitions
         WHERE code = $1 AND status = 'Active' AND (tenant_id = $2 OR tenant_id = $3)
         ORDER BY (tenant_id = $2) DESC, created_at DESC LIMIT 1`,
        [code, viewerTenantId, PLATFORM_TENANT_ID]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[policyDefinitionsDB] findActiveByCodeVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Feeds the Inherit dropdown — every Active row Platform-owns.
  async findActivePlatformOwned(): Promise<DbResult<PolicyDefinitionRow[]>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        "SELECT * FROM policy_definitions WHERE status = 'Active' AND tenant_id = $1 ORDER BY code",
        [PLATFORM_TENANT_ID]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[policyDefinitionsDB] findActivePlatformOwned error", err as Error);
      return { error: err as Error };
    }
  },
};
