import { templatesDB } from "../../../dblayer/templatesDB.js";
import { deriveCapabilityCodesFromPackCodes, deriveOverridableParameterCandidates, extractExposedParameters, findDeliverableDependencyCycle, getDependencyGraphContent, getPackSelectionsByCategory, PACK_SELECTION_SLOTS } from "./templates.js";
import { materialiseDependencyGraph } from "../../../domain/engine/materialiseDependencyGraph.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { toSchemaRows, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import type { ProfileRow, ProfileDetailSource, TemplateDeliverableSeed, TemplateDependencyGraphEntry } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { nextAvailablePatchVersion as nextAvailableVersion, semverError } from "../../../utils/version.js";

const THROWAWAY_PROFILE_CODE = /^profile-\d+-[a-z0-9]+$/;

export async function listRealProfilesForTemplate(templateId: string): Promise<ProfileRow[]> {
  const { data: existing } = await profilesDB.findByBaseTemplateId(templateId);
  return (existing ?? []).filter((p) => !THROWAWAY_PROFILE_CODE.test(p.code));
}

export interface ProfileSeedInput {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  optionalPackCodes?: string[];
  profileVersion: string;
  tenantId?: string;
  parentProfileId?: string | null;
  description?: string;
  featureFlagCodes?: string[];
  compositionOptions?: Record<string, unknown>;
  technologyPackCodes?: string[];
  domainPackCodes?: string[];
  compliancePackCodes?: string[];
  integrationPackCodes?: string[];
  engineeringPackCodes?: string[];
  organisationPackCodes?: string[];
  deploymentTargets?: Record<string, unknown>;
  targetCloudProvider?: string;
  primaryProgrammingLanguage?: string;
  sourceControlProvider?: string;
  deploymentStrategy?: string;
  aiProviderPreference?: string;
  defaultRepositoryStructure?: string;
  documentationLevel?: string;
  developmentMethodology?: string;
  domain?: string;
  participatingOrganisationCodes?: string[];
  environmentConfiguration?: Record<string, unknown>;
  dispatchStrategyPreference?: DispatchStrategyPreferenceEntry[];
  knowledgeLocations?: KnowledgeLocation[];
  readme?: string;
  redispatchMaxAttempts?: number;
  redispatchAttentionThreshold?: number;
  exposedParameterOverrides?: ExposedParameterOverride[];
  deliverableCatalogue?: TemplateDeliverableSeed[];
  dependencyGraph?: TemplateDependencyGraphEntry[];
}

export interface ExposedParameterOverride {
  sourceType: "service" | "policy" | "checklist" | "dependency";
  sourceCode: string;
  parameterName: string;
  value: string;
}

export interface KnowledgeLocation {
  deliverableCodes?: string[];
  outputLocation?: string;
}

export interface DispatchStrategyPreferenceEntry {
  strategy: string;
  order: number;
}

export function extractExposedParameterOverrides(draftContent: Record<string, unknown> | null): ExposedParameterOverride[] {
  return Array.isArray(draftContent?.exposedParameterOverrides) ? (draftContent!.exposedParameterOverrides as ExposedParameterOverride[]) : [];
}

export interface EffectiveParameter {
  sourceType: ExposedParameterOverride["sourceType"];
  sourceCode: string;
  parameterName: string;
  effectiveValue: string;
  overriddenByProfile: boolean;
}

export async function resolveEffectiveParameters(profile: Pick<ProfileRow, "base_template_id" | "draft_content">): Promise<EffectiveParameter[]> {
  const { data: template } = await templatesDB.findById(profile.base_template_id);
  if (!template) return [];
  const exposed = extractExposedParameters(template.draft_content as Record<string, unknown> | null) ?? [];
  const overrides = extractExposedParameterOverrides(profile.draft_content);
  const overrideByKey = new Map(overrides.map((o) => [`${o.sourceType}::${o.sourceCode}::${o.parameterName}`, o.value]));
  return exposed
    .filter((e): e is typeof e & { value: string } => e.value !== undefined)
    .map((e) => {
      const key = `${e.sourceType}::${e.sourceCode}::${e.parameterName}`;
      const overrideValue = e.overridable ? overrideByKey.get(key) : undefined;
      return {
        sourceType: e.sourceType,
        sourceCode: e.sourceCode,
        parameterName: e.parameterName,
        effectiveValue: overrideValue ?? e.value,
        overriddenByProfile: overrideValue !== undefined,
      };
    });
}

