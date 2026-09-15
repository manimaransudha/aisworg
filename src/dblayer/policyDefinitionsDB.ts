import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { DbResult, PolicyDefinitionRow, PolicyCondition, PolicyScope } from "./seuTypes.js";

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
    applicabilityEnvironments?: string[];
    conditions?: PolicyCondition[];
    // Migration 216 — governedTransition/governingCondition dropped as real
    // columns (folded into each condition — PolicyCondition.governingCondition);
    // scope stays, optional/defaulted so every existing caller keeps today's
    // behaviour ("Transition").
    scope?: PolicyScope;
    version?: string;
    authoredBy?: number | null;
    draftContent?: Record<string, unknown>;
    tenantId?: string;
    parentPolicyDefinitionId?: string | null;
  }): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        `INSERT INTO policy_definitions (code, name, description, category, constraint_type, applicability_environments, conditions, scope, version, status, authored_by, draft_content, tenant_id, parent_policy_definition_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', $10, $11, $12, $13)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.description ?? null,
          input.category,
          input.constraintType ?? "Policy",
          input.applicabilityEnvironments ?? [],
          JSON.stringify(input.conditions ?? []),
          input.scope ?? "Transition",
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
      applicabilityEnvironments: string[];
      conditions: PolicyCondition[];
      // CR-104 follow-up — optional so a Draft authored before this field
      // existed round-trips unchanged.
      scope?: PolicyScope;
      version: string; draftContent: Record<string, unknown>;
    }
  ): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const { rows } = await query<PolicyDefinitionRow>(
        `UPDATE policy_definitions SET code = $2, name = $3, description = $4, category = $5, constraint_type = $6, applicability_environments = $7, conditions = $8, scope = $9, version = $10, draft_content = $11
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [
          id, input.code, input.name, input.description, input.category, input.constraintType,
          input.applicabilityEnvironments,
          JSON.stringify(input.conditions),
          input.scope ?? "Transition",
          input.version, JSON.stringify(input.draftContent),
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
