import { templatesDB } from "../../../dblayer/templatesDB.js";
import { deriveOverridableParameterCandidates, extractExposedParameters } from "./templates.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { ProfileRow } from "../../../dblayer/seuTypes.js";

export async function createProfile(input: {
  templateId: string;
  environment?: string;
}): Promise<ProfileRow> {
  const { data: template, error: templateErr } = await templatesDB.findById(input.templateId);
  if (templateErr) throw templateErr;
  if (!template) throw new Error(`template not found: ${input.templateId}`);

  const { data: profile, error } = await profilesDB.create({
    baseTemplateId: template.id,
    environment: input.environment,
  });
  if (error || !profile) throw error ?? new Error("failed to create profile");
  return profile;
}

// profilesDB.create's own throwaway-code shape ("profile-<timestamp>-<random>")
// — distinguishes a real, human/SDK-authored Profile (any other code) from
// one synthesized by this exact fallback, so a past throwaway never gets
// mistaken for a real one on a later commissioning.
const THROWAWAY_PROFILE_CODE = /^profile-\d+-[a-z0-9]+$/;

// Real, human/SDK-authored Profiles for a Template — excludes throwaways.
// Exposed so a real UI can offer a choice when more than one exists, instead
// of a heuristic silently picking one (the gap findOrCreateDefaultProfile's
// own fallback used to paper over — see getObjectiveDetail's own
// commissioningOptions, core/objectives.ts, the first real caller of this).
export async function listRealProfilesForTemplate(templateId: string): Promise<ProfileRow[]> {
  const { data: existing } = await profilesDB.findByBaseTemplateId(templateId);
  return (existing ?? []).filter((p) => !THROWAWAY_PROFILE_CODE.test(p.code));
}

// Ebook Library — Full Demo Walkthrough.md, real finding #3: both
// commissioning paths (commissionFromForm, commissionFromExistingObjective)
// always called createProfile directly, synthesizing a brand-new throwaway
// Profile every time — so a Profile hand-authored through the SDK UI
// (declaring optional Packs, config parameters) was never actually reachable
// from commissioning; nothing put it to use. Fixed by preferring a real,
// already-published Profile for this Template if one exists (development-
// environment one if there's a choice, matching the throwaway fallback's own
// environment default; otherwise the first real one found) — only
// synthesizing a throwaway Profile when genuinely none exists yet, same
// fallback behaviour as before.
//
// This heuristic fallback is now only reached when the caller doesn't (or
// can't) offer a real choice — commissionFromExistingObjective's web route
// does, via listRealProfilesForTemplate + a real dropdown, closing the gap
// this function's own comment used to flag as unsolved. commissionFromForm's
// quick one-shot path still has no natural seam for a live picker (it
// matches a Template at submit time, not before), so it still falls all the
// way through to this default.
export async function findOrCreateDefaultProfile(templateId: string): Promise<ProfileRow> {
  const real = await listRealProfilesForTemplate(templateId);
  if (real.length > 0) {
    return real.find((p) => p.environment === "development") ?? real[0]!;
  }
  return createProfile({ templateId, environment: "development" });
}

