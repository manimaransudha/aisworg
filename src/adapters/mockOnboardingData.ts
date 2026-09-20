// CR-098 — mock generation data shared by the 4 built-in onboarding
// adapters ONLY. A real client's onboarding adapter has no use for this —
// it reports whatever its actual HR system / AI registry / CI platform /
// audit board says about the identity it's onboarding.
//
// Reads the real, seeded Ontology vocabulary rather than hardcoding a
// stale copy of it: capability-name (CR-086) and the "domain"/"technology"
// concept types (CR-099, migrations 195/196 — one value per real
// domain-*.pack.json/technology-*.pack.json identity). `viewer` scopes the
// read to Platform's canonical vocabulary plus the onboarding tenant's own
// (same OntologyViewer shape every other Ontology reader uses).
import { ontologyDB, type OntologyViewer } from "../dblayer/ontologyDB.js";

// `test-` codes (migration 119 — "DEV/TEST ONLY, DO NOT RUN IN PRODUCTION")
// are sdk-authoring test-fixture twins, not real onboarding vocabulary.
async function conceptCodes(conceptType: string, viewer: OntologyViewer): Promise<string[]> {
  const { data } = await ontologyDB.findConceptsByType(conceptType, viewer);
  return (data ?? []).map((c) => c.code).filter((code) => !code.startsWith("test-"));
}

export function mockCapabilityCodes(viewer: OntologyViewer): Promise<string[]> {
  return conceptCodes("capability-name", viewer);
}

export function mockDomainValues(viewer: OntologyViewer): Promise<string[]> {
  return conceptCodes("domain", viewer);
}

export function mockTechnologyValues(viewer: OntologyViewer): Promise<string[]> {
  return conceptCodes("technology", viewer);
}

export function mockProficiencyLevels(viewer: OntologyViewer): Promise<string[]> {
  return conceptCodes("proficiency-level", viewer);
}
