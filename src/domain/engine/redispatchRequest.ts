// DispatchDeferred consumer — Ch.33 §14 Redispatch. A pure translation: a
// deferred dispatch (qualified candidates exist, none currently Available)
// becomes a redispatch request. Attempt counting/N-M threshold logic lives
// entirely in redispatch.ts (RedispatchRequested's own consumer), not here —
// this handler's only job is to turn DispatchDeferred into the next event.
import { eventBus } from "./eventBus.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

export const redispatchRequestHandler: EventHandler = async (event: EventRow) => {
  await eventBus.publish({
    eventType: "RedispatchRequested",
    originatingObjectType: "WorkItem",
    originatingObjectId: event.originating_object_id,
    seuId: event.seu_id,
    correlationId: event.correlation_id,
    causationId: event.id,
    payload: {},
  });
};
