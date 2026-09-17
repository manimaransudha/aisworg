// CR-107 — the Execution Engine's own trigger for the SEU's own
// Activated -> Operational commence-work hop, now trigger: "governed"
// (transition_definitions). One handler, two subscriptions (event_
// subscriptions.json), both calling the same shared `attemptSeuCommenceWork`
// (commissioning.ts) — replaces the old obligationResolvedHandler entirely,
// which only ever had this one SEU branch.
//
// - SEUActivated: the first attempt, the moment finalizeCommissioning
//   publishes the SEU reaching Activated.
// - ObligationTransitioned: a retry, self-filtered the same way
//   obligationResolvedHandler already was — only an Obligation reaching one
//   of RESOLVED_OBLIGATION_STATUSES, carrying a recorded blocked_from_state/
//   blocked_to_state (set only by raiseObligationForBlockedTransition), and
//   related to a SEU, triggers a retry.
//
// Stateless (EE-005): no watch-list of pending SEUs kept anywhere — each
// event carries (or resolves to) the one seu_id it's about, and
// attemptSeuCommenceWork re-checks that SEU's live lifecycle_state itself.
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { attemptSeuCommenceWork } from "../../routes/seu/core/commissioning.js";
import { RESOLVED_OBLIGATION_STATUSES } from "./qualityGateEngine.js";
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
  if (!obligation.blocked_from_state || !obligation.blocked_to_state) return; // not raised from a blocked transition
  if (obligation.related_object_type !== "SEU") return; // not yet wired for other entity types

  await attemptSeuCommenceWork({
    seuId: obligation.related_object_id,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id ?? undefined,
  });
}

export const executionEngineKickoffHandler: EventHandler = async (event: EventRow) => {
  if (event.event_type === "SEUActivated") return handleSeuActivated(event);
  if (event.event_type === "ObligationTransitioned") return handleObligationTransitioned(event);
};
