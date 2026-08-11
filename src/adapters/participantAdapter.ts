// Participant Integration & Attestation — Plan step 5 (Decision 9, §0.1). The
// one Participant Integration Contract, adapter side. Every execution
// environment — a human team on the platform UI, a LangGraph agent, a bespoke
// orchestrator — sits behind a thin adapter implementing this interface. The
// platform-side flow is identical regardless of which adapter is used; only the
// adapter and its config differ per tenant. The core (engine) never imports a
// concrete adapter — it publishes `WorkItemDispatched`, and the edge
// (assignmentDelivery) resolves and invokes the adapter. Adding a new adapter is
// a new registry entry, never a core edit.
import type { ExecutionMode } from "../dblayer/seuTypes.js";

// Assignment-out (platform → Participant), §2.2. The tenant-invariant shape
// every adapter receives; the adapter translates it into its environment's own
// call. References are opaque, provider-agnostic strings — the core never
// resolves them.
export interface AssignmentOut {
  workItemId: string;
  seuId: string;
  // Step 6: the owning tenant and its VCS binding travel with the assignment,
  // so the edge knows which environment/provider to work against. The binding
  // is opaque to the core.
  tenant: { id: string | null; code: string | null };
  vcsBinding: Record<string, unknown>;
  deliverable: { id: string; name: string };
  transition: { fromState: string; toState: string };
  targetCompletionAt: string | null;
  // Input VCS references to pull, resolved from upstream Deliverables'
  // attestations via the dependency graph (§2.2).
  inputReferences: Array<{ deliverableId: string; deliverableName: string; requiredState: string | null; reference: string | null }>;
}

// The resolved execution target for a Capability — where/how to reach the
// Participant. `adapterEndpoint`/`adapterAuthRef` are edge concerns only the
// concrete adapter interprets.
export interface ResolvedExecutionTarget {
  mode: ExecutionMode;
  adapterEndpoint: string | null;
  adapterAuthRef: string | null;
}

export interface AssignmentDeliveryResult {
  delivered: boolean;
  detail?: string;
}

export interface ParticipantAdapter {
  readonly mode: ExecutionMode | string;
  deliverAssignment(assignment: AssignmentOut, target: ResolvedExecutionTarget): Promise<AssignmentDeliveryResult>;
}
