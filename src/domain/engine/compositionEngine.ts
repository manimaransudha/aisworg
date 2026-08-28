// Ch.4 minimal instance — composes a Template's mandatory Packs + a Profile's
// optional Packs into the ordered Pack list an EBM records (Build Plan §5 item
// 5: EBM and EEC are collapsed into one table, so "compose" here means
// "resolve + de-duplicate the Pack set", not build a separately-published,
// reusable EBM). Deterministic and traceable per AP requirements: same
// Template+Profile Pack set in, same composedPacks/report out, every time
// composition runs — but "the same set" is evaluated fresh each time, not
// cached: see the code-resolution note below.
import { isDeepStrictEqual } from "node:util";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { packsDB } from "../../dblayer/packsDB.js";
import type { EbmComposedPack, EbmCompositionReport, PackRow } from "../../dblayer/seuTypes.js";

// Bug fix (Open Design Questions.md #2) — a Template/Profile used to pin a
// specific Pack *row*, resolved once when authored. Archiving that row and
// publishing a newer Active Version under the same code left nothing for the
// old reference to fall back to — the Pack just silently stopped composing.
// Fix: template_packs/profile_packs now store the Pack's *code*
// (013_template_profile_pack_by_code.sql); resolved here, at commissioning
// time, to whichever Version is currently Active for that code — the same
// findActiveByCode lookup publishPack's own supersede step already uses. A
// code with no Active Version at all (every Version terminal) resolves to
// nothing and is named in a warning, same visibility the old status-check
// gave, just for a different underlying reason.
async function resolveActivePack(code: string, requiredBy: string): Promise<{ pack: PackRow | null; warning: string | null }> {
  const { data: pack } = await packsDB.findActiveByCode(code);
  if (!pack) {
    return { pack: null, warning: `Pack "${code}" (required by ${requiredBy}) has no Active Version — excluded from composition.` };
  }
  return { pack, warning: null };
}

// CR-067 — the generic Composition Strategy engine (Ch.4 §21's own audit
// finding: of the 7 named strategies, only whole-Pack Override had any real
// behaviour). Entity-agnostic by construction (owner: "if I have an alias
// composition on template, it should be treated the same way a capability
// alias will look like") — every function below operates on plain field
// maps, never a Pack-specific type, so the SAME functions are what Template/
// Profile would call too once their own hand-built inheritance is migrated
// onto this engine (explicitly deferred — Phase 2, not this build). Pure and
// stateless throughout, matching Ch.4's "the Composition Engine performs no
// software engineering work itself" boundary — no DB access, no version-bump/
// supersede mechanics (those stay each entity's own real, already-working
// lifecycle machinery; see strategyRequirements("override")'s own comment).
// `compose()`/`detectGovernanceConflicts` above are untouched by any of this
// — Open Question 1 (CR-067) — whether the existing whole-Pack Override dedup
// should route through this engine — stays parked.
export type CompositionStrategyCode = "specialization" | "override" | "merge" | "union" | "intersection" | "supplement";

export interface CompositionRequirements {
  minSources: number;
  maxSources: number | null;
  sameCodeRequired: boolean;
}

// Owner, directly: "Alias needs one originating id. Merge will need 2 or
// more etc." — the per-strategy arity table, defined once here so any caller
// (Pack authoring's own compositionSources validation today; Template/
// Profile/Capability/whatever tomorrow) enforces the same rule the same way.
const STRATEGY_REQUIREMENTS: Record<CompositionStrategyCode, CompositionRequirements> = {
  specialization: { minSources: 1, maxSources: 1, sameCodeRequired: false },
  // Override acts on the entity's OWN prior version, not external sources —
  // see the comment on the engine object's own `strategyRequirements` export.
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

// The one shared combine primitive Merge/Union both build on — CR-067's own
// Conflict Detection definition, verbatim: "Composition should go deep into
// contributions at pack level and whatever is the deepest at every other
// identity... not a fixed depth, entity-specific." Recurses into nested plain
// objects unconditionally; recurses into arrays of objects by matching items
// on whichever identity field is consistently present (code, then name —
// every contribution kind's own real identity field; deliberately NOT
// "statement" or other pure-content fields — an item whose only content field
// disagrees across sources is exactly the conflict being looked for, not a
// key to match items on), falling back to positional matching (same-length
// arrays) when no identity field is available — a Checklist's own `items[]`
// has no identity field at all, only position. A conflict is a full path
// (e.g. "contributions.checklists[name=Checklist 1].items[0].statement") plus
// each disagreeing source's own value, in one human-readable string —
// matching detectGovernanceConflicts's own existing message style, not a new
// structured type.
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

// entries: one Record<string, unknown> per source (a Pack's own field map, or
// a keyed collection for Union) — combines key-by-key, recursing into nested
// structure to find the deepest real disagreement rather than flagging a
// whole field/array as "different" the moment any part of it diverges.
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
    // Disagreement — try to recurse rather than flag the whole value.
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
      if (identityField && arrays.every((v) => v.length > 0)) {
        // Match array items by identity field across sources (reordering-
        // safe), recurse per matched item.
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
      // No identity field (e.g. a Checklist's own items[], identified only by
      // position) — positional fallback, only when every source's array is
      // the same length (a length mismatch has no principled index
      // correspondence, so it falls through to the flat conflict below).
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
    // No structural way to recurse further (mismatched types, or an array-
    // length disagreement with no identity field to match on) — this is the
    // deepest real conflict on this path.
    conflicts.push(`Composition conflict on "${path}": ${present.map((s, i) => `${s.code} has ${describeValue(values[i])}`).join(", ")}.`);
  }

  return { agreed, conflicts };
}

