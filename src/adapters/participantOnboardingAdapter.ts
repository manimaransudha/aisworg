import type { ParticipantType } from "../dblayer/seuTypes.js";

export interface OnboardParticipantRequest {
  tenantId: string;
  tenantLabel: string;
  seed: number;
}

export interface OnboardedParticipant {
  displayName: string;
  capabilities: string[];
  competency: Record<string, Array<{ code: string; proficiency: string }>>;
  cost: number | null;
  behaviourContext: Array<{ policy: string; payload: Record<string, unknown> }>;
  authorisedRole: Array<{ role: string; effective_till: string; seu_ids: string[] }>;
  userId: string | null;
}

export interface ParticipantOnboardingAdapter {
  readonly type: ParticipantType | string;
  onboard(request: OnboardParticipantRequest): Promise<OnboardedParticipant>;
}
