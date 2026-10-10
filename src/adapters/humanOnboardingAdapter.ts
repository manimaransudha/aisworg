import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockDomainValues, mockTechnologyValues, mockProficiencyLevels, mockDefaultAuthorisedRole } from "./mockOnboardingData.js";

export const humanOnboardingAdapter: ParticipantOnboardingAdapter = {
  type: "Human",
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
      displayName: `${request.tenantLabel} H_${i + 1} (${capability})`,
      capabilities: [capability],
      competency: {
        Domain: [{ code: domainValues[i % domainValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
        Technology: [
          { code: technologyValues[i % technologyValues.length], proficiency: proficiencyLevels[(i + 1) % proficiencyLevels.length] },
          { code: technologyValues[(i + 1) % technologyValues.length], proficiency: proficiencyLevels[(i + 2) % proficiencyLevels.length] },
        ],
      },
      cost: 400 + (i % 10) * 50,
      behaviourContext:
        i % 10 === 0
          ? [
              { policy: "background-verification", payload: { status: "completed" } },
              { policy: "cr104-demo-background-check", payload: { cleared: true } },
            ]
          : [{ policy: "background-verification", payload: { status: "completed" } }],
      authorisedRole: mockDefaultAuthorisedRole(),
      userId: null,
    };
  },
};
