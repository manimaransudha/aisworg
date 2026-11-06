import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { packsDB } from "../../dblayer/packsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { getProfilePackCodes, resolveEffectiveParameters, extractExposedParameterOverrides } from "../../routes/seu/core/profiles.js";
import { deriveOverridableParameterCandidates, getDependencyGraphContent } from "../../routes/seu/core/templates.js";
import { catalogueFor, profileOwnCatalogue, resolveDeliverableSource } from "./deliverableSource.js";
import { serviceDefinitionsDB } from "../../dblayer/serviceDefinitionsDB.js";
import type { PackRow, ProfileRow, TemplateRow, EbmComposedPack, EbmDeliverableSource } from "../../dblayer/seuTypes.js";

export type PoolSourceKind = "profile" | "template" | "pack";

export interface PoolSource {
  kind: PoolSourceKind;
  id: string;
  code: string;
  label: string;
}

export interface PoolEntry {
  propertyName: string;
  value: unknown;
  source: PoolSource;
  // The catalogue Deliverables that bring a Capability into the pool. Kept outside value so conflict detection does not compare it.
  deliverableCodes?: string[];
}

export interface UnraveledComposition {
  pool: PoolEntry[];
  composedPacks: EbmComposedPack[];
  warnings: string[];
  competencyRequirements: Record<string, string[]>;
  deliverableSource?: EbmDeliverableSource;
}

export interface CompositionConflictOption {
  source: PoolSource;
  value: unknown;
}

export interface CompositionConflict {
  propertyName: string;
  options: CompositionConflictOption[];
  hasAction: boolean;
}

function toPoolSource(kind: PoolSourceKind, id: string, code: string, label: string): PoolSource {
  return { kind, id, code, label };
}

const CONFIGURATION_PARAMETER_COMPETENCY_UNIONS: Array<{ profileField: "primaryProgrammingLanguage" | "domain"; dimension: string }> = [
  { profileField: "primaryProgrammingLanguage", dimension: "Technology" },
  { profileField: "domain", dimension: "Domain" },
];

