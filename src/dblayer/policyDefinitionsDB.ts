import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { schemaDefinitionsDB } from "./schemaDefinitionsDB.js";
import { validatePolicyDefinitionWriteAgainstSchema } from "../routes/seu/core/policyDefinitionWriteValidator.js";
import type { DbResult, PolicyDefinitionRow, PolicyCondition, PolicyScope } from "./seuTypes.js";
import { getPlatformTenantId } from "./constants.js";
 
export const policyDefinitionsDB = {
  async createDraft(input: {
    code: string;
    name: string;
    description?: string | null;
    category: string;
    constraintType?: "Policy" | "Standard";
    applicabilityEnvironments?: string[];
    conditions?: PolicyCondition[];
    scope?: PolicyScope;
    version?: string;
    authoredBy: string;
    authorBadge: string;
    draftContent?: Record<string, unknown>;
    tenantId?: string;
    parentPolicyDefinitionId?: string | null;
    schemaDefinitionId: string;
  }): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const constraintType = input.constraintType ?? "Policy";
      const scope = input.scope ?? "Transition";
      const version = input.version ?? "1.0.0";
      const draftContent = input.draftContent ?? {};

      const errors = await validatePolicyDefinitionWriteAgainstSchema({
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category,
        constraintType,
        applicabilityEnvironments: input.applicabilityEnvironments,
        conditions: input.conditions,
        scope,
        version,
        draftContent,
        tenantId: input.tenantId,
        schemaDefinitionId: input.schemaDefinitionId,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { data: schemaRow } = await schemaDefinitionsDB.findById(input.schemaDefinitionId);
      if (!schemaRow) return { error: new Error(`schema_definitions row "${input.schemaDefinitionId}" not found`) };

      const { rows } = await query<PolicyDefinitionRow>(
        `INSERT INTO policy_definitions (code, name, description, category, constraint_type, applicability_environments, conditions, scope, version, status, authored_by, author_badge, draft_content, tenant_id, parent_policy_definition_id, schema_definition_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          input.code,
          input.name,
          input.description ?? null,
          input.category,
          constraintType,
          input.applicabilityEnvironments ?? [],
          JSON.stringify(input.conditions ?? []),
          scope,
          version,
          input.authoredBy,
          input.authorBadge,
          JSON.stringify(draftContent),
          input.tenantId ?? (await getPlatformTenantId()),
          input.parentPolicyDefinitionId ?? null,
          schemaRow?.id ?? null,
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
      scope?: PolicyScope;
      version: string; draftContent: Record<string, unknown>;
    }
  ): Promise<DbResult<PolicyDefinitionRow>> {
    try {
      const scope = input.scope ?? "Transition";

      const { rows: existingRows } = await query<{ schema_definition_id: string | null; tenant_id: string }>(
        "SELECT schema_definition_id, tenant_id FROM policy_definitions WHERE id = $1", [id]
      );

      const errors = await validatePolicyDefinitionWriteAgainstSchema({
        id,
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category,
        constraintType: input.constraintType,
        applicabilityEnvironments: input.applicabilityEnvironments,
        conditions: input.conditions,
        scope,
        version: input.version,
        draftContent: input.draftContent,
        tenantId: existingRows[0]?.tenant_id,
        schemaDefinitionId: existingRows[0]?.schema_definition_id ?? null,
      });
      if (errors.length > 0) return { error: new Error(errors.join("; ")) };

      const { rows } = await query<PolicyDefinitionRow>(
        `UPDATE policy_definitions SET code = $2, name = $3, description = $4, category = $5, constraint_type = $6, applicability_environments = $7, conditions = $8, scope = $9, version = $10, draft_content = $11
         WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [
          id, input.code, input.name, input.description, input.category, input.constraintType,
          input.applicabilityEnvironments,
          JSON.stringify(input.conditions),
          scope,
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
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
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

  async findActiveByCodeVisibleTo(code: string, viewerTenantId: string): Promise<DbResult<PolicyDefinitionRow | null>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
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

  async findActivePlatformOwned(): Promise<DbResult<PolicyDefinitionRow[]>> {
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
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
