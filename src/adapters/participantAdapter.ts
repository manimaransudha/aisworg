import type { ExecutionMode, WorkItemExecutionContext } from "../dblayer/seuTypes.js";

export interface AssignmentOut {
  workItemId: string;
  // The Participant dispatch selected for the Work Item.
  participantId: string;
  seuId: string;
  tenant: { id: string | null; code: string | null };
  vcsBinding: Record<string, unknown>;
  deliverable: { id: string; name: string };
  transition: { fromState: string; toState: string };
  targetCompletionAt: string | null;
  inputReferences: Array<{ deliverableId: string; deliverableName: string; requiredState: string | null; reference: string | null }>;
  // What the EBM gives the Work Item: the objective, the checklists, the Engineering Capital (including the AI skills), the Profile configuration and the rest.
  executionContext: WorkItemExecutionContext | null;
}

export interface ResolvedExecutionTarget {
  mode: ExecutionMode | string;
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
