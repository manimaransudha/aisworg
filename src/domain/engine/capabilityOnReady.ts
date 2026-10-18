import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { eventsDB } from "../../dblayer/eventsDB.js";
import { dependencyDefinitionEngine } from "./dependencyDefinitionEngine.js";
import { requestCapabilityFulfilment } from "../../routes/seu/core/capabilities.js";
import { getSystemActor, DELIVERABLE_PRODUCING_STATE } from "../../dblayer/constants.js";
import type { EventHandler } from "./eventBus.js";
import type { DeliverableRow } from "../../dblayer/seuTypes.js";

// A Deliverable is Ready for its producing Capability when every dependency row governing its producing state is
// satisfied. That is announced by DeliverableReady, and for a Deliverable with no such rows it is true once the SEU is
// Commissioned. Each Ready Deliverable requests fulfilment of its producing Capability, unless that Capability is
// already Fulfilled or a request for it is still in flight. The request names no Participant.
export const capabilityOnReadyHandler: EventHandler = async (event) => {
  if (!event.seu_id) return;

  let deliverables: DeliverableRow[];
  if (event.event_type === "DeliverableReady") {
    const ready = event.payload as { toEntityType?: string; toState?: string } | null;
    if (ready?.toEntityType !== "Deliverable" || ready.toState !== DELIVERABLE_PRODUCING_STATE) return;
    const { data: deliverable } = await deliverablesDB.findById(event.originating_object_id);
    deliverables = deliverable ? [deliverable] : [];
  } else {
    const { data: all } = await deliverablesDB.findBySeuId(event.seu_id);
    deliverables = [];
    for (const deliverable of all ?? []) {
      const { ready } = await dependencyDefinitionEngine.isTargetReady(event.seu_id, "Deliverable", deliverable.name, DELIVERABLE_PRODUCING_STATE);
      if (ready) deliverables.push(deliverable);
    }
  }

  const capabilityIds = [...new Set(deliverables.map((d) => d.producing_capability_id).filter((id): id is string => !!id))];
  const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(event.seu_id);
  const { data: events } = await eventsDB.findByOriginatingObject("SEU", event.seu_id);
  const toRequest = capabilityIds.filter((capabilityId) => {
    if ((seuCapabilities ?? []).find((c) => c.capability_id === capabilityId)?.status !== "Unfulfilled") return false;
    const latest = (events ?? [])
      .filter((e) => (e.event_type === "CapabilityRequested" || e.event_type === "CapabilityUnavailable") && (e.payload as { capabilityId?: string } | null)?.capabilityId === capabilityId)
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
      .pop();
    return latest?.event_type !== "CapabilityRequested";
  });
  if (toRequest.length === 0) return;

  const systemActor = await getSystemActor(event.seu_id);
  for (const capabilityId of toRequest) {
    await requestCapabilityFulfilment({ seuId: event.seu_id, capabilityId, actorId: systemActor.actorId, authorBadge: systemActor.authorBadge });
  }
};
