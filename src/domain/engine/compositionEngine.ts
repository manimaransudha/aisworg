import { isDeepStrictEqual } from "node:util";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { packsDB } from "../../dblayer/packsDB.js";
import { extractExposedParameterOverrides, getProfilePackSelections } from "../../routes/seu/core/profiles.js";
import type { ExposedParameterOverride } from "../../routes/seu/core/profiles.js";
import type { EbmComposedPack, EbmCompositionReport, PackRow, ProfileRow, ParameterConflict, ParameterConflictOption } from "../../dblayer/seuTypes.js";

async function resolveActivePack(code: string, requiredBy: string): Promise<{ pack: PackRow | null; warning: string | null }> {
  const { data: pack } = await packsDB.findActiveByCode(code);
  if (!pack) {
    return { pack: null, warning: `Pack "${code}" (required by ${requiredBy}) has no Active Version — excluded from composition.` };
  }
  return { pack, warning: null };
}

export type CompositionStrategyCode = "specialization" | "override" | "merge" | "union" | "intersection" | "supplement";

export interface CompositionRequirements {
  minSources: number;
  maxSources: number | null;
  sameCodeRequired: boolean;
}

const STRATEGY_REQUIREMENTS: Record<CompositionStrategyCode, CompositionRequirements> = {
  specialization: { minSources: 1, maxSources: 1, sameCodeRequired: false },
  override: { minSources: 0, maxSources: 0, sameCodeRequired: false },
  merge: { minSources: 2, maxSources: null, sameCodeRequired: true },
  union: { minSources: 2, maxSources: null, sameCodeRequired: false },
  intersection: { minSources: 2, maxSources: null, sameCodeRequired: false },
  supplement: { minSources: 2, maxSources: null, sameCodeRequired: false },
};

export interface CompositionSource {
  id: string;
  code: string;
  fields: Record<string, unknown>;
}

export interface SpecializationResult {
  fields: Record<string, unknown>;
  parentIds: string[];
}

export type MergeResult =
  | { ok: true; fields: Record<string, unknown>; parentIds: string[]; conflicts: string[] }
  | { ok: false; error: string };

export type UnionResult =
  | { ok: true; fields: Record<string, unknown>; parentIds: string[]; conflicts: string[] }
  | { ok: false; error: string };

export type IntersectionResult =
  | { ok: true; fields: Record<string, unknown>; parentIds: string[] }
  | { ok: false; error: string };

export type SupplementResult =
  | { ok: true; fields: Record<string, unknown>; parentIds: string[]; rejected: string[] }
  | { ok: false; error: string };

const ARRAY_IDENTITY_FIELDS = ["code", "name"];

function arrayIdentityField(arrays: unknown[][]): string | null {
  for (const field of ARRAY_IDENTITY_FIELDS) {
    const everyItemHasIt = arrays.every((arr) => arr.every((item) => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>)[field] === "string" && (item as Record<string, unknown>)[field] !== ""));
    if (everyItemHasIt) return field;
  }
  return null;
}

function describeValue(v: unknown): string {
  if (v === undefined) return "(absent)";
  if (typeof v === "string") return `"${v}"`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function combineFields(sources: Array<{ id: string; code: string; entries: Record<string, unknown> }>, pathPrefix = ""): { agreed: Record<string, unknown>; conflicts: string[] } {
  const agreed: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const keys = new Set<string>();
  for (const s of sources) for (const k of Object.keys(s.entries)) keys.add(k);

  for (const key of keys) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    const present = sources.filter((s) => key in s.entries);
    if (present.length === 1) {
      agreed[key] = present[0].entries[key];
      continue;
    }
    const values = present.map((s) => s.entries[key]);
    if (values.every((v) => isDeepStrictEqual(v, values[0]))) {
      agreed[key] = values[0];
      continue;
    }
    const allPlainObjects = values.every((v) => typeof v === "object" && v !== null && !Array.isArray(v));
    if (allPlainObjects) {
      const nested = combineFields(present.map((s) => ({ id: s.id, code: s.code, entries: s.entries[key] as Record<string, unknown> })), path);
      agreed[key] = nested.agreed;
      conflicts.push(...nested.conflicts);
      continue;
    }
    const allArrays = values.every((v) => Array.isArray(v));
    if (allArrays) {
      const arrays = values as unknown[][];
      const identityField = arrayIdentityField(arrays);
      if (identityField) {
        const byIdentity = new Map<string, Array<{ id: string; code: string; entries: Record<string, unknown> }>>();
        present.forEach((s, i) => {
          for (const item of arrays[i] as Array<Record<string, unknown>>) {
            const idVal = String(item[identityField]);
            const list = byIdentity.get(idVal) ?? [];
            list.push({ id: s.id, code: s.code, entries: item });
            byIdentity.set(idVal, list);
          }
        });
        const mergedArray: unknown[] = [];
        for (const [idVal, items] of byIdentity) {
          const nested = combineFields(items, `${path}[${identityField}=${idVal}]`);
          mergedArray.push(nested.agreed);
          conflicts.push(...nested.conflicts);
        }
        agreed[key] = mergedArray;
        continue;
      }
      if (arrays.every((v) => v.length === arrays[0].length)) {
        const mergedArray: unknown[] = [];
        for (let idx = 0; idx < arrays[0].length; idx++) {
          const itemsAtIdx = arrays[0][idx];
          if (typeof itemsAtIdx !== "object" || itemsAtIdx === null) {
            const itemValues = arrays.map((arr) => arr[idx]);
            if (itemValues.every((v) => isDeepStrictEqual(v, itemValues[0]))) {
              mergedArray.push(itemValues[0]);
            } else {
              conflicts.push(`Composition conflict on "${path}[${idx}]": ${present.map((s, i) => `${s.code} has ${describeValue(itemValues[i])}`).join(", ")}.`);
            }
            continue;
          }
          const nested = combineFields(present.map((s, i) => ({ id: s.id, code: s.code, entries: arrays[i][idx] as Record<string, unknown> })), `${path}[${idx}]`);
          mergedArray.push(nested.agreed);
          conflicts.push(...nested.conflicts);
        }
        agreed[key] = mergedArray;
        continue;
      }
    }
    conflicts.push(`Composition conflict on "${path}": ${present.map((s, i) => `${s.code} has ${describeValue(values[i])}`).join(", ")}.`);
  }

  return { agreed, conflicts };
}

