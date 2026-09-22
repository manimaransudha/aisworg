// CR-098 — AI Participant onboarding: a LABELLED MOCK. A real tenant
// replaces this under the contract with their own AI provisioning platform
// (which model/provider backs the agent, its tool scope, etc. — Ch.13 §7
// notes implementation technology is outside this platform's own scope).
import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockDomainValues, mockTechnologyValues, mockProficiencyLevels, mockDefaultAuthorisedRole } from "./mockOnboardingData.js";

export const aiOnboardingAdapter: ParticipantOnboardingAdapter = {
  type: "AI",
  async onboard(request: OnboardParticipantRequest): Promise<OnboardedParticipant> {
    const i = request.seed;
    const viewer = { isRoot: false, tenantId: request.tenantId };
    const [capabilityCodes, domainValues, technologyValues, proficiencyLevels] = await Promise.all([
      mockCapabilityCodes(viewer),
      mockDomainValues(viewer),
      mockTechnologyValues(viewer),
      mockProficiencyLevels(viewer),
    ]);
    const capability = capabilityCodes[i % capabilityCodes.length];
    return {
      displayName: `${request.tenantLabel} AI_ ${i + 1} (${capability})`,
      capabilities: [capability],
      // An AI's competency is its declared/tuned operating scope, not an
      // earned skill — same shape as Human's, different meaning (CR-098).
      // Dimension keys are category:pack's own codes (CR-099).
      competency: {
        Domain: [{ code: domainValues[i % domainValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
        Technology: [
          { code: technologyValues[i % technologyValues.length], proficiency: proficiencyLevels[(i + 1) % proficiencyLevels.length] },
          { code: technologyValues[(i + 1) % technologyValues.length], proficiency: proficiencyLevels[(i + 2) % proficiencyLevels.length] },
        ],
      },
      // Dispatch Strategy input (Ch.33 §9 Cost Optimisation) — a LABELLED
      // MOCK per-run/token-style rate spread, generally cheaper than Human.
      cost: 20 + (i % 10) * 5,
      // Nothing in the mock Behaviour Context vocabulary (background-
      // verification, qualitygate) applies to an AI Participant yet.
      behaviourContext: [],
      authorisedRole: mockDefaultAuthorisedRole(),
    };
  },
};