// SDK UI Layer Plan — Profile's structural + referential check, same
// reasoning as validatePackSeed/validateTemplateSeed. Ch.7 grounding: the
// full §7 field set, as built (owner, 2026-08-19: "all missing fields have
// to be fixed at schema level").
export interface ProfileSeedInput {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  optionalPackCodes?: string[];
  // Profile identity foundation (owner, 2026-08-19) — mirrors PackSeedInput/
  // TemplateSeedInput's own tenantId/parentXId/versioning shape exactly.
  profileVersion: string;
  tenantId?: string;
  parentProfileId?: string | null;
  // The remaining §7 fields this pass adds.
  description?: string;
  featureFlagCodes?: string[];
  compositionOptions?: Record<string, unknown>;
  technologyPackCodes?: string[];
  domainPackCodes?: string[];
  compliancePackCodes?: string[];
  integrationPackCodes?: string[];
  // CR-091 — Ch.7 §7 completion: the other two of Pack's six real
  // category:pack values (Template's own PACK_SELECTION_SLOTS already covers
  // all six; Profile only had four).
  engineeringPackCodes?: string[];
  organisationPackCodes?: string[];
  // CR-091 — Ch.7 §5 "Deployment targets" (distinct from `environment`): a
  // free-form JSON bag for CI/CD-pipeline-specific target details, no real
  // column, lives only in draft_content (same treatment as compositionOptions).
  deploymentTargets?: Record<string, unknown>;
  // CR-091 — Ch.7 §5 "Optional capability enablement": capability-name codes
  // this Profile enables beyond whatever its base Template already requires.
  // No real column, lives only in draft_content (same treatment as
  // featureFlagCodes).
  additionalCapabilityCodes?: string[];
  // CR-091 Part 2 — Ch.7 §10 Configuration Parameters. Each its own explicit
  // field (not a generic {parameterCode, value} list — owner: "why are we
  // moving away from a schema definition for profile?"), Ontology-backed,
  // sourced from a concept type named identically to its own
  // profile-configuration code (migration 174). Whether each is mandatory is
  // NOT expressed here — it's resolved per-tenant off the profile-configuration
  // concept's own is_mandatory flag (validateProfileSeed), not a static
  // required list.
  targetCloudProvider?: string;
  primaryProgrammingLanguage?: string;
  sourceControlProvider?: string;
  deploymentStrategy?: string;
  aiProviderPreference?: string;
  defaultRepositoryStructure?: string;
  documentationLevel?: string;
  developmentMethodology?: string;
  // Ch.7 §5/§12 Participating Organisations — no seeded values yet (owner:
  // "populated when implementing multi-tenancy"); the field/mechanism exists
  // now regardless.
  participatingOrganisationCodes?: string[];
  // Ch.7 §5/§10 Environment Configuration — free-form JSON (owner: "has to
  // be a json that is free text written by the user. Similar to deployment
  // targets"), no Ontology concept type behind it at all.
  environmentConfiguration?: Record<string, unknown>;
  // CR-088 Profile-side completion (owner, 2026-09-05: "the overrides have to
  // be saved in the profile") — this Profile's own value for whichever of its
  // base Template's exposed parameters the Template flagged overridable. No
  // real column, lives only in draft_content (same treatment as
  // deploymentTargets). Deliberately sparse — omitted candidates fall back to
  // the Template's own value, unlike Template's own exposedParameters which
  // records every candidate regardless.
  exposedParameterOverrides?: ExposedParameterOverride[];
}

// CR-088 Profile-side completion — one row per parameter this Profile
// actually overrides. Scoped to value-bearing candidates only (Service Level
// metric, Policy constraintType); the list/filter-shaped ones a Template may
// also flag overridable (Policy applicability dimensions, Checklist
// configurableKey) have no value for a Profile to set here — Template itself
// never sets one for those either (deriveExposableParameterCandidates,
// core/templates.ts). No `overridable` flag of its own — that's the
// Template's own decision (already recorded there), not something Profile
// restates.
export interface ExposedParameterOverride {
  sourceType: "service" | "policy" | "checklist" | "dependency";
  sourceCode: string;
  parameterName: string;
  value: string;
}

// CR-092 Part 6 — exposedParameterOverrides lives only in draft_content (same
// non-column treatment as Template's own exposedParameters,
// extractExposedParameters in core/templates.ts); exported so
// compositionEngine.ts can read a Profile's own overrides when checking for
// cross-Profile parameter conflicts (owner: "There can be 2 profiles
// overriding the same config parameter to 2 different values. All of these
// have to surface here.") without duplicating this same
// Array.isArray(...)-or-[] check a third time.
export function extractExposedParameterOverrides(draftContent: Record<string, unknown> | null): ExposedParameterOverride[] {
  return Array.isArray(draftContent?.exposedParameterOverrides) ? (draftContent!.exposedParameterOverrides as ExposedParameterOverride[]) : [];
}

