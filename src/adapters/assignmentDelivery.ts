// Participant Integration & Attestation — Plan step 5 (§0.1 seam). The
// assignment-out edge. The core (engine) never calls an adapter directly; it
// publishes `WorkItemDispatched`, and this edge subscriber picks it up,
// assembles the tenant-invariant AssignmentOut, resolves the Capability's
// execution target, and delivers via the resolved adapter. Because the coupling
// is an event the core already emits, adding/replacing an adapter or a delivery
// mechanism never touches the core — the forbidden import direction (core ->
// edge) simply does not exist here.
import { workItemsDB } from "../dblayer/workItemsDB.js";
import { commandsDB } from "../dblayer/commandsDB.js";
import { deliverablesDB } from "../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../dblayer/dependencyEdgesDB.js";
import { deliverableReferencesDB } from "../dblayer/deliverableReferencesDB.js";
import { seusDB } from "../dblayer/seusDB.js";
import { tenantsDB } from "../dblayer/tenantsDB.js";
import { tenantContractsDB } from "../dblayer/tenantContractsDB.js";
import { eventBus } from "../domain/engine/eventBus.js";
import { logger } from "../utils/logger.js";
import { resolveExecutionTarget } from "./executionTargetResolver.js";
import { resolveAdapter } from "./adapterRegistry.js";
import type { AssignmentOut } from "./participantAdapter.js";
import type { CommandRow, DeliverableRow, WorkItemRow } from "../dblayer/seuTypes.js";

// §2.2 assignment-out: pull the input references the Participant needs from the
// upstream Deliverables this one depends on — resolved from their recorded
// references (which, at an accepted state, are attestation-backed) via the
// dependency graph.
async function resolveInputReferences(deliverable: DeliverableRow): Promise<AssignmentOut["inputReferences"]> {
  const { data: edges } = await dependencyEdgesDB.findByFromDeliverable(deliverable.id);
  const inputs: AssignmentOut["inputReferences"] = [];
  for (const edge of edges ?? []) {
    if (edge.dependency_type !== "Deliverable" || !edge.to_deliverable_id) continue;
    const { data: upstream } = await deliverablesDB.findById(edge.to_deliverable_id);
    const { data: ref } = await deliverableReferencesDB.findLatestWithReference(edge.to_deliverable_id, edge.required_state ?? "Approved");
    inputs.push({
      deliverableId: edge.to_deliverable_id,
      deliverableName: upstream?.name ?? "(unknown Deliverable)",
      requiredState: edge.required_state,
      reference: ref?.reference ?? null,
    });
  }
  return inputs;
}

async function assembleAssignment(
  workItem: WorkItemRow,
  command: CommandRow,
  deliverable: DeliverableRow,
  tenant: { id: string | null; code: string | null },
  vcsBinding: Record<string, unknown>
): Promise<AssignmentOut> {
  return {
    workItemId: workItem.id,
    seuId: command.seu_id,
    tenant,
    vcsBinding,
    deliverable: { id: deliverable.id, name: deliverable.name },
    transition: { fromState: command.from_state, toState: command.to_state },
    targetCompletionAt: workItem.target_completion_at,
    inputReferences: await resolveInputReferences(deliverable),
  };
}

export async function deliverAssignmentForWorkItem(workItemId: string): Promise<void> {
  const { data: workItem } = await workItemsDB.findById(workItemId);
  if (!workItem) return;
  const { data: command } = await commandsDB.findById(workItem.command_id);
  if (!command || command.entity_type !== "Deliverable") return;
  const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
  if (!deliverable) return;

  // Step 6: resolve the SEU's owning tenant and its edge config; the execution
  // target and VCS binding are per-tenant, so the same Capability can be reached
  // differently for different tenants.
  const { data: seu } = await seusDB.findById(command.seu_id);
  const tenantId = seu?.tenant_id ?? null;
  const { data: tenantRow } = tenantId ? await tenantsDB.findById(tenantId) : { data: null };
  const { data: contract } = tenantId ? await tenantContractsDB.findByTenantId(tenantId) : { data: null };

  const target = await resolveExecutionTarget(tenantId, deliverable.producing_capability_id);
  const adapter = resolveAdapter(target.mode);
  const assignment = await assembleAssignment(
    workItem,
    command,
    deliverable,
    { id: tenantId, code: tenantRow?.code ?? null },
    contract?.vcs_binding ?? {}
  );
  const result = await adapter.deliverAssignment(assignment, target);
  if (!result.delivered) {
    logger.error(`[assignmentDelivery] adapter '${target.mode}' did not deliver Work Item ${workItemId}: ${result.detail ?? "unknown"}`);
  }
}

let registered = false;

// Wire the edge subscriber once, at app boot. Idempotent so repeated imports /
// boots do not stack handlers.
export function registerAssignmentDelivery(): void {
  if (registered) return;
  registered = true;
  eventBus.subscribe(async (event) => {
    if (event.event_type !== "WorkItemDispatched") return;
    try {
      await deliverAssignmentForWorkItem(event.originating_object_id);
    } catch (err) {
      logger.error(`[assignmentDelivery] failed delivering Work Item ${event.originating_object_id}`, err as Error);
    }
  });
}
