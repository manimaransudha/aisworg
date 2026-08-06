import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
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
