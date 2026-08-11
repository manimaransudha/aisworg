// Participant Integration & Attestation — Plan step 5 (Decision 9). The
// reference external-orchestrator adapter: it delivers the assignment to a
// tenant's orchestrator by POSTing the tenant-invariant AssignmentOut to the
// configured endpoint. This is a thin, best-effort delivery — the Work Item is
// already dispatched-and-outstanding, so a delivery failure does not fail the
// dispatch; it is reported (and the stall sweep is the backstop if the
// orchestrator never acts). The outbound auth is an opaque reference the edge
// resolves; a real tenant adapter would sign/authenticate here. The orchestrator
// later reports its result to the same result-in callback every adapter uses.
//
// This adapter is deliberately swappable: a LangGraph adapter, a gRPC adapter,
// a message-queue adapter would each replace only this file + a registry entry,
// with zero core change (§0.1).
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
      // Opaque outbound credential — a real adapter signs/authenticates as the
      // tenant requires; the core never sees or interprets it.
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
