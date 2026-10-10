import { templatesDB } from "../../../dblayer/templatesDB.js";
import { deriveOverridableParameterCandidates, extractExposedParameters } from "./templates.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import type { ProfileRow } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";

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
  additionalCapabilityCodes?: string[];
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
}

export interface ExposedParameterOverride {
  sourceType: "service" | "policy" | "checklist" | "dependency";
  sourceCode: string;
  parameterName: string;
  value: string;
}

export interface KnowledgeLocation {
  deliverableCode?: string;
  capabilityCode?: string;
  inputLocation?: string;
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

export async function resolveEffectiveParameters(profile: ProfileRow): Promise<EffectiveParameter[]> {
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

export async function extractProfileDetails(profile: ProfileRow): Promise<ProfileDetail> {
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
    additionalCapabilityCodes: d.additionalCapabilityCodes,
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

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const PACK_SELECTION_SLOTS: Array<{ field: keyof ProfileSeedInput; packCategory: string }> = [
  { field: "technologyPackCodes", packCategory: "Technology" },
  { field: "domainPackCodes", packCategory: "Domain" },
  { field: "compliancePackCodes", packCategory: "Compliance" },
  { field: "integrationPackCodes", packCategory: "Integration" },
  { field: "engineeringPackCodes", packCategory: "Engineering" },
  { field: "organisationPackCodes", packCategory: "Organisation" },
];

export async function getProfilePackSelections(profileId: string): Promise<Pick<ProfileSeedInput, "optionalPackCodes" | "technologyPackCodes" | "domainPackCodes" | "compliancePackCodes" | "integrationPackCodes" | "engineeringPackCodes" | "organisationPackCodes">> {
  const [optionalPackCodes, technologyPackCodes, domainPackCodes, compliancePackCodes, integrationPackCodes, engineeringPackCodes, organisationPackCodes] = await Promise.all([
    profilesDB.getPackSelection(profileId, "optional"),
    profilesDB.getPackSelection(profileId, "technology"),
    profilesDB.getPackSelection(profileId, "domain"),
    profilesDB.getPackSelection(profileId, "compliance"),
    profilesDB.getPackSelection(profileId, "integration"),
    profilesDB.getPackSelection(profileId, "engineering"),
    profilesDB.getPackSelection(profileId, "organisation"),
  ]);
  return {
    optionalPackCodes: optionalPackCodes.data ?? [],
    technologyPackCodes: technologyPackCodes.data ?? [],
    domainPackCodes: domainPackCodes.data ?? [],
    compliancePackCodes: compliancePackCodes.data ?? [],
    integrationPackCodes: integrationPackCodes.data ?? [],
    engineeringPackCodes: engineeringPackCodes.data ?? [],
    organisationPackCodes: organisationPackCodes.data ?? [],
  };
}

export async function validateProfileSeed(seed: ProfileSeedInput): Promise<ProfileValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.environment?.trim()) errors.push("environment is required");
  if (!SEMVER_RE.test(seed.profileVersion ?? "")) errors.push(`profileVersion must be semver (x.y.z), got: "${seed.profileVersion}"`);

  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? (await getPlatformTenantId()) };

  if (!seed.baseTemplateCode?.trim()) {
    errors.push("baseTemplateCode is required");
  } else {
    const { data: template } = await templatesDB.findActiveByCode(seed.baseTemplateCode, ontologyViewer.tenantId);
    if (!template) errors.push(`baseTemplateCode "${seed.baseTemplateCode}" does not resolve to a real Template`);
  }

  if (seed.baseTemplateCode?.trim()) {
    const overridableCandidates = await deriveOverridableParameterCandidates(seed.baseTemplateCode, ontologyViewer.tenantId);
    const overridableByKey = new Map(overridableCandidates.map((c) => [`${c.sourceType}::${c.sourceCode}::${c.parameterName}`, c]));
    for (const row of seed.exposedParameterOverrides ?? []) {
      const candidate = overridableByKey.get(`${row.sourceType}::${row.sourceCode}::${row.parameterName}`);
      if (!candidate) errors.push(`exposedParameterOverrides references "${row.parameterName}" on ${row.sourceType} "${row.sourceCode}" — not a parameter this Profile's base Template flags overridable`);
      else if (candidate.valueOptions && !candidate.valueOptions.includes(row.value)) errors.push(`exposedParameterOverrides "${row.parameterName}" has value "${row.value}" — must be one of ${candidate.valueOptions.join(", ")}`);
    }
  }

