import { unravelCapabilities, type CapabilitiesUnraveled } from "./unravelCapabilities.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export function capabilityAdditionKey(capabilityCode: string, packCode: string): string {
  return `capability::${capabilityCode}::${packCode}`;
}

// In A and not in B is not a conflict. Not in A and in B is a conflict, one for each Pack that names the Capability.
export function detectCapabilityConflictsFrom(facts: CapabilitiesUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  const inA = new Set(facts.listA.map((entry) => entry.capabilityCode));
  const conflicts: EbmConflict[] = [];
  for (const named of facts.listB) {
    if (inA.has(named.capabilityCode)) continue;
    const key = capabilityAdditionKey(named.capabilityCode, named.packCode);
    conflicts.push({
      table: "capabilities",
      key,
      kind: "capability-added",
      message: `Pack ${named.packCode} names the Capability "${named.capabilityCode}", which no Service of the Deliverables names.`,
      options: [{ sourceKind: "pack", sourceId: named.packId, sourceLabel: named.packCode, value: { capabilityCode: named.capabilityCode } }],
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

export async function detectCapabilityConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  const facts = await unravelCapabilities({ templates: context.templates, profiles: context.profiles, composedPacks: context.composedPacks }, context.viewerTenantId);
  return detectCapabilityConflictsFrom(facts, resolutions);
}