export interface ProfileDetail {
  profileId: string;
  profileCode: string;
  profileName: string;
  fields: Record<string, unknown>;
  effectiveParameters: EffectiveParameter[];
}

function isEmptyDetailValue(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

export async function extractProfileDetails(profile: ProfileDetailSource): Promise<ProfileDetail> {
  const d = (profile.draft_content ?? {}) as Record<string, unknown>;
  const candidates: Record<string, unknown> = {
    environment: profile.environment,
    configParameters: profile.config_parameters,
    optionalPackCodes: d.optionalPackCodes,
    description: d.description,
    featureFlagCodes: d.featureFlagCodes,
    compositionOptions: d.compositionOptions,
    technologyPackCodes: d.technologyPackCodes,
    domainPackCodes: d.domainPackCodes,
    compliancePackCodes: d.compliancePackCodes,
    integrationPackCodes: d.integrationPackCodes,
    engineeringPackCodes: d.engineeringPackCodes,
    organisationPackCodes: d.organisationPackCodes,
    targetCloudProvider: d.targetCloudProvider,
    primaryProgrammingLanguage: d.primaryProgrammingLanguage,
    sourceControlProvider: d.sourceControlProvider,
    deploymentStrategy: d.deploymentStrategy,
    aiProviderPreference: d.aiProviderPreference,
    defaultRepositoryStructure: d.defaultRepositoryStructure,
    documentationLevel: d.documentationLevel,
    developmentMethodology: d.developmentMethodology,
    participatingOrganisationCodes: d.participatingOrganisationCodes,
    deploymentTargets: d.deploymentTargets,
    environmentConfiguration: d.environmentConfiguration,
    dispatchStrategyPreference: d.dispatchStrategyPreference,
    knowledgeLocations: d.knowledgeLocations,
    readme: d.readme,
    redispatchMaxAttempts: d.redispatchMaxAttempts,
    redispatchAttentionThreshold: d.redispatchAttentionThreshold,
    exposedParameterOverrides: extractExposedParameterOverrides(profile.draft_content),
  };
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (!isEmptyDetailValue(value)) fields[key] = value;
  }
  const effectiveParameters = await resolveEffectiveParameters(profile);
  return { profileId: profile.id, profileCode: profile.code, profileName: profile.name, fields, effectiveParameters };
}

export const CONFIGURATION_PARAMETER_FIELDS: Array<{ field: keyof ProfileSeedInput; parameterCode: string }> = [
  { field: "targetCloudProvider", parameterCode: "target-cloud-provider" },
  { field: "primaryProgrammingLanguage", parameterCode: "primary-programming-language" },
  { field: "sourceControlProvider", parameterCode: "source-control-provider" },
  { field: "deploymentStrategy", parameterCode: "deployment-strategy" },
  { field: "aiProviderPreference", parameterCode: "ai-provider-preference" },
  { field: "defaultRepositoryStructure", parameterCode: "default-repository-structure" },
  { field: "documentationLevel", parameterCode: "documentation-level" },
  { field: "developmentMethodology", parameterCode: "development-methodology" },
  { field: "domain", parameterCode: "domain" },
];

export type ProfileValidationResult = { ok: true } | { ok: false; errors: string[] };


// Commented out (owner): the Template's PACK_SELECTION_SLOTS, imported above, is used.
// const PACK_SELECTION_SLOTS: Array<{ field: keyof ProfileSeedInput; packCategory: string }> = [
//   { field: "technologyPackCodes", packCategory: "Technology" },
//   { field: "domainPackCodes", packCategory: "Domain" },
//   { field: "compliancePackCodes", packCategory: "Compliance" },
//   { field: "integrationPackCodes", packCategory: "Integration" },
//   { field: "engineeringPackCodes", packCategory: "Engineering" },
//   { field: "organisationPackCodes", packCategory: "Organisation" },
// ];