// CR-088's own explicitly-deferred resolution step (owner, 2026-09-06, the
// TCS analogy: "org standard says 100% milestone meet, project can relax it
// to 90%... When you commission from a profile, you are basically taking
// everything that is used for creating the profile in the first place. And
// if there are overrides, you take the overrides. You do not have to save
// what is already in the template as the template_id is the reference to
// it.") — a pure computed merge, no new storage: for every value-bearing
// parameter this Profile's base Template exposes (extractExposedParameters,
// core/templates.ts — the Template's own canonical/enterprise value),
// the effective value is this Profile's own override
// (extractExposedParameterOverrides above) where one exists AND the
// Template left that parameter overridable, else the Template's own value,
// resolved fresh by walking base_template_id — never duplicated onto the
// Profile or anywhere else.
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

// CR-092 Part 6 (owner: "On the Validation page, list all the profile
// details. Not the heading or meta data. ALL THE DETAILS.") — every
// substantive field a Profile can carry (ProfileSeedInput's own full field
// set, Ch.7), excluding pure identity/administrative metadata (id, code,
// name, version, tenant, lineage, status, author, timestamps, category,
// base_template_id — already shown as this Profile's own "heading"
// elsewhere on the page). A generic key->value dump, not a hand-picked
// subset, on purpose: a field added to ProfileSeedInput later shows up here
// automatically instead of silently staying invisible the way
// exposedParameterOverrides alone used to be the only thing surfaced.
// Empty/unset fields are omitted — "ALL THE DETAILS" means everything this
// Profile actually set, not a fixed list of blanks.
export interface ProfileDetail {
  profileId: string;
  profileCode: string;
  profileName: string;
  fields: Record<string, unknown>;
  // Owner (2026-09-06: "Where is the pack information? where are the
  // exposed parameters?... if there are overrides, you take the overrides.
  // You do not have to save what is already in the template as the
  // template_id is the reference to it") — the resolved, effective value
  // for every value-bearing parameter this Profile's base Template exposes
  // (resolveEffectiveParameters below: Profile's own override where one
  // exists, else the Template's own value), shown regardless of whether
  // this Profile overrides anything. Kept separate from `fields` (never
  // omitted when empty) because an empty result means something genuinely
  // different from "this Profile set nothing" — it means the base Template
  // itself exposes nothing at all yet.
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
    // Bug fix (owner, 2026-09-06: "Where is the pack information?... I am
    // unsure why you are being selective about what you want to process") —
    // optionalPackCodes was the one ProfileSeedInput field missing from this
    // map entirely; the six category-scoped Pack slots below were already
    // here, but the flat optionalPackCodes list (a real Pack selection,
    // composed exactly like the other six — compositionEngine.ts) was
    // silently dropped.
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
    exposedParameterOverrides: extractExposedParameterOverrides(profile.draft_content),
  };
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (!isEmptyDetailValue(value)) fields[key] = value;
  }
  const effectiveParameters = await resolveEffectiveParameters(profile);
  return { profileId: profile.id, profileCode: profile.code, profileName: profile.name, fields, effectiveParameters };
}

// CR-091 Part 2 — one row per single-value Configuration Parameter: `field`
// is the ProfileSeedInput property, `parameterCode` is BOTH its
// profile-configuration code (for the is_mandatory lookup) AND its own
// value concept type name (they're the same string by design — see
// migration 174/175's own comments). Exported so web/sdkAuthoring.ts's
// render-time asterisk override can use the exact same list validation does.
export const CONFIGURATION_PARAMETER_FIELDS: Array<{ field: keyof ProfileSeedInput; parameterCode: string }> = [
  { field: "targetCloudProvider", parameterCode: "target-cloud-provider" },
  { field: "primaryProgrammingLanguage", parameterCode: "primary-programming-language" },
  { field: "sourceControlProvider", parameterCode: "source-control-provider" },
  { field: "deploymentStrategy", parameterCode: "deployment-strategy" },
  { field: "aiProviderPreference", parameterCode: "ai-provider-preference" },
  { field: "defaultRepositoryStructure", parameterCode: "default-repository-structure" },
  { field: "documentationLevel", parameterCode: "documentation-level" },
  { field: "developmentMethodology", parameterCode: "development-methodology" },
];

