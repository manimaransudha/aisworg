import { randomUUID } from "node:crypto";
import { eventsDB } from "../../dblayer/eventsDB.js";
import { versionEventsDB } from "../../dblayer/versionEventsDB.js";
import { logger } from "../../utils/logger.js";
import { HANDLER_REGISTRY } from "./eventHandlerRegistry.js";
import type { EventConsumptionEntry, EventRow } from "../../dblayer/seuTypes.js";

export type EventHandler = (event: EventRow) => void | Promise<void>;

interface RegisteredHandler {
  name: string;
  handler: EventHandler;
}

let subscribersByEventType: Record<string, RegisteredHandler[]> = {};

export interface PublishInput {
  eventType: string;
  originatingObjectType: string;
  originatingObjectId: string;
  seuId: string | null;
  correlationId: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
  actorId: string;
  authorityBadge: string;
  versionEvent?: string | null;
  fromState?: string | null;
  toState?: string | null;
  tenantId?: string | null;
}

export async function dispatch(event: EventRow, handlers: RegisteredHandler[]): Promise<void> {
  for (const { name, handler } of handlers) {
    try {
      console.log(`[eventBus] dispatching '${event.event_type}' (${event.id}) to handler '${name}'`);
      await handler(event);
      console.log(`[eventBus] handler '${name}' consumed '${event.event_type}' (${event.id})`);
      await eventsDB.updateConsumptionState(event.id, name, "consumed");
    } catch (err) {
      logger.error(`[eventBus] handler '${name}' failed for event ${event.id} (${event.event_type})`, err as Error);
      await eventsDB.updateConsumptionState(event.id, name, "failed", (err as Error).message);
    }
  }
}

export const eventBus = {
  async loadSubscriptions(): Promise<void> {
    const { data: rows, error } = await eventsDB.findAllSubscriptions();
    if (error) throw error;
    const map: Record<string, RegisteredHandler[]> = {};
    for (const row of rows ?? []) {
      const handler = HANDLER_REGISTRY[row.handler_name];
      if (!handler) {
        logger.error(`[eventBus] loadSubscriptions: no handler registered for '${row.handler_name}' (event_type '${row.event_type}')`);
        continue;
      }
      (map[row.event_type] ??= []).push({ name: row.handler_name, handler });
    }
    subscribersByEventType = map;
  },

  newCorrelationId(): string {
    return randomUUID();
  },

  async publish(input: PublishInput): Promise<EventRow> {
    const handlers = subscribersByEventType[input.eventType] ?? [];

    const consumptionState: Record<string, EventConsumptionEntry> = {};
    for (const h of handlers) consumptionState[h.name] = { status: "pending", consumedAt: null };

    const { data: event, error } = await eventsDB.append({ ...input, consumptionState });
    if (error || !event) throw error ?? new Error(`failed to publish event ${input.eventType}`);

    console.log(`[eventBus] published '${input.eventType}' (${event.id}) seuId=${input.seuId ?? ""} originatingObjectId=${input.originatingObjectId ?? ""} at t=${Date.now()} — ${handlers.length} handler(s): ${handlers.map((h) => h.name).join(", ") || "none"}`);

    if (input.versionEvent) {
      if (!input.tenantId) throw new Error(`eventBus.publish: versionEvent '${input.versionEvent}' given for ${input.originatingObjectType} ${input.originatingObjectId} but no tenantId — version_events.tenant_id is NOT NULL`);
      const { error: versionEventError } = await versionEventsDB.insert({
        eventId: event.id,
        tenantId: input.tenantId,
        entityType: input.originatingObjectType,
        entityId: input.originatingObjectId,
        fromState: input.fromState ?? null,
        toState: input.toState ?? null,
        versionEvent: input.versionEvent,
        occurredAt: event.occurred_at,
        actorId: event.actor_id,
        authorityBadge: event.authority_badge,
      });
      if (versionEventError) {
        logger.error(`[eventBus] version_events insert failed for event ${event.id} (${event.event_type})`, versionEventError);
      }
    }

    if (handlers.length > 0) {
      dispatch(event, handlers).catch((err) => {
        logger.error(`[eventBus] dispatch failed for event ${event.id} (${event.event_type})`, err as Error);
      });
    }

    return event;
  },
};