// Every Pack code a Profile selects, whatever its category, for composition and commissioning.
export async function getProfilePackCodes(profileId: string): Promise<string[]> {
  const { data, error } = await profilesDB.getPackCodes(profileId);
  if (error || !data) throw error ?? new Error(`could not read the Pack selection of Profile ${profileId}`);
  return data;
}

export async function getProfilePackSelections(profileId: string): Promise<Pick<ProfileSeedInput, "optionalPackCodes" | "technologyPackCodes" | "domainPackCodes" | "compliancePackCodes" | "integrationPackCodes" | "engineeringPackCodes" | "organisationPackCodes">> {
  const { data, error } = await profilesDB.getPackSelections(profileId);
  if (error || !data) throw error ?? new Error(`could not read the Pack selection of Profile ${profileId}`);
  return {
    optionalPackCodes: data.optional ?? [],
    technologyPackCodes: data.technology ?? [],
    domainPackCodes: data.domain ?? [],
    compliancePackCodes: data.compliance ?? [],
    integrationPackCodes: data.integration ?? [],
    engineeringPackCodes: data.engineering ?? [],
    organisationPackCodes: data.organisation ?? [],
  };
}

export async function validateProfileSeed(seed: ProfileSeedInput): Promise<ProfileValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.environment?.trim()) errors.push("environment is required");
  const profileVersionError = semverError("profileVersion", seed.profileVersion);
  if (profileVersionError) errors.push(profileVersionError);

  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? (await getPlatformTenantId()) };

  if (!seed.baseTemplateCode?.trim()) {
    errors.push("baseTemplateCode is required");
  } else {
    const { data: template } = await templatesDB.findActiveByCodeVisibleTo(seed.baseTemplateCode, ontologyViewer.tenantId);
    if (!template) errors.push(`baseTemplateCode "${seed.baseTemplateCode}" does not resolve to a real Template`);
  }

  for (const code of seed.optionalPackCodes ?? []) {
    const { data } = await packsDB.findByCodeVisibleTo(code, ontologyViewer.tenantId);
    if (!data) errors.push(`optionalPackCodes references unknown Pack code "${code}"`);
  }

  for (const slot of PACK_SELECTION_SLOTS) {
    const codes = ((seed as unknown as Record<string, string[] | undefined>)[slot.field as string]) ?? [];
    for (const code of codes) {
      const { data: pack } = await packsDB.findByCodeVisibleTo(code, ontologyViewer.tenantId);
      if (!pack) errors.push(`${String(slot.field)} references unknown Pack code "${code}"`);
      else if (pack.category !== slot.packCategory) errors.push(`${String(slot.field)} references Pack "${code}" whose category is "${pack.category}", not "${slot.packCategory}"`);
    }
  }

  for (const code of seed.featureFlagCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("feature-flag", code, ontologyViewer);
    if (!concept) errors.push(`featureFlagCodes references unknown feature-flag code "${code}"`);
  }

  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const value = (seed[cp.field] as string | undefined)?.trim();
    if (value) {
      const { data: valueConcept } = await ontologyDB.findConcept(cp.parameterCode, value, ontologyViewer);
      if (!valueConcept) errors.push(`${String(cp.field)} references unknown ${cp.parameterCode} code "${value}"`);
    }
  }

  for (const code of seed.participatingOrganisationCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("participating-organisations", code, ontologyViewer);
    if (!concept) errors.push(`participatingOrganisationCodes references unknown participating-organisations code "${code}"`);
  }

  const { data: baseTemplate } = seed.baseTemplateCode?.trim() ? await templatesDB.findActiveByCodeVisibleTo(seed.baseTemplateCode, ontologyViewer.tenantId) : { data: null };
  const ownCatalogue = (seed.deliverableCatalogue ?? []).filter((entry) => entry.code?.trim());
  const catalogueCodes = new Set((ownCatalogue.length > 0 ? ownCatalogue : baseTemplate?.deliverable_catalogue ?? []).map((entry) => entry.code));
  for (const [i, loc] of (seed.knowledgeLocations ?? []).entries()) {
    if (!loc.outputLocation?.trim()) errors.push(`knowledgeLocations[${i}] needs a location`);
    for (const code of loc.deliverableCodes ?? []) {
      const { data: concept } = await ontologyDB.findConcept("deliverable-name", code.trim(), ontologyViewer);
      if (!concept) errors.push(`knowledgeLocations[${i}] references unknown deliverable-name code "${code}"`);
      else if (baseTemplate && !catalogueCodes.has(code.trim())) errors.push(`knowledgeLocations[${i}] names "${code}", which is not in the Base template's Deliverable catalogue`);
    }
  }

  for (const [i, entry] of (seed.dispatchStrategyPreference ?? []).entries()) {
    if (!entry.strategy?.trim()) {
      errors.push(`dispatchStrategyPreference[${i}] must name a strategy`);
    } else {
      const { data: concept } = await ontologyDB.findConcept("dispatch-strategy-preference", entry.strategy.trim(), ontologyViewer);
      if (!concept) errors.push(`dispatchStrategyPreference[${i}] references unknown dispatch-strategy-preference code "${entry.strategy}"`);
    }
  }

  errors.push(...(await validateProfileOnSave(seed)));

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

