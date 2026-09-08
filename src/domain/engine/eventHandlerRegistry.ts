// Ch.30 Event Bus redesign — the one place a DB row's handler_name string
// (event_subscriptions.handler_name) resolves to a real function. A DB row
// can't hold executable code; this bridges the gap. eventBus.loadSubscriptions()
// reads event_subscriptions at boot and looks up each row's handler_name here.
import { assignmentDeliveryHandler } from "../../adapters/assignmentDelivery.js";
import { validateRequestHandler } from "./validateRequest.js";
import { compositionCompletedHandler } from "./compositionCompleted.js";
import type { EventHandler } from "./eventBus.js";

// design/mvp-build-plan/SEU Composition.md — ebmVersioningHandler/
// seuActivationHandler/createEngineeringAssetsHandler deleted (owner:
// "Subscription to an event and manual trigger of transition definition are
// 2 different things"). They ran EBM Validated->Active, SEU Configured->
// Commissioned->Activated, and Create Engineering Assets/Activated->Operational
// automatically off EBMValidated/EBMActivated/SEUActivated — every one of
// those is a real trigger:"manual" transition_definitions row, which may
// only be caused by a genuine human click. transitionEbm's own Active
// branch (core/commissioning.ts), called from the SEU detail page's
// already-existing "Activate" button, now does all of that synchronously,
// inside that one real request (finalizeCommissioning) — the same shape
// AUTOMATIC_STEPS already used for the rest of this cascade, just no longer
// duplicated by an async subscriber racing the same work.
export const HANDLER_REGISTRY: Record<string, EventHandler> = {
  assignmentDelivery: assignmentDeliveryHandler,
  validateRequest: validateRequestHandler,
  compositionCompleted: compositionCompletedHandler,
};
