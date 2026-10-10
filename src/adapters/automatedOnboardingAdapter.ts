import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockTechnologyValues, mockProficiencyLevels, mockDefaultAuthorisedRole } from "./mockOnboardingData.js";

export const automatedOnboardingAdapter: ParticipantOnboardingAdapter = {
  type: "Automated",
  async onboard(request: OnboardParticipantRequest): Promise<OnboardedParticipant> {
    const i = request.seed;
    const viewer = { isRoot: false, tenantId: request.tenantId };
    const [capabilityCodes, technologyValues, proficiencyLevels] = await Promise.all([
      mockCapabilityCodes(viewer),
      mockTechnologyValues(viewer),
      mockProficiencyLevels(viewer),
    ]);
    const capability = capabilityCodes[i % capabilityCodes.length];
    return {
      displayName: `${request.tenantLabel} Auto_${i + 1} (${capability})`,
      capabilities: [capability],
      competency: {
        Technology: [{ code: technologyValues[i % technologyValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
      },
      cost: 5 + (i % 10) * 2,
      behaviourContext: [],
      authorisedRole: mockDefaultAuthorisedRole(),
      userId: null,
    };
  },
};
