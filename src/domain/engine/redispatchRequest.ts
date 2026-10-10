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
    actorId: event.actor_id,
    authorityBadge: event.authority_badge,
    payload: {},
  });
};