export type ProfileValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

// Pack's own §8 category:pack vocabulary already carries exactly these four
// names (Compliance/Domain/Engineering/Integration/Organisation/Technology) —
// each of Profile's four category-scoped Pack-selection fields checks the
// resolved Pack's OWN category actually matches the slot it was put in, not
// just that the code resolves to *some* Pack.
const PACK_SELECTION_SLOTS: Array<{ field: keyof ProfileSeedInput; packCategory: string }> = [
  { field: "technologyPackCodes", packCategory: "Technology" },
  { field: "domainPackCodes", packCategory: "Domain" },
  { field: "compliancePackCodes", packCategory: "Compliance" },
  { field: "integrationPackCodes", packCategory: "Integration" },
  { field: "engineeringPackCodes", packCategory: "Engineering" },
  { field: "organisationPackCodes", packCategory: "Organisation" },
];

// CR-045 follow-up — the real, join-table-backed Pack selections (unlike
// description/featureFlagCodes/compositionOptions, which have no real column
// and live only in draft_content). Shared by reactivateAsNewVersion,
// copyProfileAsNewDraft, and getAuthoringDraft's Profile branch — all three
// need "what is this Profile's Pack selection, regardless of whether
// draft_content was ever written" (a Profile created outside the authoring
// form, e.g. seedSdlcStandardTemplates.ts, never writes draft_content at all).
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

  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? PLATFORM_TENANT_ID };

  if (!seed.baseTemplateCode?.trim()) {
    errors.push("baseTemplateCode is required");
  } else {
    const { data: template } = await templatesDB.findByCode(seed.baseTemplateCode);
    if (!template) errors.push(`baseTemplateCode "${seed.baseTemplateCode}" does not resolve to a real Template`);
  }

  // CR-088 Profile-side completion — each override must resolve against a
  // real, currently-overridable candidate off this Profile's base Template
  // (mirrors Template's own exposedParameters validation, core/templates.ts,
  // against deriveOverridableParameterCandidates instead of
  // deriveExposableParameterCandidates).
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
    if (!concept?.is_active) errors.push(`featureFlagCodes references unknown feature-flag code "${code}"`);
  }

  // CR-091 — Ch.7 §5 Optional Capability Enablement: each code must be a
  // real, active capability-name concept — same baseline check as every
  // other Ontology-backed field. "Not already there coming from the
  // templates" (owner) is a candidate-list curation at the authoring route
  // (web/sdkAuthoring.ts), not enforced here — a resubmission of an
  // already-Template-covered code is redundant, not wrong.
  for (const code of seed.additionalCapabilityCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("capability-name", code, ontologyViewer);
    if (!concept?.is_active) errors.push(`additionalCapabilityCodes references unknown capability-name code "${code}"`);
  }

  // CR-091 Part 2 — each Configuration Parameter's own value (if set) must
  // resolve to a real, active concept under its own value-vocabulary
  // concept type. Whether it's REQUIRED is a separate, per-tenant question —
  // resolved off the profile-configuration concept's own is_mandatory flag,
  // not a static schema.required entry (owner: "let Ontology specify if a
  // parameter is mandatory or otherwise. So a tenant can override it").
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const value = (seed[cp.field] as string | undefined)?.trim();
    if (value) {
      const { data: valueConcept } = await ontologyDB.findConcept(cp.parameterCode, value, ontologyViewer);
      if (!valueConcept?.is_active) errors.push(`${String(cp.field)} references unknown ${cp.parameterCode} code "${value}"`);
    }
    const { data: parameterConcept } = await ontologyDB.findConcept("profile-configuration", cp.parameterCode, ontologyViewer);
    if (parameterConcept?.is_mandatory && !value) {
      errors.push(`${String(cp.field)} is required (a mandatory Configuration Parameter for this tenant)`);
    }
  }

  // Ch.7 §5/§12 Participating Organisations — same baseline Ontology check;
  // no seeded values exist yet, so any non-empty submission fails today,
  // which is correct until multi-tenancy adds real concepts to pick from.
  for (const code of seed.participatingOrganisationCodes ?? []) {
    const { data: concept } = await ontologyDB.findConcept("participating-organisations", code, ontologyViewer);
    if (!concept?.is_active) errors.push(`participatingOrganisationCodes references unknown participating-organisations code "${code}"`);
  }

  // Ch.7 §9 Profile Inheritance (owner, 2026-08-19: "19.2 and 19.3 has to be
  // fixed similar to pack and template") — a Derived Profile keeps its
  // parent's own code (Option A, mirroring CR-026's Template Inheritance
  // identity model exactly: same code, disambiguated by tenant_id, not a new
  // identity per generation). Unlike Template's mandatory-Packs-superset
  // rule, Profile has no "mandatory" concept at all — every one of its Pack
  // selections is optional by definition (§5: "Profiles may define... selected
  // Packs" — nothing on Profile is a structural floor the way Template's
  // mandatoryPackCodes is), so §9's own rules ("add Packs; remove optional
  // Packs; override configuration values") need no additional validator
  // beyond the identity lock — removing an optional Pack a parent had is
  // explicitly allowed, not a violation to catch.
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

