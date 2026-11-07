import { unravelProfileConfiguration, type ProfileConfigurationUnraveled } from "./unravelProfileConfiguration.js";
import type { LeftOut } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { DetectionContext } from "./types.js";

// A configuration parameter the SEU takes.
export interface SettledParameter {
  parameter: string;
  value: unknown;
  profile: string;
}

export interface ProfileConfigurationSettled {
  // A Profile's configuration cannot conflict, so there is none. The field is kept so every table is saved the same way.
  conflicts: RecordedConflict[];
  result: SettledParameter[];
  leftOut: LeftOut[];
}

// The SEU takes every configuration parameter the Profile sets.
export function settleProfileConfigurationFrom(facts: ProfileConfigurationUnraveled): ProfileConfigurationSettled {
  return { conflicts: [], leftOut: [], result: facts.parameters.map((p) => ({ parameter: p.parameter, value: p.value, profile: p.profile })) };
}

export async function settleProfileConfiguration(context: DetectionContext): Promise<ProfileConfigurationSettled> {
  return settleProfileConfigurationFrom(unravelProfileConfiguration({ profiles: context.profiles }));
}
