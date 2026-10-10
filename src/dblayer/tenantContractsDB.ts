import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { userDB } from "./userDB.js";
import type { DbResult, TenantContractRow } from "./seuTypes.js";

export const tenantContractsDB = {
  async upsert(input: {
    tenantId: string;
    vcsBinding?: Record<string, unknown>;
    callbackAuth?: Record<string, unknown>;
    attestationConfig?: Record<string, unknown>;
  }): Promise<DbResult<TenantContractRow>> {
    try {
      const { actorId, actorBadge } = await userDB.getSuperuserId();
      const { rows } = await query<TenantContractRow>(
        `INSERT INTO tenant_contracts (tenant_id, vcs_binding, callback_auth, attestation_config, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id) DO UPDATE
           SET vcs_binding = EXCLUDED.vcs_binding,
               callback_auth = EXCLUDED.callback_auth,
               attestation_config = EXCLUDED.attestation_config,
               updated_at = NOW()
         RETURNING *`,
        [input.tenantId, JSON.stringify(input.vcsBinding ?? {}), JSON.stringify(input.callbackAuth ?? {}), JSON.stringify(input.attestationConfig ?? {}), actorId, actorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[tenantContractsDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenantId(tenantId: string): Promise<DbResult<TenantContractRow | null>> {
    try {
      const { rows } = await query<TenantContractRow>("SELECT * FROM tenant_contracts WHERE tenant_id = $1", [tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[tenantContractsDB] findByTenantId error", err as Error);
      return { error: err as Error };
    }
  },
};
