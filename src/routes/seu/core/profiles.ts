import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
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
