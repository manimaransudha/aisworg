// Ch.30 Event Bus redesign — Event Registry + Event Subscriptions seed.
// Mirrors seedAuthorityVocabulary.ts's own shape: idempotent upsert,
// standalone-runnable, safe to rerun via db:clean-slate.
//
// Deliberately minimal — only the one real subscription being migrated off
// the old imperative eventBus.subscribe() call (WorkItemDispatched ->
// assignmentDelivery). Populating the full ~90-event catalogue is the
// chapter-by-chapter gap-closing work that comes after this structure, not
// part of it.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { assertCanonicalCategory } from "../../routes/seu/core/ontology.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EventTypeSeed {
  eventType: string;
  description?: string;
  // Ch.30 §7 — the illustrative Event Categories taxonomy (State/Governance/
  // Runtime/Integration/Administrative), a property of the event type
  // itself, not of any particular subscription. Not a closed set — §7 says
  // Packs may introduce more.
  category?: string;
}
interface SubscriptionSeed {
  eventType: string;
  handlerName: string;
}
interface EventSubscriptionsSeed {
  eventTypes: EventTypeSeed[];
  subscriptions: SubscriptionSeed[];
}

function loadSeed(): EventSubscriptionsSeed {
  const raw = readFileSync(path.join(__dirname, "data", "eventSubscriptions.json"), "utf8");
  return JSON.parse(raw) as EventSubscriptionsSeed;
}

export async function seedEventSubscriptions(): Promise<void> {
  const seed = loadSeed();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const et of seed.eventTypes) {
      // Ch.30 §7 category, validated against Ontology (category:event-types)
      // exactly like category:evidence/category:deliverable/etc. — same
      // write-path enforcement, not a DB-level CHECK constraint.
      if (et.category) await assertCanonicalCategory("category:event-types", et.category);
      await client.query(
        `INSERT INTO event_registry (event_type, description, category) VALUES ($1, $2, $3)
         ON CONFLICT (event_type) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category`,
        [et.eventType, et.description ?? null, et.category ?? null]
      );
    }

    for (const sub of seed.subscriptions) {
      await client.query(
        `INSERT INTO event_subscriptions (event_type, handler_name) VALUES ($1, $2)
         ON CONFLICT (event_type, handler_name) DO NOTHING`,
        [sub.eventType, sub.handlerName]
      );
    }

    await client.query("COMMIT");
    logger.info(`[seed:event-subscriptions] ${seed.eventTypes.length} event types, ${seed.subscriptions.length} subscriptions.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedEventSubscriptions()
    .catch((err) => {
      logger.error("[seed:event-subscriptions] failed", err as Error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
