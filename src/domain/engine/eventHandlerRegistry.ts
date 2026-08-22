// Ch.30 Event Bus redesign — the one place a DB row's handler_name string
// (event_subscriptions.handler_name) resolves to a real function. A DB row
// can't hold executable code; this bridges the gap. eventBus.loadSubscriptions()
// reads event_subscriptions at boot and looks up each row's handler_name here.
import { assignmentDeliveryHandler } from "../../adapters/assignmentDelivery.js";
import type { EventHandler } from "./eventBus.js";

export const HANDLER_REGISTRY: Record<string, EventHandler> = {
  assignmentDelivery: assignmentDeliveryHandler,
};
