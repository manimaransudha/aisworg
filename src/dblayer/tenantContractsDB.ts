import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, TenantContractRow } from "./seuTypes.js";

// Participant Integration — Plan step 6 (§2.1). The tenant's edge declarations
// the core stores but never interprets: VCS binding (#1), callback auth (#3),
// attestation config (#4). Each is opaque JSONB — a provider, a credential
// scheme, a signing format all live here, not in the core.
export const tenantContractsDB = {
  async upsert(input: {
    tenantId: string;
    vcsBinding?: Record<string, unknown>;
    callbackAuth?: Record<string, unknown>;
    attestationConfig?: Record<string, unknown>;
  }): Promise<DbResult<TenantContractRow>> {
    try {
      const { rows } = await query<TenantContractRow>(
        `INSERT INTO tenant_contracts (tenant_id, vcs_binding, callback_auth, attestation_config)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id) DO UPDATE
           SET vcs_binding = EXCLUDED.vcs_binding,
               callback_auth = EXCLUDED.callback_auth,
               attestation_config = EXCLUDED.attestation_config,
               updated_at = NOW()
         RETURNING *`,
        [input.tenantId, JSON.stringify(input.vcsBinding ?? {}), JSON.stringify(input.callbackAuth ?? {}), JSON.stringify(input.attestationConfig ?? {})]
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
