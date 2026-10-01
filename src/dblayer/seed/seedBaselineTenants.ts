// Tenants baseline seed
import "dotenv/config";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { PLATFORM_TENANT_NAME, DEMO_TENANT_NAME, ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, CAMBODIA_TENANT_NAME, TEMP_TENANT_ID } from "../constants.js";
interface SeedTenant {
  code: string;
  name: string;
  status: string;
  is_system: boolean;
}

const PLATFORM_TENANT: SeedTenant =
  { code: "platform", name: PLATFORM_TENANT_NAME, status: "Operational", is_system: true };

const TENANTS: SeedTenant[] = [
  { code: "demo", name: DEMO_TENANT_NAME, status: "Operational", is_system: true },
  { code: "athens", name: ATHENS_TENANT_NAME, status: "Operational", is_system: false},
  { code: "babylon", name: BABYLON_TENANT_NAME, status: "Operational", is_system: false},
  { code: "cambodia", name: CAMBODIA_TENANT_NAME, status: "Operational", is_system: false},
];

export async function seedTenantsBaseline(): Promise<void> {
  const client = await pool.connect();
  // Seed Platform tenant as default
  try {
    await client.query("BEGIN");
    // Start with a temp author information. Update it later
    const result = await client.query(
    `INSERT INTO tenants (code, name, status, is_system, author_id, author_badge)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (code) DO UPDATE
     SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         is_system = EXCLUDED.is_system,
         author_id = EXCLUDED.author_id,
         author_badge = EXCLUDED.author_badge
     RETURNING id, author_badge`,
    [
        PLATFORM_TENANT.code,
        PLATFORM_TENANT.name,
        PLATFORM_TENANT.status,
        PLATFORM_TENANT.is_system,
        TEMP_TENANT_ID,
        'bootstrap'
    ]
    );
    const platformId = result.rows[0].id;
    const platformBadge=result.rows[0].author_badge;
    await client.query(
     `UPDATE tenants
        SET author_id = $1
        WHERE author_id = $2`,[platformId,TEMP_TENANT_ID]
    );
    
    // Seed test tenants
    for (const t of TENANTS) {
      let result = await client.query(
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
    logger.info(`[seed:tenant-baseline] upserted ${TENANTS.length+1} tenants.`);
    logger.info("[seed:tenant-baseline] done.");
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.log('Error:', err)
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedTenantsBaseline()
    .catch((err) => {
      logger.error("[seed:tenant-baseline] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}