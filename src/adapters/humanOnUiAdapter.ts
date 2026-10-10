import { logger } from "../utils/logger.js";
import type { AssignmentDeliveryResult, AssignmentOut, ParticipantAdapter, ResolvedExecutionTarget } from "./participantAdapter.js";

export const humanOnUiAdapter: ParticipantAdapter = {
  mode: "human-on-ui",
  async deliverAssignment(assignment: AssignmentOut, _target: ResolvedExecutionTarget): Promise<AssignmentDeliveryResult> {
    logger.info(`[humanOnUiAdapter] Work Item ${assignment.workItemId} for Deliverable "${assignment.deliverable.name}" is available on the human-on-UI surface (${assignment.transition.fromState} -> ${assignment.transition.toState}).`);
    return { delivered: true, detail: "available on the human-on-UI surface (tenant-specific placeholder)" };
  },
};