function computeCompetencyRequirements(profiles: ProfileRow[], composedPacks: Map<string, PackRow>): Record<string, string[]> {
  const values: Record<string, Set<string>> = {};
  const add = (dimension: string, value: string) => {
    (values[dimension] ??= new Set<string>()).add(value);
  };

  for (const { profileField, dimension } of CONFIGURATION_PARAMETER_COMPETENCY_UNIONS) {
    for (const profile of profiles) {
      const draft = (profile.draft_content ?? {}) as Record<string, unknown>;
      const v = draft[profileField];
      if (typeof v === "string" && v) add(dimension, v);
    }
  }
  for (const pack of composedPacks.values()) {
    for (const c of pack.contributions?.competencies ?? []) {
      if (c.dimension && c.value) add(c.dimension, c.value);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [dimension, set] of Object.entries(values)) result[dimension] = [...set];
  return result;
}

// Walks the Pack dependency closure one level at a time, resolving each level's Active Packs in a single query.
async function resolveComposedPacksTransitively(rootCodes: string[], viewerTenantId: string): Promise<{ resolved: Map<string, PackRow>; warnings: string[] }> {
  const resolved = new Map<string, PackRow>();
  const warnings: string[] = [];
  const rootSet = new Set(rootCodes);
  const visited = new Set<string>();
  let level = [...new Set(rootCodes)];
  while (level.length) {
    level.forEach((code) => visited.add(code));
    // const { data } = await packsDB.findActiveByCodes(level);
    const { data } = await packsDB.findActiveByCodesVisibleTo(level, viewerTenantId);
    const activeByCode = new Map((data ?? []).map((pack) => [pack.code, pack]));
    const next: string[] = [];
    for (const code of level) {
      const pack = activeByCode.get(code);
      if (!pack) {
        if (rootSet.has(code)) warnings.push(`Pack "${code}" has no Active version — skipped.`);
        continue;
      }
      resolved.set(pack.code, pack);
      for (const dep of pack.dependencies ?? []) {
        if (!visited.has(dep.packCode) && !next.includes(dep.packCode)) next.push(dep.packCode);
      }
    }
    level = next;
  }
  return { resolved, warnings };
}

export async function unravelComposition(input: { templateIds: string[]; profileIds: string[] }, viewerTenantId: string): Promise<UnraveledComposition> {
  const pool: PoolEntry[] = [];

  const templates: TemplateRow[] = [];
  const rootPackCodes: string[] = [];
  for (const templateId of input.templateIds) {
    const { data: template } = await templatesDB.findById(templateId);
    if (!template) continue;
    templates.push(template);
    const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(template.id);
    rootPackCodes.push(...(mandatoryCodes ?? []));
    const { data: platformMandatoryPacks } = await packsDB.findActiveMandatoryVisibleTo(template.tenant_id);
    rootPackCodes.push(...(platformMandatoryPacks ?? []).map((p) => p.code));
  }

  const profiles: ProfileRow[] = [];
  for (const profileId of input.profileIds) {
    const { data: profile } = await profilesDB.findById(profileId);
    if (!profile) continue;
    profiles.push(profile);
    rootPackCodes.push(...(await getProfilePackCodes(profile.id)));
  }

  const directlySelectedPackCodes = new Set(rootPackCodes);
  const { resolved: composedPacks, warnings } = await resolveComposedPacksTransitively(rootPackCodes, viewerTenantId);

  for (const profile of profiles) {
    const profileSource = toPoolSource("profile", profile.id, profile.code, profile.name);
    const draft = (profile.draft_content ?? {}) as Record<string, unknown>;
    const simpleFields: Record<string, unknown> = {
      environment: profile.environment,
      developmentMethodology: draft.developmentMethodology,
      primaryProgrammingLanguage: draft.primaryProgrammingLanguage,
      sourceControlProvider: draft.sourceControlProvider,
      targetCloudProvider: draft.targetCloudProvider,
      deploymentStrategy: draft.deploymentStrategy,
      aiProviderPreference: draft.aiProviderPreference,
      defaultRepositoryStructure: draft.defaultRepositoryStructure,
      documentationLevel: draft.documentationLevel,
      domain: draft.domain,
      participatingOrganisationCodes: draft.participatingOrganisationCodes,
      environmentConfiguration: draft.environmentConfiguration,
      deploymentTargets: draft.deploymentTargets,
      additionalCapabilityCodes: draft.additionalCapabilityCodes,
      featureFlagCodes: draft.featureFlagCodes,
      compositionOptions: draft.compositionOptions,
      dispatchStrategyPreference: draft.dispatchStrategyPreference,
      knowledgeLocations: draft.knowledgeLocations,
      readme: draft.readme,
      redispatchMaxAttempts: draft.redispatchMaxAttempts,
      redispatchAttentionThreshold: draft.redispatchAttentionThreshold,
    };
    for (const [propertyName, value] of Object.entries(simpleFields)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
      pool.push({ propertyName, value, source: profileSource });
    }

  }

  // A Template's catalogue and dependencies enter the pool unless a Profile of this composition carries its own for that Template.
  const profileOwnsCatalogueOf = (template: TemplateRow) => profiles.some((p) => p.base_template_id === template.id && profileOwnCatalogue(p).length > 0);
  const dependencyPoolValue = (graph: Awaited<ReturnType<typeof getDependencyGraphContent>>) =>
    graph.map((e) => ({ toCode: e.toCode, fromType: e.fromType, fromCapabilityCode: e.fromCapabilityCode, fromCode: e.fromCode }));

  for (const template of templates) {
    if (profileOwnsCatalogueOf(template)) continue;
    const templateSource = toPoolSource("template", template.id, template.code, template.name);
    if (template.deliverable_catalogue && template.deliverable_catalogue.length > 0) {
      pool.push({ propertyName: "deliverableCatalogue", value: template.deliverable_catalogue, source: templateSource });
    }
    const dependencyGraph = await getDependencyGraphContent(template.id, viewerTenantId);
    if (dependencyGraph.length > 0) {
      pool.push({ propertyName: "dependencyGraph", value: dependencyPoolValue(dependencyGraph), source: templateSource });
    }
  }

  for (const profile of profiles) {
    const catalogue = profileOwnCatalogue(profile);
    if (catalogue.length === 0) continue;
    const profileSource = toPoolSource("profile", profile.id, profile.code, profile.name);
    pool.push({ propertyName: "deliverableCatalogue", value: catalogue, source: profileSource });
    const dependencyGraph = await getDependencyGraphContent(profile.id, viewerTenantId, "Profile");
    if (dependencyGraph.length > 0) {
      pool.push({ propertyName: "dependencyGraph", value: dependencyPoolValue(dependencyGraph), source: profileSource });
    }
  }

  for (const profile of profiles) {
    const profileSource = toPoolSource("profile", profile.id, profile.code, profile.name);
    const { data: baseTemplate } = await templatesDB.findById(profile.base_template_id);
    const templateSource = baseTemplate ? toPoolSource("template", baseTemplate.id, baseTemplate.code, baseTemplate.name) : profileSource;
    const effective = await resolveEffectiveParameters(profile);
    for (const p of effective) {
      const key = `${p.sourceType}::${p.sourceCode}::${p.parameterName}`;
      pool.push({ propertyName: key, value: p.effectiveValue, source: p.overriddenByProfile ? profileSource : templateSource });
    }

    if (baseTemplate) {
      const overridable = await deriveOverridableParameterCandidates(baseTemplate.code, viewerTenantId);
      const overrides = extractExposedParameterOverrides(profile.draft_content);
      for (const candidate of overridable.filter((c) => !c.valueBearing)) {
        const key = `${candidate.sourceType}::${candidate.sourceCode}::${candidate.parameterName}`;
        const override = overrides.find((o) => `${o.sourceType}::${o.sourceCode}::${o.parameterName}` === key);
        if (override) pool.push({ propertyName: key, value: override.value, source: profileSource });
      }
    }
  }

  // A Capability enters the pool through the Deliverable Catalogue: a catalogue Deliverable is an output of a Service, and the Service offers a Capability.
  // Only the Services a composed Pack contributes are considered.
  const deliverableSource = await deliverableSourceOf(profiles, templates);
  const catalogueCodes = new Set<string>();
  for (const profile of profiles) {
    const baseTemplate = templates.find((t) => t.id === profile.base_template_id);
    if (baseTemplate && deliverableSource) for (const entry of catalogueFor(baseTemplate, profile, deliverableSource)) catalogueCodes.add(entry.code);
  }
  const contributedServiceCodes = [...new Set([...composedPacks.values()].flatMap((pack) => (pack.contributions?.services ?? []).map((svc) => svc.code)))];
  const { data: serviceRows } = contributedServiceCodes.length ? await serviceDefinitionsDB.findActiveByCodesVisibleTo(contributedServiceCodes, viewerTenantId) : { data: [] };
  const serviceByCode = new Map((serviceRows ?? []).map((row) => [row.code, row]));

  for (const pack of composedPacks.values()) {
    const packSource = toPoolSource("pack", pack.id, pack.code, pack.code);
    const c = pack.contributions ?? {};

    const deliverablesByCapability = new Map<string, Set<string>>();
    for (const svc of c.services ?? []) {
      const definition = serviceByCode.get(svc.code);
      const produced = (definition?.outputs ?? []).filter((output) => catalogueCodes.has(output));
      if (!definition || produced.length === 0) continue;
      const set = deliverablesByCapability.get(definition.capability_code) ?? new Set<string>();
      produced.forEach((d) => set.add(d));
      deliverablesByCapability.set(definition.capability_code, set);
    }
    for (const [code, deliverables] of deliverablesByCapability) pool.push({ propertyName: code, value: { code }, source: packSource, deliverableCodes: [...deliverables].sort() });
    for (const svc of c.services ?? []) {
      pool.push({ propertyName: svc.code, value: { code: svc.code, serviceLevel: svc.serviceLevel ?? [] }, source: packSource });
    }
    const rolesByTransition = new Map<string, Set<string>>();
    for (const rule of c.authorityRules ?? []) {
      const roles = rolesByTransition.get(rule.governedTransition) ?? new Set<string>();
      roles.add(rule.authorisedRole);
      rolesByTransition.set(rule.governedTransition, roles);
    }
    for (const [governedTransition, roles] of rolesByTransition) {
      pool.push({ propertyName: `authorityRule::${governedTransition}`, value: { governedTransition, authorisedRoles: [...roles].sort() }, source: packSource });
    }
    for (const gate of c.qualityGates ?? []) {
      pool.push({ propertyName: `qualityGate::${gate.governedTransition}::${gate.category}`, value: gate, source: packSource });
    }
    for (const checklist of c.checklists ?? []) {
      for (const item of checklist.items ?? []) {
        pool.push({ propertyName: `checklistItem::${pack.code}::${checklist.name}::${JSON.stringify(item)}`, value: item, source: packSource });
      }
    }
    for (const gate of c.reviewGates ?? []) {
      pool.push({ propertyName: `reviewGate::${gate.code}::${gate.governedTransition}`, value: gate, source: packSource });
    }
    for (const ob of c.obligationDefinitions ?? []) {
      if (ob.code) pool.push({ propertyName: `obligationDefinition::${ob.code}`, value: ob, source: packSource });
    }
    for (const ec of c.engineeringCapital ?? []) {
      pool.push({ propertyName: `engineeringCapital::${pack.code}::${JSON.stringify(ec)}`, value: ec, source: packSource });
    }

    const { data: policyRows } = await policiesDB.findByPackCode(pack.code);
    for (const policyRow of policyRows ?? []) {
      const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyRow.code, viewerTenantId);
      if (!definition) continue;
      pool.push({
        propertyName: `policy::${definition.code}`,
        value: {
          code: definition.code,
          governedTransition: policyRow.governed_transition,
          constraintType: definition.constraint_type,
          applicabilityEnvironments: definition.applicability_environments,
          conditions: definition.conditions,
        },
        source: packSource,
      });
    }

    for (const dep of pack.dependencies ?? []) {
      pool.push({
        propertyName: dep.packCode,
        value: { type: dep.type, satisfiedInComposedSet: directlySelectedPackCodes.has(dep.packCode) },
        source: packSource,
      });
    }
  }

  return {
    pool,
    composedPacks: [...composedPacks.values()].map((pack) => ({ packId: pack.id, packCode: pack.code, packVersion: pack.pack_version })),
    warnings,
    competencyRequirements: computeCompetencyRequirements(profiles, composedPacks),
    deliverableSource,
  };
}