export const compositionEngine = {
  // The per-strategy input requirements (owner: "Alias needs one originating
  // id. Merge will need 2 or more etc."). Unknown strategy codes, and
  // "conflict-detection" (not an independent, author-selectable strategy per
  // CR-067's own design), fall back to Override's own requirements — "If a
  // strategy does not have definition it will fall to override" (owner).
  strategyRequirements(strategy: string): CompositionRequirements {
    return STRATEGY_REQUIREMENTS[strategy as CompositionStrategyCode] ?? STRATEGY_REQUIREMENTS.override;
  },

  // Specialization: "Creation is an exact copy of the parent; code and/or
  // name may be changed... every other field/property may be changed or left
  // as-is." The copy itself (code included) is the whole job here — nothing
  // in this function locks anything afterward, unlike Template's own
  // inheritance validator.
  specialize(parent: CompositionSource, overrides: Record<string, unknown> = {}): SpecializationResult {
    return { fields: { ...parent.fields, ...overrides }, parentIds: [parent.id] };
  },

  // No override() function here: "same code, complete replacement of
  // existing content, no identity change... the prior version is retired" is
  // exactly Pack's own existing advancePackLifecycle/reactivateAsNewVersion +
  // findActiveByCode-supersede machinery (core/packs.ts) — already real,
  // already tested. strategyRequirements("override") exists purely so a
  // generic caller can express "0 external sources" uniformly; duplicating
  // that machinery here as a pure function would have nothing real to do.

  // Merge: same code required across every source (the CR's own merge key —
  // "all parents claim to be the same logical entity"). Field-by-field:
  // whatever combines unambiguously (present in only one source, or every
  // source that HAS it agrees) is included; whatever disagrees is excluded
  // from `fields` and flagged in `conflicts` for the author to resolve — this
  // IS Conflict Detection, the escalation path inside Merge, not a separate
  // strategy.
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

  // Union: the same combine-with-flag-on-conflict algorithm as Merge, just
  // without the same-code requirement — "a collection-level combination...
  // not an identity-level one."
  union(sources: CompositionSource[]): UnionResult {
    const req = STRATEGY_REQUIREMENTS.union;
    if (sources.length < req.minSources) return { ok: false, error: `Union requires at least ${req.minSources} sources, got ${sources.length}.` };
    const { agreed, conflicts } = combineFields(sources.map((s) => ({ id: s.id, code: s.code, entries: s.fields })));
    return { ok: true, fields: agreed, parentIds: sources.map((s) => s.id), conflicts };
  },

  // Intersection: keep only what's unanimous across every source; anything
  // they disagree — or that isn't present everywhere — on is simply dropped,
  // never flagged ("Intersection never attempts to combine disagreeing
  // values, so there's nothing to escalate").
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

  // Supplement: one base, one or more supplementing sources — "purely
  // additive: may only add fields/items the base doesn't already have; can
  // never override or remove anything the base declares." A supplement key
  // that collides with an existing base key IS REJECTED ONLY WHEN THE VALUE
  // ACTUALLY DIFFERS — restating a value the base already agrees with isn't
  // an override attempt in any real sense (nothing would change), just a key
  // that happens to be shared; `rejected` names only genuine attempted
  // overrides. New (non-base) keys the supplements disagree on are silently
  // dropped, same as Intersection — Supplement isn't wired to Conflict
  // Detection (only Merge/Union are, per CR-067's own design), so there's
  // nowhere for a flag to go; a judgement call, reasonable to revisit.
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
      // else: supplements disagree on a new key — silently dropped (see comment above).
    }
    return { ok: true, fields: { ...base.fields, ...additions }, parentIds: [base.id, ...supplements.map((s) => s.id)], rejected: [...new Set(rejected)] };
  },

  async compose(input: { templateId: string; profileId: string }): Promise<{
    composedPacks: EbmComposedPack[];
    compositionReport: EbmCompositionReport;
  }> {
    const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(input.templateId);
    const { data: optionalCodes } = await profilesDB.getOptionalPackCodes(input.profileId);

    const warnings: string[] = [];
    const resolvedPacks: PackRow[] = [];

    for (const code of mandatoryCodes ?? []) {
      const { pack, warning } = await resolveActivePack(code, "the Template's mandatory set");
      if (warning) warnings.push(warning);
      if (pack) resolvedPacks.push(pack);
    }
    for (const code of optionalCodes ?? []) {
      const { pack, warning } = await resolveActivePack(code, "the Profile's optional set");
      if (warning) warnings.push(warning);
      if (pack) resolvedPacks.push(pack);
    }

    // Override strategy (Architecture Catalogue §11): later-composed Pack (Profile's
    // optional set) wins over an earlier one (Template's mandatory set) contributing
    // the same code. Every resolved row here is already Active by construction
    // (findActiveByCode's own WHERE clause) — no separate status filter needed.
    const byCode = new Map<string, PackRow>();
    for (const pack of resolvedPacks) {
      if (byCode.has(pack.code)) {
        warnings.push(`Pack ${pack.code} contributed more than once for this commissioning — later composition overrides earlier (Override strategy).`);
      }
      byCode.set(pack.code, pack);
    }

    const packs = [...byCode.values()];
    const composedPacks: EbmComposedPack[] = packs.map((pack) => ({
      packId: pack.id,
      packCode: pack.code,
      packVersion: pack.pack_version,
    }));

    // FR-3.6 / FR-21.7: detect governance conflicts across the composed Packs
    // from their declarative contributions (read unmasked from packs.contributions,
    // before the global upsert-by-code/triple collapses them). A conflict is an
    // *incompatible* contribution from different Packs that no Override rule
    // resolves — it requires human judgement. Same-code duplicates are the
    // Override case above (a warning), and multiple policies co-apply (not a
    // conflict).
    const conflicts = detectGovernanceConflicts(packs);

    return {
      composedPacks,
      compositionReport: { warnings, conflicts, resolutions: [] },
    };
  },
};

