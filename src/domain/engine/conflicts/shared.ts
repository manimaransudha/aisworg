import type { PoolSource } from "../profileCompositionUnravel.js";
import type { ConflictOption } from "./types.js";

export function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function packOption(source: PoolSource, value: unknown, labelSuffix = ""): ConflictOption {
  return { sourceKind: "pack", sourceId: source.id, sourceLabel: `${source.label}${labelSuffix}`, value };
}

export function sortedCopy(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}