  for (const code of seed.optionalPackCodes ?? []) {
    const { data } = await packsDB.findByCode(code);
    if (!data) errors.push(`optionalPackCodes references unknown Pack code "${code}"`);
  }

  for (const slot of PACK_SELECTION_SLOTS) {
    const codes = (seed[slot.field] as string[] | undefined) ?? [];
    for (const code of codes) {
      const { data: pack } = await packsDB.findByCode(code);
      if (!pack) errors.push(`${String(slot.field)} references unknown Pack code "${code}"`);
      else if (pack.category !== slot.packCategory) errors.push(`${String(slot.field)} references Pack "${code}" whose category is "${pack.category}", not "${slot.packCategory}"`);
    }
  }

  for (const code of seed.featureFlagCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("feature-flag", code, ontologyViewer);
    if (!concept) errors.push(`featureFlagCodes references unknown feature-flag code "${code}"`);
  }

  for (const code of seed.additionalCapabilityCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("capability-name", code, ontologyViewer);
    if (!concept) errors.push(`additionalCapabilityCodes references unknown capability-name code "${code}"`);
  }

  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const value = (seed[cp.field] as string | undefined)?.trim();
    if (value) {
      const { data: valueConcept } = await ontologyDB.findConcept(cp.parameterCode, value, ontologyViewer);
      if (!valueConcept) errors.push(`${String(cp.field)} references unknown ${cp.parameterCode} code "${value}"`);
    }
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

  for (const code of seed.participatingOrganisationCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("participating-organisations", code, ontologyViewer);
    if (!concept) errors.push(`participatingOrganisationCodes references unknown participating-organisations code "${code}"`);
  }

  for (const [i, loc] of (seed.knowledgeLocations ?? []).entries()) {
    const hasDeliverable = !!loc.deliverableCode?.trim();
    const hasCapability = !!loc.capabilityCode?.trim();
    if (hasDeliverable === hasCapability) {
      errors.push(`knowledgeLocations[${i}] must name exactly one of deliverableCode/capabilityCode`);
      continue;
    }
    if (hasDeliverable) {
      const { data: concept } = await ontologyDB.findConcept("deliverable-name", loc.deliverableCode!.trim(), ontologyViewer);
      if (!concept) errors.push(`knowledgeLocations[${i}] references unknown deliverable-name code "${loc.deliverableCode}"`);
    } else {
      const { data: concept } = await ontologyDB.findConcept("capability-name", loc.capabilityCode!.trim(), ontologyViewer);
      if (!concept) errors.push(`knowledgeLocations[${i}] references unknown capability-name code "${loc.capabilityCode}"`);
    }
  }

  const seenOrders = new Set<number>();
  for (const [i, entry] of (seed.dispatchStrategyPreference ?? []).entries()) {
    if (!entry.strategy?.trim()) {
      errors.push(`dispatchStrategyPreference[${i}] must name a strategy`);
    } else {
      const { data: concept } = await ontologyDB.findConcept("dispatch-strategy-preference", entry.strategy.trim(), ontologyViewer);
      if (!concept) errors.push(`dispatchStrategyPreference[${i}] references unknown dispatch-strategy-preference code "${entry.strategy}"`);
    }
    if (seenOrders.has(entry.order)) errors.push(`dispatchStrategyPreference[${i}] duplicates order ${entry.order} — each entry needs a distinct order`);
    seenOrders.add(entry.order);
  }

  if (seed.redispatchMaxAttempts != null && seed.redispatchAttentionThreshold != null) {
    if (seed.redispatchMaxAttempts <= seed.redispatchAttentionThreshold) {
      errors.push(`redispatchMaxAttempts (${seed.redispatchMaxAttempts}) must be greater than redispatchAttentionThreshold (${seed.redispatchAttentionThreshold})`);
    }
  }

