import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "../../utils/logger.js";
import { ontologyDB } from "../ontologyDB.js";
import { eventsDB } from "../eventsDB.js";
import { userDB } from "../userDB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SeedActor {
  authoredBy: string;
  authorBadge: string;
}

interface EventTypeSeed {
  eventType: string;
  version?: string;
  isActive?: boolean;
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

const DEFAULT_VERSION = "1.0.0";

function findDuplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  return keys.filter((k) => {
    const repeated = seen.has(k);
    seen.add(k);
    return repeated;
  });
}

export async function seedEventSubscriptions(actor: SeedActor): Promise<void> {
  const seed = loadSeed();
  const ontologyViewer = { isRoot: false, tenantId: null };
  const { data: canonicalEventCategories } = await ontologyDB.findConceptsByType("category:event-types", ontologyViewer);
  const canonicalEventCategoryCodes = new Set((canonicalEventCategories ?? []).map((c) => c.code));

  for (const et of seed.eventTypes) {
    if (et.category && !canonicalEventCategoryCodes.has(et.category)) {
      throw new Error(`"${et.category}" is not a canonical category:event-types concept. Allowed: ${[...canonicalEventCategoryCodes].join(", ") || "(none registered)"}`);
    }
  }

  const duplicateEventTypes = findDuplicates(seed.eventTypes.map((et) => `${et.eventType}|${et.version ?? DEFAULT_VERSION}`));
  if (duplicateEventTypes.length) throw new Error(`[seed:event-subscriptions] eventSubscriptions.json has duplicate event types (eventType|version): ${duplicateEventTypes.join(", ")}`);
  const multipleActive = findDuplicates(seed.eventTypes.filter((et) => et.isActive ?? true).map((et) => et.eventType));
  if (multipleActive.length) throw new Error(`[seed:event-subscriptions] eventSubscriptions.json has more than one active version for: ${multipleActive.join(", ")}`);
  const duplicateSubscriptions = findDuplicates(seed.subscriptions.map((sub) => `${sub.eventType}|${sub.handlerName}`));
  if (duplicateSubscriptions.length) throw new Error(`[seed:event-subscriptions] eventSubscriptions.json has duplicate subscriptions (eventType|handlerName): ${duplicateSubscriptions.join(", ")}`);

  const { error: eventTypesError } = await eventsDB.bulkUpsertEventTypes(
    seed.eventTypes.map((et) => ({ eventType: et.eventType, version: et.version ?? DEFAULT_VERSION, isActive: et.isActive ?? true, description: et.description ?? null, category: et.category ?? null, authorId: actor.authoredBy, authorBadge: actor.authorBadge }))
  );
  if (eventTypesError) throw new Error(`[seed:event-subscriptions] event type upsert failed: ${eventTypesError.message}`);

  const { error: subscriptionsError } = await eventsDB.bulkUpsertSubscriptions(
    seed.subscriptions.map((sub) => ({ eventType: sub.eventType, handlerName: sub.handlerName, authorId: actor.authoredBy, authorBadge: actor.authorBadge }))
  );
  if (subscriptionsError) throw new Error(`[seed:event-subscriptions] subscription upsert failed: ${subscriptionsError.message}`);

  logger.info(`[seed:event-subscriptions] ${seed.eventTypes.length} event types, ${seed.subscriptions.length} subscriptions.`);
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