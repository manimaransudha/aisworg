// CR-106 Option C, step 3 — the resolution-triggered retry. Subscribes to
// ObligationTransitioned (published for every Obligation hop, not just
// terminal ones — see this event's own eventSubscriptions.json entry) and
// self-filters: only an Obligation reaching one of RESOLVED_OBLIGATION_STATUSES
// (the exact same "resolved enough" set no_unresolved_obligations already
// uses, qualityGateEngine.ts) AND carrying a recorded blocked_from_state/
// blocked_to_state (set only by raiseObligationForBlockedTransition — every
// other Obligation origin, Telemetry/Knowledge-promotion/manual, has neither
// and is ignored here) triggers a retry.
//
// A real, cross-entity-type effect (Obligation's own transition causing a
// DIFFERENT entity — SEU, Deliverable, ... — to re-attempt one of its own
// transitions), so this is a genuine subscriber per the platform's own rule,
// not something transition_definitions itself could express.
//
// Scope, deliberately: only the one entity type Option C's own concrete,
// reproduced case needs (SEU's commence-work hop, retrySeuCommenceWork in
// commissioning.ts). Extending this to Deliverable (or any other entity
// type whose Policy block now also raises an Obligation, deliverables.ts)
// means adding another branch below, calling into that entity's own retry
// path the same way — not a redesign of this handler.
//
// Whether a retry actually then passes depends on the blocking Policy's own
// governingCondition reflecting the real resolved state — policyEngine's
// context is still whatever the call site passes (commonly {}), and
// Policy's evaluateCondition has no DB lookup of its own (CR-104's own
// finding, still open). This handler only guarantees the re-attempt
// happens automatically; it does not itself make a thin, context-only
// Policy condition become satisfiable. A still-blocked retry raises a
// fresh Obligation/Attention Item (raiseObligationForBlockedTransition is
// idempotent against an open one, but the one that just resolved is no
// longer open, so a genuinely still-blocked transition correctly gets a
// new one) — sitting there as visible, expected behaviour, not a bug.
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { retrySeuCommenceWork } from "../../routes/seu/core/commissioning.js";
import { raiseObligationForBlockedTransition } from "../../routes/seu/core/obligations.js";
import { RESOLVED_OBLIGATION_STATUSES } from "./qualityGateEngine.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

export const obligationResolvedHandler: EventHandler = async (event: EventRow) => {
  const payload = event.payload as { fromState?: string; toState?: string };
  const toState = payload.toState;
  if (!toState || !RESOLVED_OBLIGATION_STATUSES.has(toState)) return;

  const { data: obligation } = await obligationsDB.findById(event.originating_object_id);
  if (!obligation) {
    logger.error(`[obligationResolved] Obligation not found: ${event.originating_object_id}`);
    return;
  }
  if (!obligation.blocked_from_state || !obligation.blocked_to_state) return; // not raised from a blocked transition

  if (obligation.related_object_type === "SEU") {
    const result = await retrySeuCommenceWork({
      seuId: obligation.related_object_id,
      correlationId: event.correlation_id,
      causationId: event.id,
      actorId: event.actor_id ?? undefined,
    });
    if (!result.ok && result.blockedByPolicyCode) {
      logger.info(`[obligationResolved] SEU ${obligation.related_object_id} retry still blocked by policy ${result.blockedByPolicyCode}`);
      await raiseObligationForBlockedTransition({
        seuId: obligation.related_object_id, relatedObjectType: "SEU", relatedObjectId: obligation.related_object_id,
        fromState: obligation.blocked_from_state, toState: obligation.blocked_to_state, policyCode: result.blockedByPolicyCode,
      });
    } else if (!result.ok) {
      logger.error(`[obligationResolved] SEU ${obligation.related_object_id} retry failed: ${result.reason}`);
    }
    return;
  }

  // Not yet wired for this entity type — see this file's own header comment.
  logger.info(`[obligationResolved] no retry path wired for entity type ${obligation.related_object_type} (Obligation ${obligation.id})`);
};
