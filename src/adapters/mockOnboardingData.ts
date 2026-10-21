import type { OnboardingOntology } from "./participantOnboardingAdapter.js";
import { ontologyDB, type OntologyViewer } from "../dblayer/ontologyDB.js";
import { NO_EXPIRY_DATE } from "../dblayer/constants.js";

async function conceptCodes(conceptType: string, viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.findConceptsByType(conceptType, viewer);
  return (data ?? []).map((c) => c.code).filter((code) => !code.startsWith("test-"));
}

// Loads the Ontology value lists an adapter draws from; callers load once per tenant and pass the result into every onboard() call.
export async function loadOnboardingOntology(viewer: OntologyViewer): Promise<OnboardingOntology> {
  const [capabilityCodes, domainValues, technologyValues, proficiencyLevels] = await Promise.all([
    conceptCodes("capability-name", viewer),
    conceptCodes("domain", viewer),
    conceptCodes("technology", viewer),
    conceptCodes("proficiency-level", viewer),
  ]);
  return { capabilityCodes, domainValues, technologyValues, proficiencyLevels };
}

export function mockDefaultAuthorisedRole(): Array<{ role: string; effective_till: string; seu_ids: string[] }> {
  return [{ role: "general", effective_till: NO_EXPIRY_DATE, seu_ids: [] }];
}
