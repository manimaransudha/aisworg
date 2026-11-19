import { RESOLVED_ATTENTION_STATUSES } from "./qualityGateEngine.js";
import { resolveObligationsOfAttentionItem } from "../../routes/seu/core/attentionObligations.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

// An Attention Item that is Resolved or Closed resolves the Obligations that hold a Deliverable for it. The effect lands on another entity, the Obligation.
export const attentionObligationResolveHandler: EventHandler = async (event: EventRow) => {
  const payload = event.payload as { toState?: string } | null;
  if (!payload?.toState || !RESOLVED_ATTENTION_STATUSES.has(payload.toState)) return;
  await resolveObligationsOfAttentionItem(event.originating_object_id);
};
