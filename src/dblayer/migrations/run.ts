// Minimal migration runner for the SEU platform schema.
// Usage: pnpm migrate:seu  — applies 002_seu_platform.sql (idempotent: every
// statement in that file is CREATE ... IF NOT EXISTS, safe to run repeatedly).
import "dotenv/config"; // must run before ../../utils/db.js reads process.env.DATABASE_URL — app.js does this too
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run(): Promise<void> {
  const file = path.join(__dirname, "002_seu_platform.sql");
  const sql = readFileSync(file, "utf8");

  try {
    await pool.query(sql);
    logger.info("[migrate:seu] 002_seu_platform.sql applied.");
  } catch (err) {
    logger.error("[migrate:seu] migration failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
