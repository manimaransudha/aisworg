import { profilesDB } from "../dblayer/profilesDB.js";
import type { ActionInput } from "./index.js";

// Unravels a Profile into its tables: the Pack selections, and the draft content with the overrides rebuilt (CR-128).
// It runs the materialisation checks first, so the content is checked as it stands now. It runs inside the transition's transaction.
export async function unravelProfile(input: ActionInput): Promise<void> {
  const { data: profile, error } = await profilesDB.findById(input.entityId);
  if (error) throw error;
  if (!profile) throw new Error(`Profile ${input.entityId} not found`);
  // Loaded when called: sdkAuthoring.ts imports the transition engine, which imports this registry.
  const { toProfileSeedInput } = await import("../routes/seu/core/sdkAuthoring.js");
  const { materialiseProfileDraft, validateOverrideValues } = await import("../routes/seu/core/profiles.js");
  const seed = toProfileSeedInput({ code: profile.code, name: profile.name, ...(profile.draft_content ?? {}), profileVersion: profile.profile_version, tenantId: profile.tenant_id, parentProfileId: profile.parent_profile_id });
  const problems = await validateOverrideValues(seed);
  if (problems.length > 0) throw new Error(`Profile ${profile.code} cannot be unravelled: ${problems.join("; ")}`);
  const result = await materialiseProfileDraft(profile.id, seed, profile.authored_by, profile.author_badge);
  if (!result.ok) throw new Error(`Profile ${profile.code} cannot be unravelled: ${result.errors.join("; ")}`);
}
