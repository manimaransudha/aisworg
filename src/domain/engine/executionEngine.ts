// Ch.31 minimal instance. Governance (dependencyEngine + transitionEngine) is
// evaluated by the caller before this runs — Ch.31's own Execution Cycle
// (§9) runs "Evaluate Governance" before "Generate Commands", and FR-31.5
// says Commands are generated only once prerequisites are satisfied. This
// module owns everything from Command generation onward: Command -> Work Item
// Generator -> Dispatch Engine, matching Ch.31 §12's "Execution Engine shall
// not duplicate dependency logic" and its collaboration with Capability
// Fulfilment through the Dispatch Engine (Ch.33).
import { commandsDB } from "../../dblayer/commandsDB.js";
import { eventBus } from "./eventBus.js";
import { workItemGenerator } from "./workItemGenerator.js";
import { dispatchEngine } from "./dispatchEngine.js";
import type { CommandRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

export interface ExecutionResult {
  command: CommandRow;
  dispatched: boolean;
  participantId?: string;
  workItemId: string;
  deferredReason?: "no_eligible_participant";
}

export const executionEngine = {
  async execute(input: {
    seuId: string;
    entityType: TransitionEntityType;
    entityId: string;
    fromState: string;
    toState: string;
    producingCapabilityId: string | null;
    requestedBy: number | null;
    actingBadgeGrantId?: string | null;
    correlationId: string;
  }): Promise<ExecutionResult> {
    const { data: command, error } = await commandsDB.create({
      seuId: input.seuId,
      entityType: input.entityType,
      entityId: input.entityId,
      commandType: `${input.entityType}.Transition`,
      fromState: input.fromState,
      toState: input.toState,
      requestedBy: input.requestedBy,
      actingBadgeGrantId: input.actingBadgeGrantId ?? null,
      correlationId: input.correlationId,
    });
    if (error || !command) throw error ?? new Error("failed to generate command");

    await eventBus.publish({
      eventType: "CommandGenerated",
      originatingObjectType: "Command",
      originatingObjectId: command.id,
      correlationId: input.correlationId,
      payload: { entityType: input.entityType, entityId: input.entityId, fromState: input.fromState, toState: input.toState },
    });

    const workItem = await workItemGenerator.generate({ command, correlationId: input.correlationId });

    const dispatch = await dispatchEngine.dispatch({
      workItem,
      seuId: input.seuId,
      producingCapabilityId: input.producingCapabilityId,
      correlationId: input.correlationId,
    });

    if (!dispatch.dispatched) {
      const { data: deferred } = await commandsDB.updateStatus(command.id, "Deferred");
      return { command: deferred ?? command, dispatched: false, workItemId: workItem.id, deferredReason: dispatch.deferredReason as "no_eligible_participant" };
    }

    // Participant Integration — Plan step 1 (Model A): the Command is now
    // Dispatched-and-outstanding, not Completed. It reaches Completed only
    // when the Work Item's result callback lands (completeWorkItem), which is
    // also where the governed Deliverable transition is applied.
    const { data: dispatched } = await commandsDB.updateStatus(command.id, "Dispatched");
    return { command: dispatched ?? command, dispatched: true, participantId: dispatch.participantId, workItemId: workItem.id };
  },
};
