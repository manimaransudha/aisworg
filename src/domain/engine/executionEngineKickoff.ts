import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { attentionItemsDB } from "../../dblayer/attentionItemsDB.js";
import { attemptSeuCommenceWork } from "../../routes/seu/core/commissioning.js";
import { RESOLVED_OBLIGATION_STATUSES, RESOLVED_ATTENTION_STATUSES } from "./qualityGateEngine.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

async function handleSeuActivated(event: EventRow): Promise<void> {
  await attemptSeuCommenceWork({
    seuId: event.originating_object_id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id ?? undefined,
  });
}

async function handleObligationTransitioned(event: EventRow): Promise<void> {
  const payload = event.payload as { fromState?: string; toState?: string };
  const toState = payload.toState;
  if (!toState || !RESOLVED_OBLIGATION_STATUSES.has(toState)) return;

  const { data: obligation } = await obligationsDB.findById(event.originating_object_id);
  if (!obligation) {
    logger.error(`[executionEngineKickoff] Obligation not found: ${event.originating_object_id}`);
    return;
  }
  if (!obligation.blocked_from_state || !obligation.blocked_to_state) return;
  if (obligation.related_object_type !== "SEU") return;

  await attemptSeuCommenceWork({
    seuId: obligation.related_object_id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id ?? undefined,
  });
}

async function handleAttentionItemTransitioned(event: EventRow): Promise<void> {
  const payload = event.payload as { toState?: string };
  const toState = payload.toState;
  if (!toState || !RESOLVED_ATTENTION_STATUSES.has(toState)) return;

  const { data: attentionItem } = await attentionItemsDB.findById(event.originating_object_id);
  if (!attentionItem) {
    logger.error(`[executionEngineKickoff] AttentionItem not found: ${event.originating_object_id}`);
    return;
  }
  if (attentionItem.related_object_type !== "SEU" || !attentionItem.related_object_id) return;

  await attemptSeuCommenceWork({
    seuId: attentionItem.related_object_id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id ?? undefined,
  });
}

export const executionEngineKickoffHandler: EventHandler = async (event: EventRow) => {
  if (event.event_type === "SEUActivated") return handleSeuActivated(event);
  if (event.event_type === "ObligationTransitioned") return handleObligationTransitioned(event);
  if (event.event_type === "AttentionItemTransitioned") return handleAttentionItemTransitioned(event);
};