export const compositionEngine = {
  strategyRequirements(strategy: string): CompositionRequirements {
    return STRATEGY_REQUIREMENTS[strategy as CompositionStrategyCode] ?? STRATEGY_REQUIREMENTS.override;
  },

  specialize(parent: CompositionSource, overrides: Record<string, unknown> = {}): SpecializationResult {
    return { fields: { ...parent.fields, ...overrides }, parentIds: [parent.id] };
  },

  merge(sources: CompositionSource[]): MergeResult {
    const req = STRATEGY_REQUIREMENTS.merge;
    if (sources.length < req.minSources) return { ok: false, error: `Merge requires at least ${req.minSources} sources, got ${sources.length}.` };
    const code = sources[0].code;
    if (!sources.every((s) => s.code === code)) {
      return { ok: false, error: `Merge requires every source to share the same code — got: ${[...new Set(sources.map((s) => s.code))].join(", ")}.` };
    }
    const { agreed, conflicts } = combineFields(sources.map((s) => ({ id: s.id, code: s.code, entries: s.fields })));
    return { ok: true, fields: agreed, parentIds: sources.map((s) => s.id), conflicts };
  },

  union(sources: CompositionSource[]): UnionResult {
    const req = STRATEGY_REQUIREMENTS.union;
    if (sources.length < req.minSources) return { ok: false, error: `Union requires at least ${req.minSources} sources, got ${sources.length}.` };
    const { agreed, conflicts } = combineFields(sources.map((s) => ({ id: s.id, code: s.code, entries: s.fields })));
    return { ok: true, fields: agreed, parentIds: sources.map((s) => s.id), conflicts };
  },

  intersection(sources: CompositionSource[]): IntersectionResult {
    const req = STRATEGY_REQUIREMENTS.intersection;
    if (sources.length < req.minSources) return { ok: false, error: `Intersection requires at least ${req.minSources} sources, got ${sources.length}.` };
    const keys = Object.keys(sources[0].fields).filter((k) => sources.every((s) => k in s.fields));
    const fields: Record<string, unknown> = {};
    for (const key of keys) {
      const values = sources.map((s) => s.fields[key]);
      if (values.every((v) => isDeepStrictEqual(v, values[0]))) fields[key] = values[0];
    }
    return { ok: true, fields, parentIds: sources.map((s) => s.id) };
  },

  supplement(base: CompositionSource, supplements: CompositionSource[]): SupplementResult {
    const req = STRATEGY_REQUIREMENTS.supplement;
    if (1 + supplements.length < req.minSources) return { ok: false, error: `Supplement requires at least ${req.minSources - 1} supplementing source(s), got ${supplements.length}.` };
    const rejected: string[] = [];
    const newKeys = new Set<string>();
    for (const s of supplements) {
      for (const key of Object.keys(s.fields)) {
        if (key in base.fields) {
          if (!isDeepStrictEqual(s.fields[key], base.fields[key])) rejected.push(key);
        } else {
          newKeys.add(key);
        }
      }
    }
    const additions: Record<string, unknown> = {};
    for (const key of newKeys) {
      const contributing = supplements.filter((s) => key in s.fields);
      const values = contributing.map((s) => s.fields[key]);
      if (values.every((v) => isDeepStrictEqual(v, values[0]))) additions[key] = values[0];
    }
    return { ok: true, fields: { ...base.fields, ...additions }, parentIds: [base.id, ...supplements.map((s) => s.id)], rejected: [...new Set(rejected)] };
  },

  async compose(input: { templateIds: string[]; profileIds: string[]; resolvedParameterOverrides?: Record<string, string> }): Promise<{
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
  }> {
    const warnings: string[] = [];
    const resolvedPacks: PackRow[] = [];

    for (const templateId of input.templateIds) {
      const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(templateId);
      for (const code of mandatoryCodes ?? []) {
        const { pack, warning } = await resolveActivePack(code, "a Template's mandatory set");
        if (warning) warnings.push(warning);
        if (pack) resolvedPacks.push(pack);
      }
    }

    const profiles: ProfileRow[] = [];
    for (const profileId of input.profileIds) {
      const selections = await getProfilePackSelections(profileId);
      const allSelectedCodes = [
        ...(selections.optionalPackCodes ?? []),
        ...(selections.technologyPackCodes ?? []),
        ...(selections.domainPackCodes ?? []),
        ...(selections.compliancePackCodes ?? []),
        ...(selections.integrationPackCodes ?? []),
        ...(selections.engineeringPackCodes ?? []),
        ...(selections.organisationPackCodes ?? []),
      ];
      for (const code of allSelectedCodes) {
        const { pack, warning } = await resolveActivePack(code, "a Profile's optional set");
        if (warning) warnings.push(warning);
        if (pack) resolvedPacks.push(pack);
      }
      const { data: profile } = await profilesDB.findById(profileId);
      if (profile) profiles.push(profile);
    }

    const byCode = new Map<string, PackRow>();
    for (const pack of resolvedPacks) byCode.set(pack.code, pack);

    const packs = [...byCode.values()];
    const composedPacks: EbmComposedPack[] = packs.map((pack) => ({
      packId: pack.id,
      packCode: pack.code,
      packVersion: pack.pack_version,
    }));

    const conflicts = detectGovernanceConflicts(packs);
    const parameterConflicts = detectParameterOverrideConflicts(profiles).filter((c) => !(input.resolvedParameterOverrides && c.key in input.resolvedParameterOverrides));

    return {
      composedPacks,
      compositionReport: { warnings, conflicts, parameterConflicts, resolutions: [] },
    };
  },
};

