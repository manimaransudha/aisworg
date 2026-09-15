// CR-102 — EBMActivated subscriber. transitionEbm (core/commissioning.ts) used
// to publish EBMActivated and then, in the same synchronous call, run the
// entire finalizeCommissioning cascade (PRE_ASSETS_STEPS, Create Engineering
// Assets, SEUOperational) — code after an event publish, which the platform's
// own event-publishing rule forbids. transitionEbm now does no more than
// update the EBM's status and publish; this handler is what actually runs
// finalizeCommissioning, off the bus.
//
// Failure here is not returned to any caller — same shape as
// validateRequestHandler's own CommissionFailed/updateLifecycleState pattern:
// a subscriber reports outcome via SEU state, not a synchronous return.
// transitionEbm must never call finalizeCommissioning directly once this
// handler is registered — the two must not both run it (the exact
// double-invocation bug CR-092's own history already found once, for
// CommissionRequested/validateRequestHandler).
import { seusDB } from "../../dblayer/seusDB.js";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { finalizeCommissioning } from "../../routes/seu/core/commissioning.js";
import { raiseObligationForBlockedTransition } from "../../routes/seu/core/obligations.js";
import { eventBus } from "./eventBus.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

async function failCommissioning(seuId: string, event: EventRow, reason: string): Promise<void> {
  logger.error(`[ebmActivated] finalizeCommissioning failed for SEU ${seuId}: ${reason}`);
  await seusDB.updateLifecycleState(seuId, "Failed");
  await eventBus.publish({
    eventType: "CommissionFailed",
    originatingObjectType: "SEU",
    originatingObjectId: seuId,
    seuId,
    correlationId: event.correlation_id,
    causationId: event.id,
    actorId: event.actor_id,
    payload: { stage: "finalize_commissioning", reason },
  });
}

// CR-106 Option C — a Policy not yet satisfied at the SEU's own
// Activated -> Operational hop is a legitimate, expected gate (a customer
// sign-off pending, an active contract not yet on file), not a broken
// commission. Raises a real Obligation + Attention Item and deliberately
// never touches seus.lifecycle_state — the SEU stays exactly where
// finalizeCommissioning left it (Activated), never advanced to Operational
// and never forced into the hard, terminal Failed state failCommissioning
// uses. Once that Obligation reaches Verified/Closed/Archived,
// obligationResolved (domain/engine/obligationResolved.ts) re-attempts this
// same hop.
//
// Owner correction: no new event type here. Chapter 8's own Subsystem
// Events list (Events and Lifecycles.md) is closed — CommissionRequested/
// Validated/CompositionStarted/CompositionCompleted/RuntimeAllocated/
// KnowledgeInitialised/ParticipantsRecruited/SEUActivated/
// CommissionCompleted/CommissionFailed, nothing else — and once the SEU is
// Activated, Chapter 2's own real transition table names exactly one next
// event, SEUOperational (row 5); nothing "in between" is spec vocabulary.
// A block that doesn't happen (the SEU simply staying Activated) needs no
// event of its own — the real Obligation raised below already is the
// signal, through the platform's existing Obligation mechanism.
async function blockCommissioning(seuId: string, policyCode: string): Promise<void> {
  logger.info(`[ebmActivated] SEU ${seuId} commence-work blocked by policy ${policyCode} — raising Obligation, not failing`);
  await raiseObligationForBlockedTransition({
    seuId, relatedObjectType: "SEU", relatedObjectId: seuId,
    fromState: "Activated", toState: "Operational", policyCode,
  });
}

export const ebmActivatedHandler: EventHandler = async (event: EventRow) => {
  const ebmId = event.originating_object_id;
  const { data: ebm } = await ebmsDB.findById(ebmId);
  if (!ebm) {
    logger.error(`[ebmActivated] EBM not found: ${ebmId}`);
    return;
  }
  const { data: seu } = await seusDB.findById(ebm.seu_id);
  if (!seu) {
    logger.error(`[ebmActivated] owning SEU not found for EBM ${ebmId}`);
    return;
  }
  const { data: template } = await templatesDB.findById(ebm.template_id);
  const { data: profile } = await profilesDB.findById(ebm.profile_id);
  if (!template || !profile) {
    await failCommissioning(seu.id, event, "Template/Profile referenced by this EBM not found");
    return;
  }

  const finalizeResult = await finalizeCommissioning({
    seu,
    ebm,
    templates: [template],
    profiles: [profile],
    tenantId: seu.tenant_id,
    actorRole: "system",
    actorId: event.actor_id ?? undefined,
    correlationId: event.correlation_id,
    causationId: event.id,
  });
  if (!finalizeResult.ok) {
    if (finalizeResult.blockedByPolicyCode) {
      await blockCommissioning(seu.id, finalizeResult.blockedByPolicyCode);
    } else {
      await failCommissioning(seu.id, event, finalizeResult.reason);
    }
  }
};
