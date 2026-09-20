// Ch.30 Event Bus redesign — the one place a DB row's handler_name string
// (event_subscriptions.handler_name) resolves to a real function. A DB row
// can't hold executable code; this bridges the gap. eventBus.loadSubscriptions()
// reads event_subscriptions at boot and looks up each row's handler_name here.
import { assignmentDeliveryHandler } from "../../adapters/assignmentDelivery.js";
import { validateRequestHandler } from "./validateRequest.js";
import { compositionCompletedHandler } from "./compositionCompleted.js";
import { ebmActivatedHandler } from "./ebmActivated.js";
import { executionEngineKickoffHandler } from "./executionEngineKickoff.js";
import { commandGeneratedHandler } from "./commandGenerated.js";
import { workItemGeneratedHandler } from "./workItemGenerated.js";
import { deliverableKickoffHandler } from "./deliverableKickoff.js";
import { redispatchRequestHandler } from "./redispatchRequest.js";
import { redispatchHandler } from "./redispatch.js";
import type { EventHandler } from "./eventBus.js";

// design/mvp-build-plan/SEU Composition.md — ebmVersioningHandler/
// seuActivationHandler/createEngineeringAssetsHandler deleted (owner:
// "Subscription to an event and manual trigger of transition definition are
// 2 different things"), and transitionEbm's own Active branch ran
// finalizeCommissioning inline instead, synchronously, inside the human's
// own "Activate" request.
//
// CR-102 — reversed for EBMActivated specifically: that inline call left
// code running after the EBMActivated publish (the platform's own
// event-publishing rule forbids it), and the original deletion's fuller
// reasoning was never written down beyond this comment's own paraphrase —
// the one concrete documented failure mode from that era was commissionSeu
// running Validate Request's logic inline AND a subscriber also running it
// off the same event, racing. ebmActivatedHandler is the one place
// finalizeCommissioning now runs for the Active hop; transitionEbm must
// never call it directly again, or that exact duplication bug returns.
// Failure is reported via seus.lifecycle_state = "Failed" + CommissionFailed,
// not a caller return — same shape validateRequestHandler already uses for
// CommissionRequested's own failure path.
export const HANDLER_REGISTRY: Record<string, EventHandler> = {
  assignmentDelivery: assignmentDeliveryHandler,
  validateRequest: validateRequestHandler,
  compositionCompleted: compositionCompletedHandler,
  ebmActivated: ebmActivatedHandler,
  executionEngineKickoff: executionEngineKickoffHandler,
  commandGenerated: commandGeneratedHandler,
  workItemGenerated: workItemGeneratedHandler,
  deliverableKickoff: deliverableKickoffHandler,
  redispatchRequest: redispatchRequestHandler,
  redispatch: redispatchHandler,
};
