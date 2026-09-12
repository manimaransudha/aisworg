// CR-098 — Human Participant onboarding: a LABELLED MOCK. A real tenant
// replaces this under the contract with their own intake (HR system,
// contractor roster, identity provider) — this placeholder exists only so
// the participants_master registry has plausible Human resources to seed
// with, end to end, without a real HR integration.
import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockDomainValues, mockTechnologyValues } from "./mockOnboardingData.js";

export const humanOnboardingAdapter: ParticipantOnboardingAdapter = {
  type: "Human",
  async onboard(request: OnboardParticipantRequest): Promise<OnboardedParticipant> {
    const i = request.seed;
    const viewer = { isRoot: false, tenantId: request.tenantId };
    const [capabilityCodes, domainValues, technologyValues] = await Promise.all([
      mockCapabilityCodes(viewer),
      mockDomainValues(viewer),
      mockTechnologyValues(viewer),
    ]);
    const capability = capabilityCodes[i % capabilityCodes.length];
    return {
      displayName: `${request.tenantLabel} H_${i + 1} (${capability})`,
      capabilities: [capability],
      // CR-099 — dimension keys are category:pack's own codes.
      competency: {
        Domain: [domainValues[i % domainValues.length]],
        Technology: [
          technologyValues[i % technologyValues.length],
          technologyValues[(i + 1) % technologyValues.length],
        ],
      },
      // Owner's own motivating example for Behaviour Context (Ch.13 §14):
      // "some clients have policy that a human participant should have
      // completed a background check to work in their organisation."
      behaviourContext: [{ policy: "background-verification", payload: { status: "completed" } }],
    };
  },
};