export type PublishProfileResult = { ok: true; profileId: string } | { ok: false; errors: string[] };

// Ch.41 VM-002-style immutability (owner, 2026-08-19), mirroring publishPack/
// publishTemplate: profilesDB.upsert's ON CONFLICT target is now
// (code, profile_version, tenant_id) — a second call with the same code but a
// different profileVersion (or a different owning tenant) creates a new row
// rather than overwriting.
export async function publishProfile(seed: ProfileSeedInput): Promise<PublishProfileResult> {
  const validation = await validateProfileSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: template } = await templatesDB.findByCode(seed.baseTemplateCode);
  if (!template) return { ok: false, errors: [`baseTemplateCode "${seed.baseTemplateCode}" not found`] };

  const { data: profile, error } = await profilesDB.upsert({
    code: seed.code,
    name: seed.name,
    baseTemplateId: template.id,
    environment: seed.environment,
    profileVersion: seed.profileVersion,
    tenantId: seed.tenantId,
  });
  if (error || !profile) return { ok: false, errors: [(error ?? new Error("failed to upsert profile")).message] };

  await materialiseProfileDraft(profile.id, seed);

  // Ch.7 §15 (owner, 2026-08-19: "Fix 19.9 similar to what we did for pack
  // and template") — mirrors PackRegistered/TemplateCreated exactly,
  // including the same asymmetry: fires from this "proper" publish entry
  // point, not from interactive authoring's createAuthoringDraft.
  await eventBus.publish({
    eventType: "ProfileCreated",
    originatingObjectType: "Profile",
    originatingObjectId: profile.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { code: profile.code, profileVersion: profile.profile_version },
  });

  return { ok: true, profileId: profile.id };
}

// Entity-direct authoring (bug fix correcting CR-014): a governed status
// transition on a Profile, authorised on its own noun × verb (Draft -> Active is
// verb `publish` → profile_publish) under the REAL actor, actor + badge captured
// on the event. Mirrors transitionPack/transitionTemplate.
export type TransitionProfileResult = { ok: true; profile: ProfileRow } | { ok: false; reason: string; detail?: string };

