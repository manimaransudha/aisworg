import { recordConflicts, type LeftOut } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ComposedPacks } from "./composedPacks.js";
import type { DetectionContext } from "./types.js";

// A Pack the SEU composes.
export interface SettledPack {
  id: string;
  code: string;
  version: string;
  direct: boolean;
}

export interface DependenciesSettled {
  conflicts: RecordedConflict[];
  result: SettledPack[];
  // Nothing is left out: a dependency conflict cannot be resolved in composition.
  leftOut: LeftOut[];
}

// The result is the Packs of the composition, flattened by Step 0. The dependency conflicts are saved as found. They cannot be resolved in composition, so no pick applies.
export function settleDependenciesFrom(composedPacks: ComposedPacks): DependenciesSettled {
  const direct = new Set(composedPacks.directPackCodes);
  return {
    conflicts: recordConflicts(composedPacks.dependencyConflicts),
    leftOut: [],
    result: composedPacks.packs.map((pack) => ({ id: pack.id, code: pack.code, version: pack.pack_version, direct: direct.has(pack.code) })),
  };
}

export async function settleDependencies(context: DetectionContext): Promise<DependenciesSettled> {
  return settleDependenciesFrom(context.composedPacks);
}
