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
import { conceptCreatedHandler } from "./conceptCreated.js";
import type { EventHandler } from "./eventBus.js";

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
  conceptCreated: conceptCreatedHandler,
};