// The sanity checks the schema cannot carry (CR-128). They run when the form is saved and again when the Profile is created.
// Save is not a transition: there is no gate, only an error message.
export async function validateProfileOnSave(seed: ProfileSeedInput): Promise<string[]> {
  const errors: string[] = [];
  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? (await getPlatformTenantId()) };

  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const value = (seed[cp.field] as string | undefined)?.trim();
    const { data: parameterConcept } = await ontologyDB.findConcept("profile-configuration", cp.parameterCode, ontologyViewer);
    if (parameterConcept?.is_mandatory && !value) {
      errors.push(`${String(cp.field)} is required (a mandatory Configuration Parameter for this tenant)`);
    }
  }

  if (seed.primaryProgrammingLanguage?.trim()) {
    const { data: technologyConcept } = await ontologyDB.findConcept("technology", seed.primaryProgrammingLanguage.trim(), ontologyViewer);
    if (!technologyConcept) {
      errors.push(`primaryProgrammingLanguage "${seed.primaryProgrammingLanguage}" has no matching "technology" competency concept — it would be unioned into this SEU's Technology competency requirement (CR-101) as a value no Participant or Pack could ever match. Register it as a technology concept first.`);
    }
  }

  const seenOrders = new Set<number>();
  for (const [i, entry] of (seed.dispatchStrategyPreference ?? []).entries()) {
    if (seenOrders.has(entry.order)) errors.push(`dispatchStrategyPreference[${i}] duplicates order ${entry.order} — each entry needs a distinct order`);
    seenOrders.add(entry.order);
  }

  if (seed.redispatchMaxAttempts != null && seed.redispatchAttentionThreshold != null) {
    if (seed.redispatchMaxAttempts <= seed.redispatchAttentionThreshold) {
      errors.push(`redispatchMaxAttempts (${seed.redispatchMaxAttempts}) must be greater than redispatchAttentionThreshold (${seed.redispatchAttentionThreshold})`);
    }
  }

  errors.push(...(await validateProfileDeliverables(seed)));

  if (seed.parentProfileId) {
    const { data: parent } = await profilesDB.findById(seed.parentProfileId);
    if (!parent) {
      errors.push(`parentProfileId "${seed.parentProfileId}" not found`);
    } else if (seed.code !== parent.code) {
      errors.push(`an inherited Profile must keep its parent's code ("${parent.code}") — Derived Profiles shall not modify parent Profiles (Ch.7 §9)`);
    }
  }

  return errors;
}

// What a Profile starts with when it carries no catalogue of its own: its base Template's catalogue and dependencies.
export async function baseTemplateDeliverables(baseTemplateCode: string, tenantId: string | null): Promise<{ deliverableCatalogue: TemplateDeliverableSeed[]; dependencyGraph: TemplateDependencyGraphEntry[] }> {
  const viewerTenantId = tenantId ?? (await getPlatformTenantId());
  const { data: template } = await templatesDB.findActiveByCodeVisibleTo(baseTemplateCode, viewerTenantId);
  if (!template) return { deliverableCatalogue: [], dependencyGraph: [] };
  return { deliverableCatalogue: template.deliverable_catalogue, dependencyGraph: await getDependencyGraphContent(template.id, viewerTenantId) };
}

