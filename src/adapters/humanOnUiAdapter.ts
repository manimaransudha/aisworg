// Participant Integration & Attestation — Plan step 5, Resolution 10. The
// human-on-UI adapter: a LABELLED STUB. "Delivering" an assignment to a human
// is a no-op at the wire level — the Work Item is already outstanding and shows
// up on the human-on-UI surface, where a person reports the result back through
// the same result-in callback an orchestrator would use. There is no external
// call to make. Real tenants replace this surface under the contract with their
// own intake (a queue, a ticketing system, a Slack bot); this placeholder
// exists only so the async loop is exercisable end to end without an external
// orchestrator, and it is visibly marked as tenant-specific in the UI.
import { logger } from "../utils/logger.js";
import type { AssignmentDeliveryResult, AssignmentOut, ParticipantAdapter, ResolvedExecutionTarget } from "./participantAdapter.js";

export const humanOnUiAdapter: ParticipantAdapter = {
  mode: "human-on-ui",
  async deliverAssignment(assignment: AssignmentOut, _target: ResolvedExecutionTarget): Promise<AssignmentDeliveryResult> {
    // No external delivery: the assignment is fulfilled through the platform UI.
    logger.info(`[humanOnUiAdapter] Work Item ${assignment.workItemId} for Deliverable "${assignment.deliverable.name}" is available on the human-on-UI surface (${assignment.transition.fromState} -> ${assignment.transition.toState}).`);
    return { delivered: true, detail: "available on the human-on-UI surface (tenant-specific placeholder)" };
  },
};
