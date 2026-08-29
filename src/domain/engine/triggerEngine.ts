// CR-072 — Transition Trigger. Independent of transitionEngine/
// badgeAuthorityEngine, which only govern whether an already-attempted
// transition succeeds: this is about what causes the attempt at all.
//
// "manual" (transition_definitions.trigger): an actor has to explicitly
// decide to act. Where a row also declares submit_verb, that decision is a
// two-step queue, not a single click: whoever holds the entity_type+'_'+
// submit_verb badge submits (an event, no status change); only once that
// event exists does the actual transition's own action become available to
// whoever holds *its* badge. A row with submit_verb still null keeps
// behaving as a plain single-click badge-gated action — no queue step.
//
// "governed": deferred. Reusing the existing Event Registry/Subscriptions
// infrastructure once a real case exists — no mechanism built yet.
import { eventsDB } from "../../dblayer/eventsDB.js";
import { eventBus } from "./eventBus.js";

export const triggerEngine = {
  // Has this entity already been submitted out of fromState? Reuses the
  // existing events table directly — no new query, no new table.
  async hasBeenSubmitted(entityType: string, entityId: string, fromState: string): Promise<boolean> {
    const { data: events } = await eventsDB.findByOriginatingObject(entityType, entityId);
    const eventType = `${entityType}${fromState}`;
    return (events ?? []).some((e) => e.event_type === eventType);
  },

  // Marks the entity as queued — never touches its status. eventType follows
  // the same `${EntityType}${FromState}` convention Chapter 1 §14 already
  // documented for Objective (ObjectiveProposed) before this CR ever emitted
  // it. Publishing with zero subscribers (Objective's own case, for now) is
  // already a normal, supported path in eventBus — no registry entry
  // required to publish, only to be consumed.
  async submit(input: { entityType: string; entityId: string; fromState: string; actorId?: string | null; seuId?: string | null }): Promise<void> {
    await eventBus.publish({
      eventType: `${input.entityType}${input.fromState}`,
      originatingObjectType: input.entityType,
      originatingObjectId: input.entityId,
      seuId: input.seuId ?? null,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.actorId ?? null,
    });
  },
};
