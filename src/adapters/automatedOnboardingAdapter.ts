// CR-098 — Automated Participant onboarding: a LABELLED MOCK. A real tenant
// replaces this under the contract with their own registration flow for
// internal deterministic systems (a CI/CD pipeline, a static analysis
// platform, a security scanner, a cloud deployment service — Ch.13 §7).
import type { OnboardParticipantRequest, OnboardedParticipant, ParticipantOnboardingAdapter } from "./participantOnboardingAdapter.js";
import { mockCapabilityCodes, mockTechnologyValues, mockProficiencyLevels } from "./mockOnboardingData.js";

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
      // An Automated integration's competency is the tech stack it actually
      // supports, not domain expertise — no `Domain` entry. Dimension key
      // is category:pack's own code (CR-099).
      competency: {
        Technology: [{ code: technologyValues[i % technologyValues.length], proficiency: proficiencyLevels[i % proficiencyLevels.length] }],
      },
      // Dispatch Strategy input (Ch.33 §9 Cost Optimisation) — a LABELLED
      // MOCK compute-cost spread, generally the cheapest Participant type.
      cost: 5 + (i % 10) * 2,
      behaviourContext: [],
    };
  },
};
