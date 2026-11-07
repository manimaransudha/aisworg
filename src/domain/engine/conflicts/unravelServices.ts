import { resolveEffectiveParameters } from "../../../routes/seu/core/profiles.js";
import { catalogueFor, resolveDeliverableSource } from "../deliverableSource.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import type { ProfileRow, TemplateRow } from "../../../dblayer/seuTypes.js";

// A Service that makes a catalogue Deliverable, with the levels its Service Definition gives by default.
export interface ServiceCandidate {
  code: string;
  name: string;
  // Level code to target, from the Service Definition.
  defaultLevels: Record<string, number>;
}

// A service level that the Template sets or the Profile overrides.
export interface ServiceLevelSetting {
  value: number;
  setBy: "template" | "profile";
  sourceId: string;
  sourceLabel: string;
}

// What the Services table needs from the Templates, Profiles and Service Definitions. It decides nothing.
export interface ServicesUnraveled {
  // The codes of the Deliverable Catalogue: the Profile's own when it has one, otherwise the Template's.
  deliverableCodes: string[];
  // For each catalogue Deliverable, the Active Services that make it.
  candidates: Record<string, ServiceCandidate[]>;
  // For each Service, the level values the Template sets and the Profile overrides, keyed by level code.
  levelSettings: Record<string, Record<string, ServiceLevelSetting>>;
  // The name of each catalogue Deliverable, from its Active Deliverable Definition.
  deliverableNames: Record<string, string>;
}

// Gathers the facts of the Services table. The Service Definition's default levels come with each candidate, the Template's and Profile's values come separately.
export async function unravelServices(input: { templates: TemplateRow[]; profiles: ProfileRow[] }, viewerTenantId: string): Promise<ServicesUnraveled> {
  const deliverableCodes = new Set<string>();
  const levelSettings: Record<string, Record<string, ServiceLevelSetting>> = {};

  for (const profile of input.profiles) {
    const template = input.templates.find((t) => t.id === profile.base_template_id);
    if (!template) continue;
    const source = await resolveDeliverableSource(template, profile);
    for (const entry of catalogueFor(template, profile, source)) deliverableCodes.add(entry.code);

    for (const parameter of await resolveEffectiveParameters(profile)) {
      if (parameter.sourceType !== "service") continue;
      const value = Number(parameter.effectiveValue);
      if (!Number.isFinite(value)) continue;
      const setBy = parameter.overriddenByProfile ? "profile" : "template";
      const origin = setBy === "profile" ? profile : template;
      (levelSettings[parameter.sourceCode] ??= {})[parameter.parameterName] = { value, setBy, sourceId: origin.id, sourceLabel: origin.name };
    }
  }

  const candidates: Record<string, ServiceCandidate[]> = {};
  if (deliverableCodes.size > 0) {
    const { data: rows } = await serviceDefinitionsDB.findActiveByOutputsVisibleTo([...deliverableCodes], viewerTenantId);
    for (const row of rows ?? []) {
      const candidate: ServiceCandidate = { code: row.code, name: row.name, defaultLevels: Object.fromEntries((row.service_level ?? []).map((l) => [l.code, l.target])) };
      for (const output of row.outputs ?? []) if (deliverableCodes.has(output)) (candidates[output] ??= []).push(candidate);
    }
  }

  const { data: definitions } = deliverableCodes.size > 0 ? await deliverableDefinitionsDB.findActiveByCodesVisibleTo([...deliverableCodes], viewerTenantId) : { data: [] };
  const deliverableNames = Object.fromEntries((definitions ?? []).map((d) => [d.code, d.name]));

  return { deliverableCodes: [...deliverableCodes].sort(), candidates, levelSettings, deliverableNames };
}