// Ch.41 VM-002 "Versions are immutable" (owner, 2026-08-19, mirroring
// transitionTemplate/transitionPack exactly) — reactivating a Deprecated/
// Retired/Archived Profile back to Active never resurrects the old row; it
// publishes a brand new Version carrying the same content, auto-bumping the
// patch number, then walks it through Draft -> Validated -> Published ->
// Active — which also supersedes whatever else is currently Active for this
// code (within the same tenant). The old row itself is untouched.
const TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

// Ch.7 §15 (owner, 2026-08-19) — real per-state-named events, mirroring
// core/templates.ts's own EVENT_BY_TARGET_STATE exactly. §15's own text
// names six events and omits "ProfileArchived" — the same omission Pack/
// Template's chapters had (treated there as an oversight, not a deliberate
// difference) — included here for real parity, not followed literally.
const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "ProfileValidated",
  Published: "ProfilePublished",
  Active: "ProfileActivated",
  Deprecated: "ProfileDeprecated",
  Retired: "ProfileRetired",
  Archived: "ProfileArchived",
};

export async function transitionProfile(input: { profileId: string; targetState: ProfileRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionProfileResult> {
  const { data: profile } = await profilesDB.findById(input.profileId);
  if (!profile) return { ok: false, reason: "not_found" };
  const fromState = profile.status;
  const gate = await transitionEngine.evaluate({ entityType: "Profile", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, context: { profile } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Profile ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    return reactivateAsNewVersion(profile, input.actorRole, input.actorId);
  }

  const { data: updated, error } = await profilesDB.updateStatus(profile.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update profile status");
  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "ProfileTransitioned",
    originatingObjectType: "Profile",
    originatingObjectId: profile.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: profile.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, profile: updated };
}

// Scoped to the reactivating Profile's own tenant — a bumped version only
// needs to dodge THIS tenant's own existing rows, mirrors
// core/templates.ts's own nextAvailablePatchVersion exactly.
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

// Clones an existing (terminal) Profile row's full authored content into a
// brand-new Draft at the next available patch version, then drives it
// straight through Draft -> Validated -> Published -> Active under the same
// actor — mirrors reactivateAsNewVersion in core/templates.ts/core/packs.ts
// exactly. `description`/`featureFlagCodes`/`compositionOptions` live only in
// draft_content, not real columns, so they're carried through explicitly.
async function reactivateAsNewVersion(profile: ProfileRow, actorRole: string, actorId: string | undefined): Promise<TransitionProfileResult> {
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
    // Reactivation is versioning, not a change of ownership or lineage —
    // mirrors reactivateAsNewVersion's own tenantId/parentTemplateId
    // treatment in core/templates.ts exactly.
    tenantId: profile.tenant_id,
    parentProfileId: profile.parent_profile_id,
    description: typeof priorContent.description === "string" ? priorContent.description : undefined,
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? (priorContent.compositionOptions as Record<string, unknown>) : undefined,
    // CR-091 — deploymentTargets/environmentConfiguration have no real
    // column either, same treatment as compositionOptions.
    deploymentTargets: typeof priorContent.deploymentTargets === "object" && priorContent.deploymentTargets ? (priorContent.deploymentTargets as Record<string, unknown>) : undefined,
    environmentConfiguration: typeof priorContent.environmentConfiguration === "object" && priorContent.environmentConfiguration ? (priorContent.environmentConfiguration as Record<string, unknown>) : undefined,
    ...packSelections,
  };
  // featureFlagCodes has no real column/join table of its own to re-derive
  // from (unlike the Pack-selection slots above) — it only ever lived in
  // draft_content, so it's carried through from there directly.
  seed.featureFlagCodes = Array.isArray(priorContent.featureFlagCodes)
    ? (priorContent.featureFlagCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { featureCode?: string })?.featureCode ?? "")).filter((v) => v !== "")
    : [];
  // CR-091 — additionalCapabilityCodes/participatingOrganisationCodes, same
  // no-real-column treatment.
  seed.additionalCapabilityCodes = Array.isArray(priorContent.additionalCapabilityCodes)
    ? (priorContent.additionalCapabilityCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { capabilityCode?: string })?.capabilityCode ?? "")).filter((v) => v !== "")
    : [];
  seed.participatingOrganisationCodes = Array.isArray(priorContent.participatingOrganisationCodes)
    ? (priorContent.participatingOrganisationCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { organisationCode?: string })?.organisationCode ?? "")).filter((v) => v !== "")
    : [];
  // CR-091 Part 2 — the eight single-value Configuration Parameters, same
  // no-real-column treatment, one field at a time (each a plain string, not
  // an array/object needing the map/filter dance the fields above do).
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") (seed as unknown as Record<string, unknown>)[cp.field as string] = priorValue;
  }
  // CR-088 Profile-side completion — exposedParameterOverrides, same
  // no-real-column carry-forward treatment.
  seed.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? (priorContent.exposedParameterOverrides as ExposedParameterOverride[]) : [];

  const { data: newDraft, error } = await profilesDB.createDraft({
    code: seed.code,
    name: seed.name,
    baseTemplateId: template.id,
    environment: seed.environment,
    authoredBy: profile.authored_by,
    draftContent: { ...seed },
    profileVersion: nextVersion,
    tenantId: profile.tenant_id,
    parentProfileId: profile.parent_profile_id,
  });
  if (error || !newDraft) return { ok: false, reason: "policy_blocked", detail: (error ?? new Error("failed to create new Profile version")).message };

  await materialiseProfileDraft(newDraft.id, seed);

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

