import { fulfilRequestedCapability } from "../../routes/seu/core/capabilities.js";
import type { EventHandler } from "./eventBus.js";

export const capabilityRequestedHandler: EventHandler = async (event) => {
  await fulfilRequestedCapability(event);
};
