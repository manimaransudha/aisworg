import type { PackRow } from "../../../dblayer/seuTypes.js";
import type { EbmConflict } from "./types.js";

export const DEPENDENCY_MESSAGE = "This has to be resolved at the definition of the Template or Profile.";

export function dependencyKey(requiringPackCode: string, targetPackCode: string): string {
  return `dependency::${requiringPackCode}::${targetPackCode}`;
}

// Step 0 has followed the dependencies, so a required Pack is missing when it is not in the list, and an incompatible Pack is present when it is in the list.
// The user cannot resolve either in composition.
export function dependencyConflictsOf(packs: PackRow[]): EbmConflict[] {
  const codes = new Set(packs.map((pack) => pack.code));
  const conflicts: EbmConflict[] = [];
  for (const pack of packs) {
    for (const dependency of pack.dependencies ?? []) {
      const violated = dependency.type === "required" ? !codes.has(dependency.packCode) : dependency.type === "incompatible" ? codes.has(dependency.packCode) : false;
      if (!violated) continue;
      conflicts.push({
        table: "dependencies",
        key: dependencyKey(pack.code, dependency.packCode),
        kind: dependency.type === "incompatible" ? "dependency-incompatible-present" : "dependency-required-missing",
        message: `Pack ${pack.code} has a ${dependency.type} dependency on ${dependency.packCode} that is not met. ${DEPENDENCY_MESSAGE}`,
        options: [{ sourceKind: "pack", sourceId: pack.id, sourceLabel: pack.code, value: { type: dependency.type, packCode: dependency.packCode } }],
        resolution: null,
        resolvable: false,
      });
    }
  }
  return conflicts;
}
