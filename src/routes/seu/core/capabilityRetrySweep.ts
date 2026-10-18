import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { resolveRedispatchThresholds } from "../../../domain/engine/redispatch.js";
import { raiseAttentionItem } from "./attentionItems.js";
import { getSystemActor, CAPABILITY_RETRY_DELAY_SECONDS } from "../../../dblayer/constants.js";

export interface CapabilityRetrySweepResult {
  scanned: number;
  requestedCapabilityIds: string[];
  exhaustedCapabilityIds: string[];
}

// Re-requests every unfulfilled Capability of one SEU whose latest request ended in CapabilityUnavailable at least
// CAPABILITY_RETRY_DELAY_SECONDS ago. A Capability whose latest event is a CapabilityRequested is in flight and is
// left alone, so two sweeps cannot request the same Capability twice. The attempt limit and the escalation threshold
// are the redispatch values of the SEU's EBM pool.
export async function sweepUnavailableCapabilities(input: { seuId: string; now?: Date }): Promise<CapabilityRetrySweepResult> {
  const now = input.now ?? new Date();
  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(input.seuId);
  const { data: events } = await eventsDB.findByOriginatingObject("SEU", input.seuId);
  const { maxAttempts, attentionThreshold } = await resolveRedispatchThresholds(input.seuId);
  const systemActor = await getSystemActor(input.seuId);

  const result: CapabilityRetrySweepResult = { scanned: 0, requestedCapabilityIds: [], exhaustedCapabilityIds: [] };
  for (const seuCapability of (seuCapabilities ?? []).filter((c) => c.status !== "Fulfilled")) {
    const own = (events ?? [])
      .filter((e) => (e.event_type === "CapabilityRequested" || e.event_type === "CapabilityUnavailable") && (e.payload as { capabilityId?: string } | null)?.capabilityId === seuCapability.capability_id)
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    const last = own[own.length - 1];
    if (!last || last.event_type !== "CapabilityUnavailable") continue;

    result.scanned++;
    if (now.getTime() - new Date(last.occurred_at).getTime() < CAPABILITY_RETRY_DELAY_SECONDS * 1000) continue;

    const attempts = own.filter((e) => e.event_type === "CapabilityUnavailable").length;
    if (maxAttempts != null && attempts >= maxAttempts) {
      result.exhaustedCapabilityIds.push(seuCapability.capability_id);
      continue;
    }
    if (attentionThreshold != null && attempts === attentionThreshold) {
      await raiseAttentionItem({
        seuId: input.seuId,
        category: "Escalation",
        priority: "Medium",
        title: `Capability "${seuCapability.capability_code}" still unavailable after ${attempts} attempts`,
        description: `No eligible Participant was found for Capability "${seuCapability.capability_code}". Re-requests continue (limit ${maxAttempts ?? "none configured"}).`,
        relatedObjectType: "SEU",
        relatedObjectId: input.seuId,
        triggeringEventId: last.id,
        ...systemActor,
      });
    }

    result.requestedCapabilityIds.push(seuCapability.capability_id);
    await eventBus.publish({
      eventType: "CapabilityRequested",
      originatingObjectType: "SEU",
      originatingObjectId: input.seuId,
      seuId: input.seuId,
      correlationId: last.correlation_id,
      causationId: last.id,
      actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
      payload: { capabilityId: seuCapability.capability_id },
    });
  }
  return result;
}