// The Capabilities a Profile's dependency graph may name: those of the Packs its base Template and the Profile itself select.
export async function deriveProfileGraphCapabilityCodes(baseTemplateId: string | null, profilePackCodes: string[], viewerTenantId: string | null): Promise<string[]> {
  const templatePackCodes = baseTemplateId ? Object.values(await getPackSelectionsByCategory(baseTemplateId)).flatMap((codes) => codes ?? []) : [];
  return deriveCapabilityCodesFromPackCodes([...new Set([...templatePackCodes, ...profilePackCodes])], viewerTenantId);
}

// The Deliverable Catalogue and Dependency Graph a Profile carries of its own are checked as a Template's are: no catalogue entry twice, no dependency
// that names a Deliverable outside the catalogue, no cycle. A Profile removes Deliverables from its base Template's catalogue; it does not add any.
// A Profile with no catalogue of its own keeps its base Template's.
export async function validateProfileDeliverables(seed: ProfileSeedInput): Promise<string[]> {
  const errors: string[] = [];
  const catalogue = seed.deliverableCatalogue ?? [];
  const graph = seed.dependencyGraph ?? [];
  if (catalogue.length === 0) {
    if (graph.length > 0) errors.push("dependencyGraph needs a deliverableCatalogue: its dependencies name Deliverables of the catalogue");
    return errors;
  }

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());
  const { data: baseTemplate } = seed.baseTemplateCode?.trim() ? await templatesDB.findActiveByCodeVisibleTo(seed.baseTemplateCode, tenantId) : { data: null };
  const baseCodes = new Set((baseTemplate?.deliverable_catalogue ?? []).map((entry) => entry.code));
  const codes = new Set<string>();
  for (const entry of catalogue) {
    if (!entry.code?.trim()) { errors.push("deliverableCatalogue entry is missing a code"); continue; }
    if (codes.has(entry.code)) errors.push(`deliverableCatalogue entry "${entry.code}" is a duplicate — codes must be unique within one catalogue`);
    codes.add(entry.code);
    if (baseTemplate && !baseCodes.has(entry.code)) errors.push(`deliverableCatalogue entry "${entry.code}" is not in the base Template's catalogue — a Profile can only remove Deliverables from it`);
  }

  const profilePackCodes = PACK_SELECTION_SLOTS.flatMap((slot) => ((seed as unknown as Record<string, string[] | undefined>)[slot.field as string] ?? []));
  const capabilityCodes = await deriveProfileGraphCapabilityCodes(baseTemplate?.id ?? null, profilePackCodes, tenantId);
  for (const entry of graph) {
    if (entry.toCode && !codes.has(entry.toCode)) errors.push(`dependencyGraph entry toCode "${entry.toCode}" does not match a deliverableCatalogue entry`);
    if (entry.fromType === "Deliverable") {
      if (!entry.fromCode || !codes.has(entry.fromCode)) errors.push(`dependencyGraph entry (toCode "${entry.toCode}") fromCode "${entry.fromCode}" does not match a deliverableCatalogue entry`);
    } else if (entry.fromType === "Capability") {
      if (!entry.fromCapabilityCode || !capabilityCodes.includes(entry.fromCapabilityCode)) errors.push(`dependencyGraph entry (toCode "${entry.toCode}") fromCapabilityCode "${entry.fromCapabilityCode}" is not among the Capabilities the selected Packs contribute`);
    } else {
      errors.push(`dependencyGraph entry (toCode "${entry.toCode}") has an unrecognised fromType "${entry.fromType}"`);
    }
  }

  const cycle = findDeliverableDependencyCycle(graph);
  if (cycle) errors.push(`dependencyGraph has a circular dependency: ${cycle.join(" → ")}`);
  return errors;
}

