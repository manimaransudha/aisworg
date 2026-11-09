import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, TEST_PLATFORM_USER_EMAIL } from "../constants.js";

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
    const actor = await client.query(
      "SELECT pm.id FROM participants_master pm JOIN users u ON u.id = pm.user_id WHERE lower(u.email) = lower($1)",
      [TEST_PLATFORM_USER_EMAIL]
    );
    if (actor.rows.length === 0) throw new Error(`seedTestTenants: ${TEST_PLATFORM_USER_EMAIL} is not provisioned -- run db:clean-slate first.`);
    const authorId = actor.rows[0].id;
    const authorBadge = "root";
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
        [t.code, t.name, t.status, t.is_system, authorId, authorBadge]
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
