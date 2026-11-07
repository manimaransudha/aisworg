import { PROFILE_CONFIGURATION_PARAMETERS } from "../../../dblayer/constants.js";
import type { ProfileRow } from "../../../dblayer/seuTypes.js";

// A configuration parameter a Profile sets.
export interface ProfileConfigurationRow {
  profile: string;
  parameter: string;
  value: unknown;
}

export interface ProfileConfigurationUnraveled {
  parameters: ProfileConfigurationRow[];
}

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);

// Gathers the configuration parameters each Profile sets. A parameter the Profile leaves empty is not gathered. It decides nothing.
export function unravelProfileConfiguration(input: { profiles: ProfileRow[] }): ProfileConfigurationUnraveled {
  const parameters: ProfileConfigurationRow[] = [];
  for (const profile of input.profiles) {
    const draft = (profile.draft_content ?? {}) as Record<string, unknown>;
    for (const parameter of PROFILE_CONFIGURATION_PARAMETERS) {
      const value = parameter === "environment" ? profile.environment : draft[parameter];
      if (!isEmpty(value)) parameters.push({ profile: profile.code, parameter, value });
    }
  }
  return { parameters };
}