// A saved Profile form shows its catalogue (its own, or its base Template's to start from), so an empty catalogue on a later save means every
// Deliverable was removed. A Profile keeps at least one.
export async function validateProfileKeepsDeliverable(seed: ProfileSeedInput): Promise<string[]> {
  if ((seed.deliverableCatalogue ?? []).some((entry) => entry.code?.trim())) return [];
  if (!seed.baseTemplateCode?.trim()) return [];
  const { data: baseTemplate } = await templatesDB.findActiveByCodeVisibleTo(seed.baseTemplateCode, seed.tenantId ?? (await getPlatformTenantId()));
  return baseTemplate && baseTemplate.deliverable_catalogue.length > 0 ? ["deliverableCatalogue must keep at least one Deliverable"] : [];
}

// The value of an override is one the base Template's parameter allows. A row for a parameter the base Template does not flag overridable
// is not an error here: the unravel step drops it (CR-128).
export async function validateOverrideValues(seed: ProfileSeedInput): Promise<string[]> {
  const errors: string[] = [];
  errors.push(...(await validateProfileDeliverables(seed)));
  if (!seed.baseTemplateCode?.trim()) return errors;
  const candidates = await deriveOverridableParameterCandidates(seed.baseTemplateCode, seed.tenantId ?? (await getPlatformTenantId()));
  for (const row of seed.exposedParameterOverrides ?? []) {
    const candidate = candidates.find((c) => c.sourceType === row.sourceType && c.sourceCode === row.sourceCode && c.parameterName === row.parameterName);
    if (candidate?.numeric && row.value.trim() !== "" && !Number.isFinite(Number(row.value))) {
      errors.push(`exposedParameterOverrides "${row.parameterName}" has value "${row.value}" — must be a number`);
    }
    if (candidate?.valueOptions && !candidate.valueOptions.includes(row.value)) {
      errors.push(`exposedParameterOverrides "${row.parameterName}" has value "${row.value}" — must be one of ${candidate.valueOptions.join(", ")}`);
    }
  }
  return errors;
}

export type PublishProfileResult = { ok: true; profileId: string } | { ok: false; errors: string[] };

export async function createProfileDraft(seed: ProfileSeedInput, actorId: string): Promise<{ ok: true; draft: ProfileRow } | { ok: false; errors: string[] }> {
  const validation = await validateProfileSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());

  const { data: template } = await templatesDB.findActiveByCodeVisibleTo(seed.baseTemplateCode, tenantId);
  if (!template) return { ok: false, errors: [`baseTemplateCode "${seed.baseTemplateCode}" not found`] };

  const { data: profileSchema } = await schemaDefinitionsDB.findLatest("Profile");
  if (!profileSchema) return { ok: false, errors: [`no schema_definitions grammar for Profile`] };
  if (!actorId) return { ok: false, errors: ["publishProfile requires a real actorId to author the Draft"] };
  const { data: profileMaster } = await participantsMasterDB.findById(actorId);
  if (!profileMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Profile", actorId });
  const { data: draft, error } = await profilesDB.createDraft({
    code: seed.code,
    name: seed.name,
    baseTemplateId: template.id,
    status: birth.initialState as ProfileRow["status"],
    authoredBy: profileMaster.id,
    authorBadge: birth.authorityBadge,
    environment: seed.environment,
    profileVersion: seed.profileVersion,
    tenantId,
    parentProfileId: seed.parentProfileId,
    draftContent: toSchemaRows(profileSchema.schema as JsonSchemaDocument, { ...seed }),
    schemaDefinitionId: profileSchema.id,
  });
  if (error || !draft) return { ok: false, errors: [(error ?? new Error("failed to create profile draft")).message] };

  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Profile",
    originatingObjectId: draft.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: profileMaster.id,
    authorityBadge: birth.authorityBadge,
    payload: { code: draft.code, profileVersion: draft.profile_version },
  });
  return { ok: true, draft };
}

