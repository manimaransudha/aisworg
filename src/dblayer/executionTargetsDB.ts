import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ExecutionMode, ExecutionTargetRow } from "./seuTypes.js";

// Participant Integration — Plan step 5. The per-Capability execution-target
// config the adapter seam resolves against (Contract declaration #2). A
// Capability with no row defaults to human-on-ui.
export const executionTargetsDB = {
  async upsert(input: {
    tenantId: string;
    capabilityId: string;
    mode: ExecutionMode;
    adapterEndpoint?: string | null;
    adapterAuthRef?: string | null;
  }): Promise<DbResult<ExecutionTargetRow>> {
    try {
      const { rows } = await query<ExecutionTargetRow>(
        `INSERT INTO execution_targets (tenant_id, capability_id, mode, adapter_endpoint, adapter_auth_ref)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, capability_id) DO UPDATE
           SET mode = EXCLUDED.mode,
               adapter_endpoint = EXCLUDED.adapter_endpoint,
               adapter_auth_ref = EXCLUDED.adapter_auth_ref,
               updated_at = NOW()
         RETURNING *`,
        [input.tenantId, input.capabilityId, input.mode, input.adapterEndpoint ?? null, input.adapterAuthRef ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[executionTargetsDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async deleteByTenantAndCapability(tenantId: string, capabilityId: string): Promise<DbResult<null>> {
    try {
      await query("DELETE FROM execution_targets WHERE tenant_id = $1 AND capability_id = $2", [tenantId, capabilityId]);
      return { data: null };
    } catch (err) {
      logger.error("[executionTargetsDB] deleteByTenantAndCapability error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenantAndCapability(tenantId: string, capabilityId: string): Promise<DbResult<ExecutionTargetRow | null>> {
    try {
      const { rows } = await query<ExecutionTargetRow>(
        "SELECT * FROM execution_targets WHERE tenant_id = $1 AND capability_id = $2",
        [tenantId, capabilityId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[executionTargetsDB] findByTenantAndCapability error", err as Error);
      return { error: err as Error };
    }
  },
};
