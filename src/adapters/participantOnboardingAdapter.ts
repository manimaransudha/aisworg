// CR-098 (Ch.13 §8) — Participant Onboarding. Mirrors the existing
// ParticipantAdapter/adapterRegistry.ts seam (src/adapters/participantAdapter.ts)
// but for a different edge: provisioning a participants_master resource
// (the Created step, before any Work Item exists) rather than delivering an
// already-dispatched assignment. Every Participant Type — AI, Human,
// Automated, External — sits behind its own thin adapter implementing this
// interface. For a real client deployment, onboarding integrates with that
// client's actual HR system, AI provisioning platform, CI/CD registry, or
// audit/certification board; only the registered adapter for that type
// changes — cleanSlate.ts/seedParticipantsMaster.ts and
// core/participantsMaster.ts's validated write path never do. Owner: "For
// every client deployment this will change to integrate with their specific
// details."
import type { ParticipantType } from "../dblayer/seuTypes.js";

export interface OnboardParticipantRequest {
  tenantId: string;
  // Display convenience only (e.g. a tenant's own label for mock naming) —
  // a real adapter has no use for it, it names the identity from its own
  // real system.
  tenantLabel: string;
  // A deterministic seed for the 4 mock adapters only (which capability/
  // competency mix this row gets). A real adapter ignores it — it returns
  // whatever its real system reports for the one identity being onboarded.
  seed: number;
}

export interface OnboardedParticipant {
  displayName: string;
  capabilities: string[];
  // Dispatch Strategy input (Ch.33 §7/§9) — proficiency per competency code,
  // Ontology-backed (proficiency-level: Novice/Intermediate/Expert).
  competency: Record<string, Array<{ code: string; proficiency: string }>>;
  // Dispatch Strategy input (Ch.33 §9 Cost Optimisation). Null = no cost
  // recorded for this identity.
  cost: number | null;
  behaviourContext: Array<{ policy: string; payload: Record<string, unknown> }>;
  userId?: number | null;
}

export interface ParticipantOnboardingAdapter {
  readonly type: ParticipantType | string;
  onboard(request: OnboardParticipantRequest): Promise<OnboardedParticipant>;
}
