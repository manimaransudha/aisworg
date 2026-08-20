import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { assertCanonicalCategory } from "./ontology.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { ProfileRow } from "../../../dblayer/seuTypes.js";

export async function createProfile(input: {
  templateId: string;
  environment?: string;
  configParameters?: Record<string, unknown>;
}): Promise<ProfileRow> {
  const { data: template, error: templateErr } = await templatesDB.findById(input.templateId);
  if (templateErr) throw templateErr;
  if (!template) throw new Error(`template not found: ${input.templateId}`);

  const { data: profile, error } = await profilesDB.create({
    baseTemplateId: template.id,
    environment: input.environment,
    configParameters: input.configParameters,
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
// own fallback used to paper over — see commissionFromExistingObjective's
// commissioningPreview, the first real caller of this).
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
  configParameters?: Record<string, unknown>;
  optionalPackCodes?: string[];
  // Profile identity foundation (owner, 2026-08-19) — mirrors PackSeedInput/
  // TemplateSeedInput's own tenantId/parentXId/versioning shape exactly.
  profileVersion: string;
  tenantId?: string;
  parentProfileId?: string | null;
  // Ch.7 §8 Profile Categories (Ontology-rooted, migration 065) — a real,
  // separate field, not folded into `code` the way Template's is.
  category: string;
  // The remaining §7 fields this pass adds.
  description?: string;
  featureFlagCodes?: string[];
  compositionOptions?: Record<string, unknown>;
  technologyPackCodes?: string[];
  domainPackCodes?: string[];
  compliancePackCodes?: string[];
  integrationPackCodes?: string[];
}

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
];

export async function validateProfileSeed(seed: ProfileSeedInput): Promise<ProfileValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.environment?.trim()) errors.push("environment is required");
  if (!SEMVER_RE.test(seed.profileVersion ?? "")) errors.push(`profileVersion must be semver (x.y.z), got: "${seed.profileVersion}"`);

  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? PLATFORM_TENANT_ID };
  try {
    await assertCanonicalCategory("profile-categories", seed.category ?? "", ontologyViewer);
  } catch (err) {
    errors.push((err as Error).message);
  }

  if (!seed.baseTemplateCode?.trim()) {
    errors.push("baseTemplateCode is required");
  } else {
    const { data: template } = await templatesDB.findByCode(seed.baseTemplateCode);
    if (!template) errors.push(`baseTemplateCode "${seed.baseTemplateCode}" does not resolve to a real Template`);
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
    configParameters: seed.configParameters ?? {},
    environment: seed.environment,
    profileVersion: seed.profileVersion,
    tenantId: seed.tenantId,
    category: seed.category,
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

  const [optionalPackCodes, technologyPackCodes, domainPackCodes, compliancePackCodes, integrationPackCodes] = await Promise.all([
    profilesDB.getPackSelection(profile.id, "optional"),
    profilesDB.getPackSelection(profile.id, "technology"),
    profilesDB.getPackSelection(profile.id, "domain"),
    profilesDB.getPackSelection(profile.id, "compliance"),
    profilesDB.getPackSelection(profile.id, "integration"),
  ]);

  const priorContent = (profile.draft_content ?? {}) as Record<string, unknown>;
  const seed: ProfileSeedInput = {
    code: profile.code,
    name: profile.name,
    baseTemplateCode: template.code,
    environment: profile.environment,
    configParameters: profile.config_parameters,
    optionalPackCodes: optionalPackCodes.data ?? [],
    profileVersion: nextVersion,
    // Reactivation is versioning, not a change of ownership or lineage —
    // mirrors reactivateAsNewVersion's own tenantId/parentTemplateId
    // treatment in core/templates.ts exactly.
    tenantId: profile.tenant_id,
    parentProfileId: profile.parent_profile_id,
    category: profile.category ?? "",
    description: typeof priorContent.description === "string" ? priorContent.description : undefined,
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? (priorContent.compositionOptions as Record<string, unknown>) : undefined,
    technologyPackCodes: technologyPackCodes.data ?? [],
    domainPackCodes: domainPackCodes.data ?? [],
    compliancePackCodes: compliancePackCodes.data ?? [],
    integrationPackCodes: integrationPackCodes.data ?? [],
  };
  // featureFlagCodes has no real column/join table of its own to re-derive
  // from (unlike the Pack-selection slots above) — it only ever lived in
  // draft_content, so it's carried through from there directly.
  seed.featureFlagCodes = Array.isArray(priorContent.featureFlagCodes)
    ? (priorContent.featureFlagCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { featureCode?: string })?.featureCode ?? "")).filter((v) => v !== "")
    : [];

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
    category: seed.category,
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
// works from any status (not just terminal) — mirrors
// copyTemplateAsNewDraft/copyPackAsNewDraft exactly.
export async function copyProfileAsNewDraft(profileId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await profilesDB.findById(profileId);
  if (!source) return { ok: false, errors: ["Profile not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.profile_version, source.tenant_id);
  const { data: template } = await templatesDB.findById(source.base_template_id);
  if (!template) return { ok: false, errors: [`base Template ${source.base_template_id} no longer exists`] };

  const [optionalPackCodes, technologyPackCodes, domainPackCodes, compliancePackCodes, integrationPackCodes] = await Promise.all([
    profilesDB.getPackSelection(source.id, "optional"),
    profilesDB.getPackSelection(source.id, "technology"),
    profilesDB.getPackSelection(source.id, "domain"),
    profilesDB.getPackSelection(source.id, "compliance"),
    profilesDB.getPackSelection(source.id, "integration"),
  ]);
  const priorContent = (source.draft_content ?? {}) as Record<string, unknown>;
  const featureFlagCodes = Array.isArray(priorContent.featureFlagCodes)
    ? (priorContent.featureFlagCodes as unknown[]).map((v) => (typeof v === "string" ? v : (v as { featureCode?: string })?.featureCode ?? "")).filter((v) => v !== "")
    : [];
  const draftContent = {
    code: source.code,
    name: source.name,
    baseTemplateCode: template.code,
    environment: source.environment,
    configParameters: source.config_parameters,
    optionalPackCodes: optionalPackCodes.data ?? [],
    category: source.category ?? "",
    description: typeof priorContent.description === "string" ? priorContent.description : undefined,
    compositionOptions: typeof priorContent.compositionOptions === "object" && priorContent.compositionOptions ? (priorContent.compositionOptions as Record<string, unknown>) : undefined,
    technologyPackCodes: technologyPackCodes.data ?? [],
    domainPackCodes: domainPackCodes.data ?? [],
    compliancePackCodes: compliancePackCodes.data ?? [],
    integrationPackCodes: integrationPackCodes.data ?? [],
    featureFlagCodes,
  };
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
    category: source.category,
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

// Materialise a Draft's authored optional/technology/domain/compliance/
// integration-Pack selections onto the join table. The base Template +
// environment + config + category are already real (set at create/save —
// profilesDB.createDraft/updateDraftContent both take them directly, unlike
// Template's deliverable catalogue). Runs once, gating the FIRST governed hop
// out of Draft only (core/sdkAuthoring.ts's publishAuthoringDraft calls both
// this and advanceProfileOneStep above).
export async function materialiseProfileDraft(profileId: string, seed: ProfileSeedInput): Promise<void> {
  await profilesDB.setPackSelection(profileId, "optional", seed.optionalPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "technology", seed.technologyPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "domain", seed.domainPackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "compliance", seed.compliancePackCodes ?? []);
  await profilesDB.setPackSelection(profileId, "integration", seed.integrationPackCodes ?? []);
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