// Moves a Profile to Active and deprecates the Active version it replaces, both through the generic transition.
export async function activateProfileSupersedingPrevious(profile: ProfileRow, actorId: string): Promise<{ ok: true; profile: ProfileRow } | { ok: false; errors: string[] }> {
  const { data: previousActive } = await profilesDB.findActiveByCode(profile.code, profile.tenant_id);
  const activated = await transitionEntity({ entityType: "Profile", entityId: profile.id, targetState: "Active", actorId });
  if (!activated.ok) return { ok: false, errors: [`transition to "Active" failed: ${"detail" in activated ? activated.detail : activated.reason}`] };
  await publishTransition(activated);
  if (previousActive && previousActive.id !== profile.id) {
    const deprecated = await transitionEntity({ entityType: "Profile", entityId: previousActive.id, targetState: "Deprecated", actorId });
    if (deprecated.ok) await publishTransition(deprecated);
  }
  return { ok: true, profile: activated.row as ProfileRow };
}

// Walks a Profile from Draft, Validated or Published to Active, one transition at a time.
export async function advanceProfileToActive(profile: ProfileRow, actorId: string): Promise<{ ok: true; profile: ProfileRow } | { ok: false; errors: string[] }> {
  let current = profile;
  for (const targetState of ["Validated", "Published"]) {
    if (current.status === "Active") break;
    if (targetState === "Validated" && current.status !== "Draft") continue;
    if (targetState === "Published" && current.status !== "Validated") continue;
    const result = await transitionEntity({ entityType: "Profile", entityId: current.id, targetState, actorId });
    if (!result.ok) return { ok: false, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
    await publishTransition(result);
    current = result.row as ProfileRow;
  }
  if (current.status !== "Published") return { ok: false, errors: [`Profile "${current.code}" is ${current.status} and cannot be advanced to Active`] };
  return activateProfileSupersedingPrevious(current, actorId);
}

export async function publishProfile(input: { seed: ProfileSeedInput; actorId: string }): Promise<PublishProfileResult> {
  const created = await createProfileDraft(input.seed, input.actorId);
  if (!created.ok) return created;
  const advanced = await advanceProfileToActive(created.draft, input.actorId);
  if (!advanced.ok) return advanced;
  return { ok: true, profileId: advanced.profile.id };
}

async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  return nextAvailableVersion(fromVersion, async (candidate) => !!(await profilesDB.findByCodeAndVersion(code, candidate, tenantId)).data);
}

export async function copyProfileAsNewDraft(profileId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await profilesDB.findById(profileId);
  if (!source) return { ok: false, errors: ["Profile not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.profile_version, source.tenant_id);
  const { data: template } = await templatesDB.findById(source.base_template_id);
  if (!template) return { ok: false, errors: [`base Template ${source.base_template_id} no longer exists`] };

  const packSelections = await getProfilePackSelections(source.id);
  const priorContent = (source.draft_content ?? {}) as Record<string, unknown>;
  const featureFlagCodes = Array.isArray(priorContent.featureFlagCodes)
    ? (priorContent.featureFlagCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { featureCode?: string })?.featureCode ?? "")).filter((v) => v !== "")
    : [];
  const participatingOrganisationCodes = Array.isArray(priorContent.participatingOrganisationCodes)
    ? (priorContent.participatingOrganisationCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { organisationCode?: string })?.organisationCode ?? "")).filter((v) => v !== "")
    : [];
  const knowledgeLocations = Array.isArray(priorContent.knowledgeLocations) ? (priorContent.knowledgeLocations as KnowledgeLocation[]) : [];
  const dispatchStrategyPreference = Array.isArray(priorContent.dispatchStrategyPreference) ? (priorContent.dispatchStrategyPreference as DispatchStrategyPreferenceEntry[]) : [];
  const draftContent: Record<string, unknown> = {
    code: source.code,
    name: source.name,
    baseTemplateCode: template.code,
    environment: source.environment,
    description: typeof priorContent.description === "string" ? priorContent.description : undefined,
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? (priorContent.compositionOptions as Record<string, unknown>) : undefined,
    deploymentTargets: typeof priorContent.deploymentTargets === "object" && priorContent.deploymentTargets ? (priorContent.deploymentTargets as Record<string, unknown>) : undefined,
    environmentConfiguration: typeof priorContent.environmentConfiguration === "object" && priorContent.environmentConfiguration ? (priorContent.environmentConfiguration as Record<string, unknown>) : undefined,
    readme: typeof priorContent.readme === "string" ? priorContent.readme : undefined,
    redispatchMaxAttempts: typeof priorContent.redispatchMaxAttempts === "number" ? priorContent.redispatchMaxAttempts : undefined,
    redispatchAttentionThreshold: typeof priorContent.redispatchAttentionThreshold === "number" ? priorContent.redispatchAttentionThreshold : undefined,
    ...packSelections,
    featureFlagCodes,
    participatingOrganisationCodes,
    knowledgeLocations,
    dispatchStrategyPreference,
  };
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") draftContent[cp.field as string] = priorValue;
  }
  draftContent.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? priorContent.exposedParameterOverrides : [];
  draftContent.deliverableCatalogue = Array.isArray(priorContent.deliverableCatalogue) ? priorContent.deliverableCatalogue : [];
  draftContent.dependencyGraph = Array.isArray(priorContent.dependencyGraph) ? priorContent.dependencyGraph : [];
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Profile");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Profile`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Profile", actorId });
  const { data: newDraft, error } = await profilesDB.createDraft({
    code: source.code,
    name: source.name,
    baseTemplateId: template.id,
    environment: source.environment,
    status: birth.initialState as ProfileRow["status"],
    authoredBy: copyMaster.id,
    authorBadge: birth.authorityBadge,
    draftContent,
    profileVersion: nextVersion,
    tenantId: source.tenant_id,
    parentProfileId: source.parent_profile_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Profile")).message] };
  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Profile",
    originatingObjectId: newDraft.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: copyMaster.id,
    authorityBadge: birth.authorityBadge,
    payload: { code: newDraft.code, profileVersion: newDraft.profile_version },
  });
  return { ok: true, draftId: newDraft.id };
}