// The source of the Deliverable Catalogue and the dependencies for the Profile of this composition and its base Template.
async function deliverableSourceOf(profiles: ProfileRow[], templates: TemplateRow[]): Promise<EbmDeliverableSource | undefined> {
  const profile = profiles[0];
  if (!profile) return undefined;
  const baseTemplate = templates.find((t) => t.id === profile.base_template_id);
  return baseTemplate ? resolveDeliverableSource(baseTemplate, profile) : undefined;
}

const ARRAY_IDENTITY_FIELDS = ["code", "name"];

function arrayIdentityField(arrays: unknown[][]): string | null {
  for (const field of ARRAY_IDENTITY_FIELDS) {
    const everyItemHasIt = arrays.every((arr) => arr.every((item) => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>)[field] === "string" && (item as Record<string, unknown>)[field] !== ""));
    if (everyItemHasIt) return field;
  }
  return null;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isDependencyShaped(value: unknown): boolean {
  const v = value as { type?: unknown; satisfiedInComposedSet?: unknown };
  return typeof v?.type === "string" && typeof v?.satisfiedInComposedSet === "boolean";
}

function diffEntries(entries: PoolEntry[], path: string, hasAction: boolean): CompositionConflict[] {
  const values = entries.map((e) => e.value);
  if (values.every((v) => isDeepEqual(v, values[0]))) return [];

  const allPlainObjects = values.every((v) => typeof v === "object" && v !== null && !Array.isArray(v));
  if (allPlainObjects) {
    const stillHasAction = hasAction && !values.some(isDependencyShaped);
    const keys = new Set<string>();
    for (const v of values) for (const k of Object.keys(v as Record<string, unknown>)) keys.add(k);
    const conflicts: CompositionConflict[] = [];
    for (const key of keys) {
      const present = entries.filter((e) => key in (e.value as Record<string, unknown>));
      if (present.length < 2) continue;
      const subEntries = present.map((e) => ({ ...e, value: (e.value as Record<string, unknown>)[key] }));
      conflicts.push(...diffEntries(subEntries, `${path}.${key}`, stillHasAction));
    }
    return conflicts;
  }

  const allArrays = values.every((v) => Array.isArray(v));
  if (allArrays) {
    const arrays = values as unknown[][];
    const identityField = arrayIdentityField(arrays);
    if (identityField) {
      const byIdentity = new Map<string, PoolEntry[]>();
      entries.forEach((e, i) => {
        for (const item of arrays[i] as Array<Record<string, unknown>>) {
          const idVal = String(item[identityField]);
          const list = byIdentity.get(idVal) ?? [];
          list.push({ ...e, value: item });
          byIdentity.set(idVal, list);
        }
      });
      const conflicts: CompositionConflict[] = [];
      for (const [idVal, items] of byIdentity) {
        if (items.length < 2) continue;
        conflicts.push(...diffEntries(items, `${path}[${identityField}=${idVal}]`, hasAction));
      }
      return conflicts;
    }
    if (arrays.every((a) => a.length === arrays[0].length)) {
      const conflicts: CompositionConflict[] = [];
      for (let idx = 0; idx < arrays[0].length; idx++) {
        const subEntries = entries.map((e, i) => ({ ...e, value: (arrays[i] as unknown[])[idx] }));
        conflicts.push(...diffEntries(subEntries, `${path}[${idx}]`, hasAction));
      }
      return conflicts;
    }
  }

  return [{ propertyName: path, options: entries.map((e) => ({ source: e.source, value: e.value })), hasAction }];
}

