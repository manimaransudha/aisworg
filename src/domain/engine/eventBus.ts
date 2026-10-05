// Ch.30 Event Model — Publish/Consume separation (Ch.30 §9: Generated ->
// Published -> Consumed -> Archived are distinct lifecycle stages, not one
// function doing two of them). publish() persists only, then hands off to
// dispatch() fire-and-forget — publish never blocks on any handler's work,
// no matter how slow or how many there are (the old design blocked
// synchronously, demonstrated concretely by assignmentDelivery.ts's own
// external delivery call previously running inline inside publish()).
//
// Subscriptions are DB-backed (event_registry + event_subscriptions,
// migration 089), loaded into an in-memory map once at boot by
// loadSubscriptions() — never queried on the publish hot path. The table is
// the inspectable source of truth (Ch.30 §19's "Event subscription
// service"/"Event registry"); the map is the runtime cache. A DB row's
// handler_name string resolves to a real function via HANDLER_REGISTRY
// (eventHandlerRegistry.ts) — a database row can't hold executable code.
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
  // Ch.30 Event Bus redesign — the SEU this event happened under. Required
  // (not optional) so every call site consciously decides; null is the
  // correct, deliberate answer for entities with no single owning SEU
  // (Objective, Pack, Template, Profile, DeliverableDefinition).
  seuId: string | null;
  correlationId: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
  // Accountability record — the real acting user and the resolved `noun_verb`
  // badge a governed transition ran under. Required on every publish — a
  // system-originated event uses a resolved system actor (resolveSystemActor)
  // and badge "system", never an omitted/null actor.
  actorId: string;
  authorityBadge: string;
  // CR-117 (Ch.41 §12/§13/§15/§18) — the resolved Transition Definition's
  // own version_event classification (transitionEngine.evaluate's
  // gate.versionEvent), plus the hop's fromState/toState and the acting
  // tenant. Omitted/null for a pure Revision (Version Feature Plan.md) —
  // publish() then writes no version_events row at all. Never a second
  // eventBus.publish call: the real event published above is reused by id.
  versionEvent?: string | null;
  fromState?: string | null;
  toState?: string | null;
  tenantId?: string | null;
}

// Ch.30 §9 — the Consume stage, standalone and independently awaitable (not
// buried inside publish). publish() calls this without awaiting it
// (fire-and-forget); anything wanting deterministic completion — tests,
// future reconciliation work (CR-053) — can call and await it directly.
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
  // Reads event_subscriptions, resolves each handler_name via
  // HANDLER_REGISTRY (logs and skips an unresolvable name rather than
  // throwing — a bad row shouldn't take down boot), builds the in-memory
  // routing map. Called once at boot (src/app.js).
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

  /** Ch.30 §13 — Correlation Id links every event in the same engineering activity. */
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

    // CR-117 — one codepath owns the version_events write; no per-call-site
    // insert, no drift if a transition_definitions row's version_event is
    // edited later (this always reads it fresh off the input, not cached).
    // tenant_id/actor_id are NOT NULL on version_events — no `?? null`
    // fallback here: a versioned transition with no real tenant to record is
    // a bug to surface, not paper over.
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