export async function materialiseProfileDraft(profileId: string, seed: ProfileSeedInput, authorId: string, authorBadge: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const slots: Array<[string, string[] | undefined]> = [
    ["optional", seed.optionalPackCodes], ["technology", seed.technologyPackCodes], ["domain", seed.domainPackCodes], ["compliance", seed.compliancePackCodes],
    ["integration", seed.integrationPackCodes], ["engineering", seed.engineeringPackCodes], ["organisation", seed.organisationPackCodes],
  ];
  for (const [listKind, codes] of slots) {
    const { error: selectionError } = await profilesDB.setPackSelection(profileId, listKind, codes ?? [], authorId, authorBadge);
    if (selectionError) throw selectionError;
  }
  // The overrides are rebuilt from the parameters the base Template flags overridable; a row for any other parameter is dropped (CR-128).
  const candidates = seed.baseTemplateCode?.trim() ? await deriveOverridableParameterCandidates(seed.baseTemplateCode, seed.tenantId ?? (await getPlatformTenantId())) : [];
  const overridable = new Set(candidates.map((c) => `${c.sourceType}::${c.sourceCode}::${c.parameterName}`));
  const exposedParameterOverrides = (seed.exposedParameterOverrides ?? []).filter((row) => overridable.has(`${row.sourceType}::${row.sourceCode}::${row.parameterName}`));
  const { error } = await profilesDB.setDraftContent(profileId, { ...seed, exposedParameterOverrides });
  if (error) throw error;
  // The Profile's own dependency graph becomes the rows its EBM records. A Profile with no catalogue of its own has none.
  await materialiseDependencyGraph({
    owningEntityType: "Profile",
    owningEntityId: profileId,
    deliverableCatalogue: seed.deliverableCatalogue ?? [],
    dependencyGraph: seed.dependencyGraph ?? [],
    tenantId: seed.tenantId || (await getPlatformTenantId()),
    authorId,
    authorBadge,
  });
  return { ok: true };
}

export interface ProfileWithNextStates {
  profile: ProfileRow;
  possibleNextStates: string[];
}

export async function listProfilesWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<ProfileWithNextStates[]> {
  const { data: profiles } = viewer && !viewer.isRoot ? await profilesDB.findAllVisibleTo(viewer.tenantId) : await profilesDB.findAll();
  return Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Profile", profile.status);
      return { profile, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