// Registry "Copy" action (owner, 2026-08-19: "Add a Copy button... enabled
// for users that have *_define badge. It should create a copy and bump up
// the version"). Same content reconstruction as reactivateAsNewVersion above,
// but stops at Draft instead of driving straight through to Active, and
// works from any status (not just terminal) — mirrors copyTemplateAsNewDraft
// exactly. (Pack's own copyPackAsNewDraft was removed under CR-081, once its
// job became reachable through Pack's "New" form's own branch picker
// instead — Profile/Template haven't been given that same treatment.)
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
  // CR-091 — additionalCapabilityCodes/participatingOrganisationCodes, same
  // no-real-column treatment as featureFlagCodes.
  const additionalCapabilityCodes = Array.isArray(priorContent.additionalCapabilityCodes)
    ? (priorContent.additionalCapabilityCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { capabilityCode?: string })?.capabilityCode ?? "")).filter((v) => v !== "")
    : [];
  const participatingOrganisationCodes = Array.isArray(priorContent.participatingOrganisationCodes)
    ? (priorContent.participatingOrganisationCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { organisationCode?: string })?.organisationCode ?? "")).filter((v) => v !== "")
    : [];
  const draftContent: Record<string, unknown> = {
    code: source.code,
    name: source.name,
    baseTemplateCode: template.code,
    environment: source.environment,
    description: typeof priorContent.description === "string" ? priorContent.description : undefined,
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? (priorContent.compositionOptions as Record<string, unknown>) : undefined,
    // CR-091 — deploymentTargets/environmentConfiguration, same
    // no-real-column treatment.
    deploymentTargets: typeof priorContent.deploymentTargets === "object" && priorContent.deploymentTargets ? (priorContent.deploymentTargets as Record<string, unknown>) : undefined,
    environmentConfiguration: typeof priorContent.environmentConfiguration === "object" && priorContent.environmentConfiguration ? (priorContent.environmentConfiguration as Record<string, unknown>) : undefined,
    ...packSelections,
    featureFlagCodes,
    additionalCapabilityCodes,
    participatingOrganisationCodes,
  };
  // CR-091 Part 2 — the eight single-value Configuration Parameters.
  for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
    const priorValue = priorContent[cp.field as string];
    if (typeof priorValue === "string") draftContent[cp.field as string] = priorValue;
  }
  // CR-088 Profile-side completion — exposedParameterOverrides, same
  // no-real-column carry-forward treatment.
  draftContent.exposedParameterOverrides = Array.isArray(priorContent.exposedParameterOverrides) ? priorContent.exposedParameterOverrides : [];
  const { data: newDraft, error } = await profilesDB.createDraft({
    code: source.code,
    name: source.name,
    baseTemplateId: template.id,
    environment: source.environment,
    authoredBy: Number(actorId),
    draftContent,
    profileVersion: nextVersion,
    tenantId: source.tenant_id,
    parentProfileId: source.parent_profile_id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Profile")).message] };
  return { ok: true, draftId: newDraft.id };
}

// Entity-direct authoring, one hop at a time (mirrors advancePackOneStep /
// advanceTemplateOneStep, Ch.5 §19.13 / Ch.6 §20.2) — added 2026-08-18
// alongside the seed change that gave Profile the same six-hop lifecycle Pack
// already has (transitionDefinitions.json / authorityVocabulary.json).
// Replaces the old publishProfileDraft, which hardcoded a direct jump to
// "Active" — the only target state that existed before this seed change.
const AUTHORING_NEXT_STATE: Partial<Record<ProfileRow["status"], ProfileRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceProfileOneStep(profile: ProfileRow, actorRole: string, actorId: string | undefined): Promise<TransitionProfileResult> {
  const targetState = AUTHORING_NEXT_STATE[profile.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Profile is already ${profile.status} — no further authoring step` };

  // Owner, 2026-08-19, mirroring advancePackOneStep/advanceTemplateOneStep
  // exactly: Published -> Active also supersedes whatever else is currently
  // Active for this code within the same tenant.
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

// Materialise a Draft's authored Pack selections (all six category-scoped
// slots plus optional) onto the join table. The base Template + environment
// are already real (set at create/save — profilesDB.createDraft/
// updateDraftContent both take them directly, unlike Template's deliverable
// catalogue). Runs once, gating the FIRST governed hop
// out of Draft only (core/sdkAuthoring.ts's publishAuthoringDraft calls both
// this and advanceProfileOneStep above).
export async function materialiseProfileDraft(profileId: string, seed: ProfileSeedInput): Promise<void> {
  await profilesDB.setPackSelection(profileId, "optional", seed.optionalPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "technology", seed.technologyPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "domain", seed.domainPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "compliance", seed.compliancePackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "integration", seed.integrationPackCodes ?? []);
  // CR-091 — the other two of Pack's six real category:pack values.
  await profilesDB.setPackSelection(profileId, "engineering", seed.engineeringPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "organisation", seed.organisationPackCodes ?? []);
  // Bug fix (owner: "There has to be real prod grade data") — this used to
  // stop at the Pack-selection join tables; draft_content itself (every
  // other ProfileSeedInput field — description, the 8 Configuration
  // Parameters, exposedParameterOverrides, etc.) was never written by
  // either of this function's callers (publishProfile's own upsert() has no
  // draftContent param at all). Same "whole seed" shape reactivateAsNewVersion
  // already writes via createDraft's own draftContent param — this just
  // makes it true regardless of which of the two ways a Profile row got
  // created.
  await profilesDB.setDraftContent(profileId, { ...seed });
}

export interface ProfileWithNextStates {
  profile: ProfileRow;
  possibleNextStates: string[];
}

// Profile Registry (owner, 2026-08-19: "Build the template and profile
// registry") — every Version of every Profile, with its own governed next
// states, mirroring listPacksWithNextStates/listTemplatesWithNextStates
// exactly. Also the UI trigger Profile's own reactivation mechanism (§19.2)
// otherwise has nowhere to run from.
export async function listProfilesWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<ProfileWithNextStates[]> {
  const { data: profiles } = viewer && !viewer.isRoot ? await profilesDB.findAllVisibleTo(viewer.tenantId) : await profilesDB.findAll();
  return Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Profile", profile.status);
      return { profile, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
