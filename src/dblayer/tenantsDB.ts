import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, TenantRow } from "./seuTypes.js";

// Phase 10 (badge model) — Ch.42 Tenant, kept minimal per the design doc:
// Phase 12 (Multi-Tenancy) owns everything else about a Tenant. Creating a
// Tenant here does not retrofit tenant_id onto any existing SEU/Deliverable/
// Pack row (design doc §9's Provisioning section).
export const tenantsDB = {
  async create(input: { code: string; name: string }): Promise<DbResult<TenantRow>> {
    try {
      const { rows } = await query<TenantRow>(
        `INSERT INTO tenants (code, name) VALUES ($1, $2) RETURNING *`,
        [input.code, input.name]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[tenantsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<TenantRow | null>> {
    try {
      const { rows } = await query<TenantRow>("SELECT * FROM tenants WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[tenantsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(code: string): Promise<DbResult<TenantRow | null>> {
    try {
      const { rows } = await query<TenantRow>("SELECT * FROM tenants WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[tenantsDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<TenantRow[]>> {
    try {
      const { rows } = await query<TenantRow>("SELECT * FROM tenants ORDER BY created_at");
      return { data: rows };
    } catch (err) {
      logger.error("[tenantsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
