// SEUOperational consumer — CR-104's own "kickoff of the first Deliverable"
// question. Stateless, same self-filtering discipline as
// executionEngineKickoff.ts's attemptSeuCommenceWork: no separate "is this
// head-of-chain" computation — every Deliverable's own next transition
// (transitionDefinitionsDB.findPossibleNextTransitions, target state read
// off the Transition Definition, not chosen here) is attempted via
// transitionDeliverable, which already re-runs full governance (dependency
// readiness first). A Deliverable not yet ready simply fails that check and
// is skipped — no separate eligibility computation needed here.
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

  // ObligationTransitioned fires on every hop, not just resolution (same
  // event executionEngineKickoff.ts's own SEU-scoped retry reacts to) — only
  // a resolved status is worth a full rescan; an intermediate hop (e.g.
  // Open -> InProgress) resolves nothing yet.
  if (event.event_type === "ObligationTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_OBLIGATION_STATUSES.has(payload.toState)) return;
  }
  // Owner: "Participants transition the attention items and provide evidence
  // etc. There should be AttentionTransition that should be published and
  // the execution engine handler should be the subscriber (same handler as
  // the ObligationTransitioned)" — same blanket rescan, own resolved-status
  // set (Ch.34 §9's Resolved/Closed, not Obligation's Verified/Closed/Archived).
  // No related_object_type filter needed here (unlike executionEngineKickoff's
  // SEU-scoped handler): this rescan is already unconditional per-Deliverable,
  // exactly as it already is for a resolved ObligationTransitioned.
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
