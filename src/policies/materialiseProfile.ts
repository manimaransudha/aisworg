import { profilesDB } from "../dblayer/profilesDB.js";
import type { PolicyImplementationInput } from "./index.js";

// The materialisation checks of a Profile (CR-128): the values of its parameter overrides are values the base Template's parameters allow. It changes nothing.
export async function materialiseProfile(input: PolicyImplementationInput): Promise<boolean> {
  if (!input.entityId) throw new Error("policy-materialise-profile needs the id of the Profile");
  const { data: profile, error } = await profilesDB.findById(input.entityId);
  if (error) throw error;
  if (!profile) throw new Error(`Profile ${input.entityId} not found`);
  // Loaded when called: sdkAuthoring.ts imports the transition engine, which imports this registry.
  const { toProfileSeedInput } = await import("../routes/seu/core/sdkAuthoring.js");
  const { validateOverrideValues } = await import("../routes/seu/core/profiles.js");
  const seed = toProfileSeedInput({ code: profile.code, name: profile.name, ...(profile.draft_content ?? {}), profileVersion: profile.profile_version, tenantId: profile.tenant_id, parentProfileId: profile.parent_profile_id });
  return (await validateOverrideValues(seed)).length === 0;
}
