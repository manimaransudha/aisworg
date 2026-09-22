// CR-098 — External Participant onboarding: a LABELLED MOCK. A real tenant
// replaces this under the contract with their own accreditation/registry
// lookup (an auditor roster, a certifying authority's own directory —
// Ch.13 §7's "outside oversight/authority parties").
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
      // An External authority's competency is the domain it's accredited
      // for — no Technology entry (not an engineering role). Dimension key
      // is category:pack's own code (CR-099).
      competency: {
        Domain: [{ code: domainValues[i % domainValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
      },
      // Dispatch Strategy input (Ch.33 §9 Cost Optimisation) — a LABELLED
      // MOCK engagement-fee spread, generally the priciest Participant type.
      cost: 600 + (i % 10) * 75,
      behaviourContext: [],
      authorisedRole: mockDefaultAuthorisedRole(),
    };
  },
};
