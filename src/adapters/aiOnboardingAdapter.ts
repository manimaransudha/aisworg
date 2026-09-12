// CR-098 — AI Participant onboarding: a LABELLED MOCK. A real tenant
// replaces this under the contract with their own AI provisioning platform
// (which model/provider backs the agent, its tool scope, etc. — Ch.13 §7
// notes implementation technology is outside this platform's own scope).
import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockDomainValues, mockTechnologyValues } from "./mockOnboardingData.js";

export const aiOnboardingAdapter: ParticipantOnboardingAdapter = {
  type: "AI",
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
      displayName: `${request.tenantLabel} AI_ ${i + 1} (${capability})`,
      capabilities: [capability],
      // An AI's competency is its declared/tuned operating scope, not an
      // earned skill — same shape as Human's, different meaning (CR-098).
      // Dimension keys are category:pack's own codes (CR-099).
      competency: {
        Domain: [domainValues[i % domainValues.length]],
        Technology: [
          technologyValues[i % technologyValues.length],
          technologyValues[(i + 1) % technologyValues.length],
        ],
      },
      // Nothing in the mock Behaviour Context vocabulary (background-
      // verification, qualitygate) applies to an AI Participant yet.
      behaviourContext: [],
    };
  },
};
