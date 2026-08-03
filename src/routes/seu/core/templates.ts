import { templatesDB } from "../../../dblayer/templatesDB.js";

export interface TemplateCandidate {
  id: string;
  code: string;
  name: string;
  satisfies: boolean;
  missingCapabilities: string[];
}

// Ch.6 §11 — a Template is a candidate only if it supports every Capability
// the Objective requires (its required-Capability set is a superset of the
// requested codes).
export async function findCandidateTemplates(capabilityCodes: string[]): Promise<TemplateCandidate[]> {
  const { data: templates, error } = await templatesDB.findAllActive();
  if (error) throw error;

  const candidates: TemplateCandidate[] = [];
  for (const template of templates ?? []) {
    const { data: required } = await templatesDB.getRequiredCapabilities(template.id);
    const templateCodes = new Set((required ?? []).map((c) => c.code));
    const missingCapabilities = capabilityCodes.filter((code) => !templateCodes.has(code));
    candidates.push({
      id: template.id,
      code: template.code,
      name: template.name,
      satisfies: missingCapabilities.length === 0,
      missingCapabilities,
    });
  }
  return candidates;
}