// A conflict is a CROSS-PACK disagreement — two DIFFERENT Packs contributing
// incompatible governance for the same target. Multiplicity WITHIN one Pack is
// the author's deliberate design and is never a conflict (e.g.
// platform-core-engineering legitimately assigns different roles to
// `knowledgescope.transition` for promotion to Capability/Enterprise/Platform).
// Detected:
//   (a) two different Packs assign different authorisedRole to the SAME
//       governedTransition — ambiguous authority; and
//   (b) two different Packs contribute quality gates on the SAME
//       (entityType,fromState,toState) triple — only one gate per triple.
function detectGovernanceConflicts(packs: PackRow[]): string[] {
  const conflicts: string[] = [];

  // governedTransition -> Map<packCode, Set<role>>
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
    if (perPack.size < 2) continue; // only one Pack contributes here — intra-pack design, not a conflict
    const allRoles = new Set<string>();
    for (const roles of perPack.values()) for (const r of roles) allRoles.add(r);
    if (allRoles.size > 1) {
      const detail = [...perPack.entries()].map(([code, roles]) => `${code} requires ${[...roles].map((r) => `"${r}"`).join("/")}`).join(", ");
      conflicts.push(`Authority conflict on "${transition}": ${detail}. Different Packs assign different authorised roles — resolve before commissioning.`);
    }
  }

  // CR-058 — a transition may now have several active gates, one per
  // category (owner: "one gate per category"), so two Packs contributing to
  // the SAME transition is no longer itself a conflict; only two Packs both
  // targeting the same (transition, category) slot is.
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
