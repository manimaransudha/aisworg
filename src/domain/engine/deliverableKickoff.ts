import { seusDB } from "../../dblayer/seusDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { transitionDeliverable } from "../../routes/seu/core/deliverables.js";
import { RESOLVED_OBLIGATION_STATUSES, RESOLVED_ATTENTION_STATUSES } from "./qualityGateEngine.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

export const deliverableKickoffHandler: EventHandler = async (event: EventRow) => {
  if (!event.seu_id) return;

  if (event.event_type === "ObligationTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_OBLIGATION_STATUSES.has(payload.toState)) return;
  }
  if (event.event_type === "AttentionItemTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_ATTENTION_STATUSES.has(payload.toState)) return;
  }

  const { data: seu } = await seusDB.findById(event.seu_id);
  if (!seu) {
    logger.error(`[deliverableKickoffHandler] SEU not found: ${event.seu_id}`);
    return;
  }
  if (seu.lifecycle_state !== "Operational") return;

  const { data: deliverables } = await deliverablesDB.findBySeuId(seu.id);
  for (const deliverable of deliverables ?? []) {
    const { data: nextTransitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Deliverable", deliverable.lifecycle_state);
    for (const next of nextTransitions ?? []) {
      await transitionDeliverable({
        deliverableId: deliverable.id,
        targetState: next.toState,
        actorId: event.actor_id ?? undefined,
        requestedBy: null,
      });
    }
  }
};