  if (seed.parentProfileId) {
    const { data: parent } = await profilesDB.findById(seed.parentProfileId);
    if (!parent) {
      errors.push(`parentProfileId "${seed.parentProfileId}" not found`);
    } else if (seed.code !== parent.code) {
      errors.push(`an inherited Profile must keep its parent's code ("${parent.code}") — Derived Profiles shall not modify parent Profiles (Ch.7 §9)`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type PublishProfileResult = { ok: true; profileId: string; alreadyExists?: boolean } | { ok: false; errors: string[] };

export async function publishProfile(input: { seed: ProfileSeedInput; actorRole: string; actorId: string }): Promise<PublishProfileResult> {
  const { seed, actorRole, actorId } = input;
  const validation = await validateProfileSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());

  const { data: template } = await templatesDB.findActiveByCode(seed.baseTemplateCode, tenantId);
  if (!template) return { ok: false, errors: [`baseTemplateCode "${seed.baseTemplateCode}" not found`] };

  const { data: existing } = await profilesDB.findByCodeAndVersion(seed.code, seed.profileVersion, tenantId);
  const { data: profileSchema } = await schemaDefinitionsDB.findLatest("Profile");
  if (!profileSchema) return { ok: false, errors: [`no schema_definitions grammar for Profile`] };
  if (!actorId) return { ok: false, errors: ["publishProfile requires a real actorId to author the Draft"] };
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "profile_define" });
  if (!auth.allowed) return { ok: false, errors: [`actor "${actorId}" does not hold profile_define`] };
  const { data: profileMaster } = await participantsMasterDB.findById(actorId);
  if (!profileMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const authorBadge = auth.via === "root" ? "root" : (auth.matchedBadge ?? "profile_define");
  if (existing) {
    const materialiseResult = await materialiseProfileDraft(existing.id, seed, profileMaster.id, authorBadge);
    if (!materialiseResult.ok) return materialiseResult;
    return { ok: true, profileId: existing.id, alreadyExists: true };
  }
  const { data: draft, error } = await profilesDB.createDraft({
    code: seed.code,
    name: seed.name,
    baseTemplateId: template.id,
    authoredBy: profileMaster.id,
    authorBadge,
    environment: seed.environment,
    profileVersion: seed.profileVersion,
    tenantId,
    parentProfileId: seed.parentProfileId,
    draftContent: { baseTemplateCode: seed.baseTemplateCode },
    schemaDefinitionId: profileSchema.id,
  });
  if (error || !draft) return { ok: false, errors: [(error ?? new Error("failed to create profile draft")).message] };

  const materialiseResult = await materialiseProfileDraft(draft.id, seed, profileMaster.id, authorBadge);
  if (!materialiseResult.ok) return materialiseResult;

  await eventBus.publish({
    eventType: "ProfileCreated",
    originatingObjectType: "Profile",
    originatingObjectId: draft.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: profileMaster.id,
    authorityBadge: authorBadge,
    payload: { code: draft.code, profileVersion: draft.profile_version },
  });

  let current = draft;
  for (let i = 0; i < 3; i++) {
    const result = await advanceProfileOneStep(current, actorRole, actorId);
    if (!result.ok) return { ok: false, errors: [`advancing Profile "${current.code}" from "${current.status}" failed: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`] };
    current = result.profile;
  }

  return { ok: true, profileId: current.id };
}

export type TransitionProfileResult = { ok: true; profile: ProfileRow } | { ok: false; reason: string; detail?: string };

const TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

export async function transitionProfile(input: { profileId: string; targetState: ProfileRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionProfileResult> {
  const { data: profile } = await profilesDB.findById(input.profileId);
  if (!profile) return { ok: false, reason: "not_found" };
  const fromState = profile.status;
  if (!input.actorId) throw new Error("actorId is required to transition a Profile");
  const gate = await transitionEngine.evaluate({ entityType: "Profile", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, entityId: profile.id, context: { profile } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Profile ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    if (!gate.authorityBadge) return { ok: false, reason: "policy_blocked", detail: "no authority badge resolved for this Profile reactivation" };
    return reactivateAsNewVersion(profile, input.actorRole, input.actorId, gate.authorityBadge);
  }

  const { data: updated, error } = await profilesDB.updateStatus(profile.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update profile status");
  await eventBus.publish({
    eventType: gate.eventType ?? "ProfileTransitioned",
    originatingObjectType: "Profile",
    originatingObjectId: profile.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: profile.code },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge ?? "root",
    versionEvent: gate.versionEvent,
    fromState,
    toState: input.targetState,
    tenantId: profile.tenant_id,
  });
  return { ok: true, profile: updated };
}

async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    const { data: existing } = await profilesDB.findByCodeAndVersion(code, candidate, tenantId);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for Profile ${code} after bumping from ${fromVersion}`);
}

async function reactivateAsNewVersion(profile: ProfileRow, actorRole: string, actorId: string, authorBadge: string): Promise<TransitionProfileResult> {
  const nextVersion = await nextAvailablePatchVersion(profile.code, profile.profile_version, profile.tenant_id);
  const { data: template } = await templatesDB.findById(profile.base_template_id);
  if (!template) return { ok: false, reason: "policy_blocked", detail: `base Template ${profile.base_template_id} no longer exists` };

  const packSelections = await getProfilePackSelections(profile.id);

  const priorContent = (profile.draft_content ?? {}) as Record<string, unknown>;
  const seed: ProfileSeedInput = {
    code: profile.code,
    name: profile.name,
    baseTemplateCode: template.code,
    environment: profile.environment,
    profileVersion: nextVersion,
    tenantId: profile.tenant_id,
    parentProfileId: profile.parent_profile_id,
    description: typeof priorContent.description === "string" ? priorContent.description : undefined,
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? (priorContent.compositionOptions as Record<string, unknown>) : undefined,
    deploymentTargets: typeof priorContent.deploymentTargets === "object" && priorContent.deploymentTargets ? (priorContent.deploymentTargets as Record<string, unknown>) : undefined,
    environmentConfiguration: typeof priorContent.environmentConfiguration === "object" && priorContent.environmentConfiguration ? (priorContent.environmentConfiguration as Record<string, unknown>) : undefined,
    readme: typeof priorContent.readme === "string" ? priorContent.readme : undefined,
    redispatchMaxAttempts: typeof priorContent.redispatchMaxAttempts === "number" ? priorContent.redispatchMaxAttempts : undefined,
    redispatchAttentionThreshold: typeof priorContent.redispatchAttentionThreshold === "number" ? priorContent.redispatchAttentionThreshold : undefined,
    ...packSelections,
  };
  seed.featureFlagCodes = Array.isArray(priorContent.featureFlagCodes)
    ? (priorContent.featureFlagCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { featureCode?: string })?.featureCode ?? "")).filter((v) => v !== "")
    : [];
  seed.additionalCapabilityCodes = Array.isArray(priorContent.additionalCapabilityCodes)
    ? (priorContent.additionalCapabilityCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { capabilityCode?: string })?.capabilityCode ?? "")).filter((v) => v !== "")
    : [];
  seed.participatingOrganisationCodes = Array.isArray(priorContent.participatingOrganisationCodes)
    ? (priorContent.participatingOrganisationCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { organisationCode?: string })?.organisationCode ?? "")).filter((v) => v !== "")
    : [];
  seed.knowledgeLocations = Array.isArray(priorContent.knowledgeLocations) ? (priorContent.knowledgeLocations as KnowledgeLocation[]) : [];
  seed.dispatchStrategyPreference = Array.isArray(priorContent.dispatchStrategyPreference) ? (priorContent.dispatchStrategyPreference as DispatchStrategyPreferenceEntry[]) : [];
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") (seed as unknown as Record<string, unknown>)[cp.field as string] = priorValue;
  }
  seed.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? (priorContent.exposedParameterOverrides as ExposedParameterOverride[]) : [];

  const { data: reactivationSchema } = profile.schema_definition_id ? { data: { id: profile.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Profile");
  if (!reactivationSchema) return { ok: false, reason: "policy_blocked", detail: `no schema_definitions grammar for Profile` };
  if (!actorId) return { ok: false, reason: "policy_blocked", detail: "reactivation requires a real actorId to author the new Version's Draft" };
  if (!authorBadge) return { ok: false, reason: "policy_blocked", detail: "no authority badge resolved for this Profile reactivation" };
  const { data: reactivateMaster } = await participantsMasterDB.findById(actorId);
  if (!reactivateMaster) return { ok: false, reason: "policy_blocked", detail: `No superuser provisioned.` };
  const { data: newDraft, error } = await profilesDB.createDraft({
    code: seed.code,
    name: seed.name,
    baseTemplateId: template.id,
    environment: seed.environment,
    authoredBy: reactivateMaster.id,
    authorBadge,
    draftContent: { ...seed },
    profileVersion: nextVersion,
    tenantId: profile.tenant_id,
    parentProfileId: profile.parent_profile_id,
    schemaDefinitionId: reactivationSchema.id,
  });
  if (error || !newDraft) return { ok: false, reason: "policy_blocked", detail: (error ?? new Error("failed to create new Profile version")).message };

  const materialiseResult = await materialiseProfileDraft(newDraft.id, seed, reactivateMaster.id, authorBadge);
  if (!materialiseResult.ok) return { ok: false, reason: "policy_blocked", detail: materialiseResult.errors.join("; ") };

  let current = newDraft;
  for (const targetState of ["Validated", "Published", "Active"] as const) {
    const result = await transitionProfile({ profileId: current.id, targetState, actorRole, actorId });
    if (!result.ok) return result;
    current = result.profile;
  }

  const { data: previousActive } = await profilesDB.findActiveByCode(profile.code, profile.tenant_id);
  if (previousActive && previousActive.id !== current.id) {
    await transitionProfile({ profileId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
  }

  return { ok: true, profile: current };
}

export async function copyProfileAsNewDraft(profileId: string, actorId: string, authorBadge: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
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
  const additionalCapabilityCodes = Array.isArray(priorContent.additionalCapabilityCodes)
    ? (priorContent.additionalCapabilityCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { capabilityCode?: string })?.capabilityCode ?? "")).filter((v) => v !== "")
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
    additionalCapabilityCodes,
    participatingOrganisationCodes,
    knowledgeLocations,
    dispatchStrategyPreference,
  };
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") draftContent[cp.field as string] = priorValue;
  }
  draftContent.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? priorContent.exposedParameterOverrides : [];
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Profile");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Profile`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const { data: newDraft, error } = await profilesDB.createDraft({
    code: source.code,
    name: source.name,
    baseTemplateId: template.id,
    environment: source.environment,
    authoredBy: copyMaster.id,
    authorBadge,
    draftContent,
    profileVersion: nextVersion,
    tenantId: source.tenant_id,
    parentProfileId: source.parent_profile_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Profile")).message] };
  return { ok: true, draftId: newDraft.id };
}

const AUTHORING_NEXT_STATE: Partial<Record<ProfileRow["status"], ProfileRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceProfileOneStep(profile: ProfileRow, actorRole: string, actorId: string ): Promise<TransitionProfileResult> {
  const targetState = AUTHORING_NEXT_STATE[profile.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Profile is already ${profile.status} — no further authoring step` };

  if (targetState === "Active") {
    const { data: previousActive } = await profilesDB.findActiveByCode(profile.code, profile.tenant_id);
    const activateResult = await transitionProfile({ profileId: profile.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return activateResult;
    if (previousActive && previousActive.id !== activateResult.profile.id) {
      await transitionProfile({ profileId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
    }
    return activateResult;
  }

  return transitionProfile({ profileId: profile.id, targetState, actorRole, actorId });
}

export async function materialiseProfileDraft(profileId: string, seed: ProfileSeedInput, authorId: string, authorBadge: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  await profilesDB.setPackSelection(profileId, "optional", seed.optionalPackCodes ?? [], authorId, authorBadge);
  await profilesDB.setPackSelection(profileId, "technology", seed.technologyPackCodes ?? [], authorId, authorBadge);
  await profilesDB.setPackSelection(profileId, "domain", seed.domainPackCodes ?? [], authorId, authorBadge);
  await profilesDB.setPackSelection(profileId, "compliance", seed.compliancePackCodes ?? [], authorId, authorBadge);
  await profilesDB.setPackSelection(profileId, "integration", seed.integrationPackCodes ?? [], authorId, authorBadge);
  await profilesDB.setPackSelection(profileId, "engineering", seed.engineeringPackCodes ?? [], authorId, authorBadge);
  await profilesDB.setPackSelection(profileId, "organisation", seed.organisationPackCodes ?? [], authorId, authorBadge);
  const { error } = await profilesDB.setDraftContent(profileId, { ...seed });
  if (error) return { ok: false, errors: [error.message] };
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
