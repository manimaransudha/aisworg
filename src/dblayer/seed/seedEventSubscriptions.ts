import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { ontologyDB } from "../ontologyDB.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface EventTypeSeed {
  eventType: string;
  description?: string;
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

export async function seedEventSubscriptions(actor: SeedActor): Promise<void> {
  const seed = loadSeed();
  const ontologyViewer = { isRoot: false, tenantId: null };
  const { data: canonicalEventCategories } = await ontologyDB.findConceptsByType("category:event-types", ontologyViewer);
  const canonicalEventCategoryCodes = new Set((canonicalEventCategories ?? []).map((c) => c.code));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const et of seed.eventTypes) {
      if (et.category && !canonicalEventCategoryCodes.has(et.category)) {
        throw new Error(`"${et.category}" is not a canonical category:event-types concept. Allowed: ${[...canonicalEventCategoryCodes].join(", ") || "(none registered)"}`);
      }
      await client.query(
        `INSERT INTO event_registry (event_type, description, category, author_id, author_badge) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_type) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category`,
        [et.eventType, et.description ?? null, et.category ?? null, actor.authoredBy, actor.authorBadge]
      );
    }

    for (const sub of seed.subscriptions) {
      await client.query(
        `INSERT INTO event_subscriptions (event_type, handler_name, author_id, author_badge) VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_type, handler_name) DO NOTHING`,
        [sub.eventType, sub.handlerName, actor.authoredBy, actor.authorBadge]
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { participantsMasterDB } = await import("../participantsMasterDB.js");
  const { actorId, actorBadge } = await userDB.getSuperuserId(); 
  if (!actorId) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  seedEventSubscriptions({ authoredBy: actorId, authorBadge: actorBadge })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("[seed:event-subscriptions] failed", err as Error);
      process.exit(1);
    });
}