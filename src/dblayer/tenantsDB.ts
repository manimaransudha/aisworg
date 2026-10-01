import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, TenantRow } from "./seuTypes.js";
import { PLATFORM_TENANT_NAME, TEMP_TENANT_ID } from "./constants.js";

// Participant Integration — Plan step 6 (Resolution 8). The minimal tenancy
// slice. A Capability, Template, and the whole engineering core are tenant-
// invariant; a tenant differs only in its edge configuration.
export const tenantsDB = {
  // author_id/author_badge are NOT NULL on the table -- every caller must
  // resolve and pass its own real actor + badge (the logged-in session's
  // user id and held badge), never a default/null.
  async create(input: { code: string; name: string; authorId: string; authorBadge: string, is_system: boolean}): Promise<DbResult<TenantRow>> {
    try {
      const { rows } = await query<TenantRow>(
        "INSERT INTO tenants (code, name, author_id, author_badge, is_system) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [input.code, input.name, input.authorId, input.authorBadge, input.is_system]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[tenantsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  // Returns the platform tenant's id, creating it (self-authored, fixed id
  // TEMP_TENANT_ID matching the schema-recovery seed) if it doesn't exist yet.
  async ensurePlatformTenant(): Promise<DbResult<string>> {
    try {
      const existing = await this.findByCode("platform");
      if (existing.error) return { error: existing.error };
      if (existing.data) return { data: existing.data.id };

      const { rows } = await query<TenantRow>(
        `INSERT INTO tenants (code, name, status, is_system, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        ["platform", PLATFORM_TENANT_NAME, "Operational", true, TEMP_TENANT_ID, "bootstrap"]
      );
      const platformId = rows[0].id;
      await query("UPDATE tenants SET author_id = id WHERE id = $1", [platformId]);
      return { data: platformId };
    } catch (err) {
      logger.error("[tenantsDB] ensurePlatformTenant error", err as Error);
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

  async findByName(name: string): Promise<DbResult<TenantRow | null>> {
    try {
      const { rows } = await query<TenantRow>("SELECT * FROM tenants WHERE name = $1", [name]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[tenantsDB] findByName error", err as Error);
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

  // CR-004: operational tenants only — excludes reserved is_system tenants (the
  // 'platform' home). Used by every tenant picker (Act-As, Tenant Management,
  // the create-user tenant selector) so 'platform' never appears as a
  // selectable engineering/admin tenant.
  async findAllOperational(): Promise<DbResult<TenantRow[]>> {
    try {
      const { rows } = await query<TenantRow>("SELECT * FROM tenants WHERE is_system = FALSE ORDER BY created_at ASC");
      return { data: rows };
    } catch (err) {
      logger.error("[tenantsDB] findAllOperational error", err as Error);
      return { error: err as Error };
    }
  },
};
