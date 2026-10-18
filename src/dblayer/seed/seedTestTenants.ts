import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { PLATFORM_TENANT_NAME, ATHENS_TENANT_NAME, BABYLON_TENANT_NAME } from "../constants.js";

// Test-fixture tenants. Athens and Babylon exist only for the test suite (tests/globalSetup.ts), never in db:clean-slate.
interface SeedTenant {
  code: string;
  name: string;
  status: string;
  is_system: boolean;
}

const TENANTS: SeedTenant[] = [
  { code: "athens", name: ATHENS_TENANT_NAME, status: "Operational", is_system: false},
  { code: "babylon", name: BABYLON_TENANT_NAME, status: "Operational", is_system: false},
];

export async function seedTestTenants(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const platform = await client.query("SELECT id, author_badge FROM tenants WHERE name = $1", [PLATFORM_TENANT_NAME]);
    if (platform.rows.length === 0) throw new Error("seedTestTenants: Platform tenant not found -- run db:clean-slate first.");
    const platformId = platform.rows[0].id;
    const platformBadge = platform.rows[0].author_badge;
    for (const t of TENANTS) {
      await client.query(
        `INSERT INTO tenants (code, name, status, is_system, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE
     SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         is_system = EXCLUDED.is_system,
         author_id = EXCLUDED.author_id,
         author_badge = EXCLUDED.author_badge`,
        [t.code, t.name, t.status, t.is_system, platformId, platformBadge]
      );
    }
    await client.query("COMMIT");
    logger.info(`[seed:test-tenants] upserted ${TENANTS.length} tenants.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
