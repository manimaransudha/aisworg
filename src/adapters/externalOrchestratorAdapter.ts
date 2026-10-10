import { logger } from "../utils/logger.js";
import type { AssignmentDeliveryResult, AssignmentOut, ParticipantAdapter, ResolvedExecutionTarget } from "./participantAdapter.js";

export const externalOrchestratorAdapter: ParticipantAdapter = {
  mode: "external-orchestrator",
  async deliverAssignment(assignment: AssignmentOut, target: ResolvedExecutionTarget): Promise<AssignmentDeliveryResult> {
    if (!target.adapterEndpoint) {
      logger.error(`[externalOrchestratorAdapter] no adapter_endpoint configured for Work Item ${assignment.workItemId}; cannot deliver`);
      return { delivered: false, detail: "no adapter_endpoint configured" };
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (target.adapterAuthRef) headers["Authorization"] = `Bearer ${target.adapterAuthRef}`;

      const res = await fetch(target.adapterEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(assignment),
      });
      if (!res.ok) {
        logger.error(`[externalOrchestratorAdapter] delivery to ${target.adapterEndpoint} for Work Item ${assignment.workItemId} returned ${res.status}`);
        return { delivered: false, detail: `orchestrator returned HTTP ${res.status}` };
      }
      logger.info(`[externalOrchestratorAdapter] delivered Work Item ${assignment.workItemId} to ${target.adapterEndpoint}`);
      return { delivered: true };
    } catch (err) {
      logger.error(`[externalOrchestratorAdapter] delivery to ${target.adapterEndpoint} for Work Item ${assignment.workItemId} failed`, err as Error);
      return { delivered: false, detail: (err as Error).message };
    }
  },
};
