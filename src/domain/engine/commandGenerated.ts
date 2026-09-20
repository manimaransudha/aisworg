// CommandGenerated consumer — moved out of executionEngine.execute() itself,
// which used to call workItemGenerator.generate() inline, in the same call
// stack as the code that published this event (the platform's no-code-after-
// publish rule). Same orchestrator shape as ebmActivated.ts/
// executionEngineKickoff.ts: a HANDLER_REGISTRY entry that loads the row its
// own event points at, then runs the side effect.
import { commandsDB } from "../../dblayer/commandsDB.js";
import { workItemGenerator } from "./workItemGenerator.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

export const commandGeneratedHandler: EventHandler = async (event: EventRow) => {
  const { data: command } = await commandsDB.findById(event.originating_object_id);
  if (!command) {
    logger.error(`[commandGeneratedHandler] Command not found: ${event.originating_object_id}`);
    return;
  }

  const payload = event.payload as { targetCompletionAt?: string | null } | null;

  await workItemGenerator.generate({
    command,
    seuId: event.seu_id,
    correlationId: event.correlation_id,
    causationEventId: event.id,
    targetCompletionAt: payload?.targetCompletionAt ?? null,
  });
};
