// Ch.30 minimal instance — in-process publish, Postgres-table event log.
// Generic over "what happened", not over any specific entity: callers supply
// the object type/id, this module never imports Objective/SEU/Deliverable.
import { randomUUID } from "node:crypto";
import { eventsDB } from "../../dblayer/eventsDB.js";
import { logger } from "../../utils/logger.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

export type EventHandler = (event: EventRow) => void | Promise<void>;

const subscribers: EventHandler[] = [];

export interface PublishInput {
  eventType: string;
  originatingObjectType: string;
  originatingObjectId: string;
  correlationId: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
  // Accountability record — the real acting user and the resolved `noun_verb`
  // badge a governed transition ran under. Omitted for ungoverned/system events.
  actorId?: string | null;
  authorityBadge?: string | null;
}

export const eventBus = {
  /** Ch.30 §11 — independent subscribers; one subscriber's failure never affects another's. */
  subscribe(handler: EventHandler): void {
    subscribers.push(handler);
  },

  /** Ch.30 §13 — Correlation Id links every event in the same engineering activity. */
  newCorrelationId(): string {
    return randomUUID();
  },

  async publish(input: PublishInput): Promise<EventRow> {
    const { data: event, error } = await eventsDB.append(input);
    if (error || !event) throw error ?? new Error(`failed to publish event ${input.eventType}`);

    for (const handler of subscribers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error(`[eventBus] subscriber error handling ${event.event_type}`, err as Error);
      }
    }
    return event;
  },
};
