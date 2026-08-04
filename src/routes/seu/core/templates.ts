import { templatesDB } from "../../../dblayer/templatesDB.js";

export interface TemplateCandidate {
  id: string;
  code: string;
  name: string;
  satisfies: boolean;
  missingCapabilities: string[];
  requiredCapabilityCount: number;
}

// Ch.6 §11 — a Template is a candidate only if it supports every Capability
// the Objective requires (its required-Capability set is a superset of the
// requested codes) — a Template offering more than requested is a valid,
// intentional match, not a mismatch.
//
// Bug fix: with only one Template ever seeded, the first satisfying
// candidate was always the only correct one, so picking .find(c =>
// c.satisfies) off an alphabetically-ordered list never mattered. Once a
// second, legitimately-satisfying Template existed (one requiring more
// Capabilities than asked for), alphabetical order could pick the loosest
// match over the tightest one. The superset filter above is correct and
// unchanged — the fix is choosing among multiple satisfying candidates by
// ascending required-Capability count (tightest fit first), not by code.
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
      requiredCapabilityCount: templateCodes.size,
    });
  }
  return candidates.sort((a, b) => a.requiredCapabilityCount - b.requiredCapabilityCount);
}
