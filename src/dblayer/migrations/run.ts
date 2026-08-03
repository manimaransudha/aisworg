// Migration runner for the SEU platform schema.
// Usage: pnpm migrate:seu — applies every 0NN_*.sql file in this directory,
// in filename order (idempotent: every statement across all files is
// CREATE ... IF NOT EXISTS / DROP ... IF EXISTS + re-ADD, safe to run
// repeatedly). Numbered-migrations convention per Build Plan §2.3.
import "dotenv/config"; // must run before ../../utils/db.js reads process.env.DATABASE_URL — app.js does this too
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run(): Promise<void> {
  const files = readdirSync(__dirname)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  try {
    for (const file of files) {
      const sql = readFileSync(path.join(__dirname, file), "utf8");
      await pool.query(sql);
      logger.info(`[migrate:seu] ${file} applied.`);
    }
  } catch (err) {
    logger.error("[migrate:seu] migration failed", err as Error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