function detectParameterOverrideConflicts(profiles: ProfileRow[]): ParameterConflict[] {
  const byKey = new Map<string, { sourceType: ExposedParameterOverride["sourceType"]; sourceCode: string; parameterName: string; options: ParameterConflictOption[] }>();
  for (const profile of profiles) {
    for (const o of extractExposedParameterOverrides(profile.draft_content)) {
      const key = `${o.sourceType}::${o.sourceCode}::${o.parameterName}`;
      const entry = byKey.get(key) ?? { sourceType: o.sourceType, sourceCode: o.sourceCode, parameterName: o.parameterName, options: [] };
      entry.options.push({ profileId: profile.id, profileCode: profile.code, profileName: profile.name, value: o.value });
      byKey.set(key, entry);
    }
  }
  const conflicts: ParameterConflict[] = [];
  for (const [key, entry] of byKey) {
    if (new Set(entry.options.map((o) => o.value)).size < 2) continue;
    conflicts.push({ key, sourceType: entry.sourceType, sourceCode: entry.sourceCode, parameterName: entry.parameterName, options: entry.options });
  }
  return conflicts;
}

function detectGovernanceConflicts(packs: PackRow[]): string[] {
  const conflicts: string[] = [];

  const byTransition = new Map<string, Map<string, Set<string>>>();
  for (const pack of packs) {
    for (const rule of pack.contributions?.authorityRules ?? []) {
      const perPack = byTransition.get(rule.governedTransition) ?? new Map<string, Set<string>>();
      const roles = perPack.get(pack.code) ?? new Set<string>();
      roles.add(rule.authorisedRole);
      perPack.set(pack.code, roles);
      byTransition.set(rule.governedTransition, perPack);
    }
  }
  for (const [transition, perPack] of byTransition) {
    if (perPack.size < 2) continue;
    const allRoles = new Set<string>();
    for (const roles of perPack.values()) for (const r of roles) allRoles.add(r);
    if (allRoles.size > 1) {
      const detail = [...perPack.entries()].map(([code, roles]) => `${code} requires ${[...roles].map((r) => `"${r}"`).join("/")}`).join(", ");
      conflicts.push(`Authority conflict on "${transition}": ${detail}. Different Packs assign different authorised roles — resolve before commissioning.`);
    }
  }

  const packsByTripleAndCategory = new Map<string, Set<string>>();
  for (const pack of packs) {
    for (const gate of pack.contributions?.qualityGates ?? []) {
      const key = `${gate.governedTransition} [${gate.category}]`;
      const set = packsByTripleAndCategory.get(key) ?? new Set<string>();
      set.add(pack.code);
      packsByTripleAndCategory.set(key, set);
    }
  }
  for (const [key, packCodes] of packsByTripleAndCategory) {
    if (packCodes.size > 1) {
      conflicts.push(`Quality Gate conflict on ${key}: contributed by ${[...packCodes].join(", ")}. Only one Quality Gate can occupy the same transition + category — resolve before commissioning.`);
    }
  }

  return conflicts;
}
