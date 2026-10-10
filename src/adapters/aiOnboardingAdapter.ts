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
      competency: {
        Domain: [{ code: domainValues[i % domainValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
        Technology: [
          { code: technologyValues[i % technologyValues.length], proficiency: proficiencyLevels[(i + 1) % proficiencyLevels.length] },
          { code: technologyValues[(i + 1) % technologyValues.length], proficiency: proficiencyLevels[(i + 2) % proficiencyLevels.length] },
        ],
      },
      cost: 20 + (i % 10) * 5,
      behaviourContext: [],
      authorisedRole: mockDefaultAuthorisedRole(),
      userId: null,
    };
  },
};
