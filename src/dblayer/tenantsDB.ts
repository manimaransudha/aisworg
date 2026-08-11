import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, TenantRow } from "./seuTypes.js";

// Participant Integration — Plan step 6 (Resolution 8). The minimal tenancy
// slice. A Capability, Template, and the whole engineering core are tenant-
// invariant; a tenant differs only in its edge configuration.
export const tenantsDB = {
  async create(input: { code: string; name: string }): Promise<DbResult<TenantRow>> {
    try {
      const { rows } = await query<TenantRow>(
        "INSERT INTO tenants (code, name) VALUES ($1, $2) RETURNING *",
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

  async findDefault(): Promise<DbResult<TenantRow | null>> {
    return this.findByCode("default");
  },

  async findAll(): Promise<DbResult<TenantRow[]>> {
    try {
      const { rows } = await query<TenantRow>("SELECT * FROM tenants ORDER BY created_at ASC");
      return { data: rows };
    } catch (err) {
      logger.error("[tenantsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