export function detectCompositionConflicts(unraveled: UnraveledComposition, resolvedConflicts: Record<string, unknown> = {}): CompositionConflict[] {
  const byProperty = new Map<string, PoolEntry[]>();
  for (const entry of unraveled.pool) {
    const list = byProperty.get(entry.propertyName) ?? [];
    list.push(entry);
    byProperty.set(entry.propertyName, list);
  }

  const isReallyResolved = (propertyName: string) => propertyName in resolvedConflicts && resolvedConflicts[propertyName] !== undefined;
  const conflicts: CompositionConflict[] = [];
  for (const [propertyName, entries] of byProperty) {
    if (entries.length < 2) continue;
    conflicts.push(...diffEntries(entries, propertyName, true).filter((c) => !isReallyResolved(c.propertyName)));
  }

  for (const entry of unraveled.pool) {
    const value = entry.value as { type?: string; satisfiedInComposedSet?: boolean };
    if (typeof value?.type !== "string" || typeof value?.satisfiedInComposedSet !== "boolean") continue;
    const violated = (value.type === "required" || value.type === "conditional") ? !value.satisfiedInComposedSet : value.type === "incompatible" ? value.satisfiedInComposedSet : false;
    if (violated) {
      conflicts.push({ propertyName: entry.propertyName, options: [{ source: entry.source, value: entry.value }], hasAction: false });
    }
  }

  return conflicts;
}

export function formatCompositionConflict(conflict: CompositionConflict): string {
  const options = conflict.options.map((o) => `${o.source.label} sets ${JSON.stringify(o.value)}`).join(", ");
  return `Conflict on "${conflict.propertyName}": ${options}.`;
}
