import { qualityGateWaiversDB } from "../../dblayer/qualityGateWaiversDB.js";
import { getSystemActor, WAIVER_ENTITY_TYPE, WAIVER_ACTIVE_STATE, WAIVER_EXPIRED_STATE } from "../../dblayer/constants.js";
import { transitionEngine } from "./transitionEngine.js";
import { eventBus } from "./eventBus.js";

// Moves every Active waiver of the SEU whose expiry time has passed to Expired (Waiver Active -> Expired). The platform does this as the
// SEU's system actor, since no user expires a waiver. It returns the number of waivers expired.
export async function expireDueQualityGateWaivers(seuId: string): Promise<number> {
  const { data: due, error } = await qualityGateWaiversDB.findDueForExpiry(seuId);
  if (error) throw error;
  if (!due || due.length === 0) return 0;
  const systemActor = await getSystemActor(seuId);
  let expired = 0;
  for (const waiver of due) {
    const gate = await transitionEngine.evaluate({ entityType: WAIVER_ENTITY_TYPE, fromState: WAIVER_ACTIVE_STATE, toState: WAIVER_EXPIRED_STATE, actorId: systemActor.actorId, entityId: waiver.id, seuId });
    if (!gate.allowed) throw new Error(`Waiver ${waiver.id} Active -> Expired was refused: ${gate.reason}`);
    if (!gate.eventType) throw new Error(`Waiver Active -> Expired names no event`);
    const { data: updated, error: updateError } = await qualityGateWaiversDB.transition(waiver.id, WAIVER_ACTIVE_STATE, WAIVER_EXPIRED_STATE);
    if (updateError) throw updateError;
    if (!updated) continue;
    expired += 1;
    await eventBus.publish({
      eventType: gate.eventType,
      originatingObjectType: WAIVER_ENTITY_TYPE,
      originatingObjectId: waiver.id,
      seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
      tenantId: systemActor.tenantId,
      payload: { qualityGateId: waiver.quality_gate_id, entityType: waiver.entity_type, entityId: waiver.entity_id, expiresAt: waiver.expires_at },
    });
  }
  return expired;
}
