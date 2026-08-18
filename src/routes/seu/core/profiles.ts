import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
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
// grammar implemented now is code/name/baseTemplateCode/environment/
// configParameters/optionalPackCodes (see the plan's Profile section).
export interface ProfileSeedInput {
  code: string;
  name: string;
  baseTemplateCode: string;
  environment: string;
  configParameters?: Record<string, unknown>;
  optionalPackCodes?: string[];
}

export type ProfileValidationResult = { ok: true } | { ok: false; errors: string[] };

export async function validateProfileSeed(seed: ProfileSeedInput): Promise<ProfileValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.environment?.trim()) errors.push("environment is required");

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

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export type PublishProfileResult = { ok: true; profileId: string } | { ok: false; errors: string[] };

// Same immutability caveat as publishTemplate — profiles.upsert overwrites
// the same code's row in place; not (code, version)-versioned like Pack.
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
  });
  if (error || !profile) return { ok: false, errors: [(error ?? new Error("failed to upsert profile")).message] };

  await profilesDB.setOptionalPacks(profile.id, seed.optionalPackCodes ?? []);
  return { ok: true, profileId: profile.id };
}

// Entity-direct authoring (bug fix correcting CR-014): a governed status
// transition on a Profile, authorised on its own noun × verb (Draft -> Active is
// verb `publish` → profile_publish) under the REAL actor, actor + badge captured
// on the event. Mirrors transitionPack/transitionTemplate.
export type TransitionProfileResult = { ok: true; profile: ProfileRow } | { ok: false; reason: string; detail?: string };

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
  const { data: updated, error } = await profilesDB.updateStatus(profile.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update profile status");
  await eventBus.publish({
    eventType: "ProfileTransitioned",
    originatingObjectType: "Profile",
    originatingObjectId: profile.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: profile.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, profile: updated };
}

// Publish a Draft Profile authored entity-direct: validate the authored seed,
// materialise its base Template + config + optional Packs onto the Draft row +
// join table, then run the governed Draft -> Active transition under the real
// actor. The Draft row already carries base_template_id/config/environment
// (set at create/save); this only needs the optional-Pack join + the transition.
export async function publishProfileDraft(input: { profileId: string; seed: ProfileSeedInput; actorRole: string; actorId?: string }): Promise<PublishProfileResult> {
  const validation = await validateProfileSeed(input.seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: template } = await templatesDB.findByCode(input.seed.baseTemplateCode);
  if (!template) return { ok: false, errors: [`baseTemplateCode "${input.seed.baseTemplateCode}" not found`] };

  await profilesDB.setOptionalPacks(input.profileId, input.seed.optionalPackCodes ?? []);

  const transitioned = await transitionProfile({ profileId: input.profileId, targetState: "Active", actorRole: input.actorRole, actorId: input.actorId });
  if (!transitioned.ok) return { ok: false, errors: [`${transitioned.reason}${transitioned.detail ? `: ${transitioned.detail}` : ""}`] };

  return { ok: true, profileId: input.profileId };
}
