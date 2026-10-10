import type { ExecutionMode } from "../dblayer/seuTypes.js";

export interface AssignmentOut {
  workItemId: string;
  seuId: string;
  tenant: { id: string | null; code: string | null };
  vcsBinding: Record<string, unknown>;
  deliverable: { id: string; name: string };
  transition: { fromState: string; toState: string };
  targetCompletionAt: string | null;
  inputReferences: Array<{ deliverableId: string; deliverableName: string; requiredState: string | null; reference: string | null }>;
}

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
