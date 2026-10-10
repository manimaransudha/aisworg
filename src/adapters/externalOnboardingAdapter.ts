import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockDomainValues, mockProficiencyLevels, mockDefaultAuthorisedRole } from "./mockOnboardingData.js";

export const externalOnboardingAdapter: ParticipantOnboardingAdapter = {
  type: "External",
  async onboard(request: OnboardParticipantRequest): Promise<OnboardedParticipant> {
    const i = request.seed;
    const viewer = { isRoot: false, tenantId: request.tenantId };
    const [capabilityCodes, domainValues, proficiencyLevels] = await Promise.all([
      mockCapabilityCodes(viewer),
      mockDomainValues(viewer),
      mockProficiencyLevels(viewer),
    ]);
    const capability = capabilityCodes[i % capabilityCodes.length];
    return {
      displayName: `${request.tenantLabel} Ext_${i + 1} (${capability})`,
      capabilities: [capability],
      competency: {
        Domain: [{ code: domainValues[i % domainValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
      },
      cost: 600 + (i % 10) * 75,
      behaviourContext: [],
      authorisedRole: mockDefaultAuthorisedRole(),
      userId: null,
    };
  },
};
