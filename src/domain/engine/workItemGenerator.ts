// Ch.32 minimal instance — one Work Item per Command. Ch.32 §9's "different
// Participants may receive different Work Items for the same Command" needs
// more than one Participant eligible for the same Capability at once, which
// Capability Fulfilment (Ch.12) doesn't support yet — see dispatchEngine.ts.
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { eventBus } from "./eventBus.js";
import type { CommandRow, WorkItemRow } from "../../dblayer/seuTypes.js";

export const workItemGenerator = {
  async generate(input: { command: CommandRow; correlationId: string }): Promise<WorkItemRow> {
    const { data: workItem, error } = await workItemsDB.create({ commandId: input.command.id });
    if (error || !workItem) throw error ?? new Error("failed to generate work item");

    await eventBus.publish({
      eventType: "WorkItemGenerated",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      correlationId: input.correlationId,
      causationId: input.command.id,
      payload: { commandId: input.command.id },
    });

    return workItem;
  },
};
