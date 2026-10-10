import { ontologyDB, type OntologyViewer } from "../dblayer/ontologyDB.js";

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

export function mockDefaultAuthorisedRole(): Array<{ role: string; effective_till: string; seu_ids: string[] }> {
  return [{ role: "general", effective_till: "9999-12-31", seu_ids: [] }];
}
