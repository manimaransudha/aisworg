import { eventsDB } from "../../dblayer/eventsDB.js";
import { eventBus } from "./eventBus.js";

export const triggerEngine = {
  async hasBeenSubmitted(entityType: string, entityId: string, fromState: string): Promise<boolean> {
    const { data: events } = await eventsDB.findByOriginatingObject(entityType, entityId);
    const eventType = `${entityType}${fromState}`;
    return (events ?? []).some((e) => e.event_type === eventType);
  },

  async submit(input: { entityType: string; entityId: string; fromState: string; actorId: string; authorityBadge: string; seuId?: string | null }): Promise<void> {
    await eventBus.publish({
      eventType: `${input.entityType}${input.fromState}`,
      originatingObjectType: input.entityType,
      originatingObjectId: input.entityId,
      seuId: input.seuId ?? null,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.actorId,
      authorityBadge: input.authorityBadge,
    });
  },
};
