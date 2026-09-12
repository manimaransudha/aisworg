// Unravel a Template+Profile selection's full composition for the
// Commissioning Validation page, and detect real cross-source conflicts
// against it — built fresh, independent of compositionEngine.ts (owner:
// "detectGovernanceConflicts is not your reference. build the conflict
// detection from scratch as a separate feature so it is easy to work on if
// we have to change it"). This module resolves the composed Pack set itself
// (the same underlying DB reads compositionEngine.compose() uses, called
// independently — never through compose() itself) and never calls into
// compositionEngine.ts's own combineFields/detectGovernanceConflicts.
//
// The core idea (owner): every real value that could conceivably come from
// more than one place — every Profile Configuration Parameter, every
// Template-declared field, every Template-exposed parameter (resolved to its
// one effective value), and every composed Pack's own contributions,
// including every Pack Dependency declaration — goes into ONE flat,
// source-agnostic pool, keyed by whatever identifies "the same real thing."
// Two entries sharing a key are compared recursively, to full depth (owner:
// "EVERYTHING. Go as deep as you have to"); any real leaf-level disagreement
// is a conflict, reported at the exact path it occurs, naming every
// disagreeing source and its own value.
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { packsDB } from "../../dblayer/packsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { getProfilePackSelections, resolveEffectiveParameters, extractExposedParameterOverrides } from "../../routes/seu/core/profiles.js";
import { deriveOverridableParameterCandidates, getDependencyGraphContent } from "../../routes/seu/core/templates.js";
import type { PackRow, ProfileRow, TemplateRow, EbmComposedPack } from "../../dblayer/seuTypes.js";

export type PoolSourceKind = "profile" | "template" | "pack";

export interface PoolSource {
  kind: PoolSourceKind;
  id: string;
  code: string;
  label: string;
}

export interface PoolEntry {
  propertyName: string;
  value: unknown;
  source: PoolSource;
}

export interface UnraveledComposition {
  pool: PoolEntry[];
  // Owner: "If we previewed and validated something, then what is the point
  // in doing something totally opposite. Whatever we validated is what
  // should go into the SEU." This is the SAME Pack set commissionSeu's own
  // EBM is built from — exposed here directly (not recomputed separately via
  // compositionEngine.compose()) so preview and commit share one answer.
  composedPacks: EbmComposedPack[];
  warnings: string[];
  // Owner: "the primary programming language should be unioned with the
  // technology competencies in the packs. It is an union. Same with domain
  // as well." One entry per category:pack dimension (CR-099) — a real
  // requirement set for this SEU, carried onto ebm.behaviors
  // (compositionCompleted.ts) and consumed by findEligibleParticipants
  // (core/participantEligibility.ts) as its `competency` filter. Not a
  // conflict-detection pool entry — a Profile's primaryProgrammingLanguage
  // disagreeing with a composed Pack's own Technology value isn't a
  // disagreement to flag, both simply contribute to the same requirement set.
  competencyRequirements: Record<string, string[]>;
}

export interface CompositionConflictOption {
  source: PoolSource;
  value: unknown;
}

export interface CompositionConflict {
  propertyName: string;
  options: CompositionConflictOption[];
  // false only for a Pack Dependency's own satisfiedInComposedSet violation —
  // there is no disagreeing sub-field for a composition strategy to
  // reconcile there, so the view renders no Action for that row.
  hasAction: boolean;
}

function toPoolSource(kind: PoolSourceKind, id: string, code: string, label: string): PoolSource {
  return { kind, id, code, label };
}

// Owner: "the primary programming language should be unioned with the
// technology competencies in the packs... Same with domain as well." The
// two Configuration Parameters explicitly given a real relationship to a
// Pack-contributed competency dimension (CR-099's category:pack-keyed
// `dimension`) — named directly by the owner, not a generic rule for every
// Configuration Parameter.
const CONFIGURATION_PARAMETER_COMPETENCY_UNIONS: Array<{ profileField: "primaryProgrammingLanguage" | "domain"; dimension: string }> = [
  { profileField: "primaryProgrammingLanguage", dimension: "Technology" },
  { profileField: "domain", dimension: "Domain" },
];

// Every Profile's own unioned Configuration Parameter value, plus every
// composed Pack's own declared competency (any dimension it declares, not
// just Technology/Domain — CR-099's own dimension vocabulary is
// Ontology-extensible to any category:pack code). A plain union, not a
// conflict — a Profile's primaryProgrammingLanguage and a composed Pack's
// own Technology value both simply become eligible values, never flagged
// as disagreeing with each other.
function computeCompetencyRequirements(profiles: ProfileRow[], composedPacks: Map<string, PackRow>): Record<string, string[]> {
  const values: Record<string, Set<string>> = {};
  const add = (dimension: string, value: string) => {
    (values[dimension] ??= new Set<string>()).add(value);
  };

  for (const { profileField, dimension } of CONFIGURATION_PARAMETER_COMPETENCY_UNIONS) {
    for (const profile of profiles) {
      const draft = (profile.draft_content ?? {}) as Record<string, unknown>;
      const v = draft[profileField];
      if (typeof v === "string" && v) add(dimension, v);
    }
  }
  for (const pack of composedPacks.values()) {
    for (const c of pack.contributions?.competencies ?? []) {
      if (c.dimension && c.value) add(c.dimension, c.value);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [dimension, set] of Object.entries(values)) result[dimension] = [...set];
  return result;
}

async function resolveActivePack(code: string): Promise<PackRow | null> {
  const { data } = await packsDB.findActiveByCode(code);
  return data ?? null;
}

// Walks a Pack's own dependencies[] transitively, cycle-safe, collecting
// every Pack actually reachable — not just the ones the Template/Profile
// selected directly. Returns every resolved Pack (deduped by code) plus the
// full set of resolved codes (needed for Pack Dependency's own
// satisfiedInComposedSet check below).
async function resolveComposedPacksTransitively(rootCodes: string[]): Promise<{ resolved: Map<string, PackRow>; warnings: string[] }> {
  const resolved = new Map<string, PackRow>();
  const warnings: string[] = [];
  const rootSet = new Set(rootCodes);
  const visited = new Set<string>();
  const queue = [...new Set(rootCodes)];
  while (queue.length) {
    const code = queue.shift()!;
    if (visited.has(code)) continue;
    visited.add(code);
    const pack = await resolveActivePack(code);
    if (!pack) {
      // Matches compose()'s own warning semantics — a directly-selected Pack
      // code (Template mandatory or one of Profile's 7 slots) with no Active
      // version is worth flagging; a transitively-reached dependency code
      // that fails to resolve is caught instead by the Pack Dependency pool
      // entry's own satisfiedInComposedSet check below.
      if (rootSet.has(code)) warnings.push(`Pack "${code}" has no Active version — skipped.`);
      continue;
    }
    resolved.set(pack.code, pack);
    for (const dep of pack.dependencies ?? []) {
      if (!visited.has(dep.packCode)) queue.push(dep.packCode);
    }
  }
  return { resolved, warnings };
}

export async function unravelComposition(input: { templateIds: string[]; profileIds: string[] }, viewerTenantId: string): Promise<UnraveledComposition> {
  const pool: PoolEntry[] = [];

  const templates: TemplateRow[] = [];
  const rootPackCodes: string[] = [];
  for (const templateId of input.templateIds) {
    const { data: template } = await templatesDB.findById(templateId);
    if (!template) continue;
    templates.push(template);
    const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(template.id);
    rootPackCodes.push(...(mandatoryCodes ?? []));
  }

  const profiles: ProfileRow[] = [];
  for (const profileId of input.profileIds) {
    const { data: profile } = await profilesDB.findById(profileId);
    if (!profile) continue;
    profiles.push(profile);
    const selections = await getProfilePackSelections(profile.id);
    rootPackCodes.push(
      ...(selections.optionalPackCodes ?? []),
      ...(selections.technologyPackCodes ?? []),
      ...(selections.domainPackCodes ?? []),
      ...(selections.compliancePackCodes ?? []),
      ...(selections.integrationPackCodes ?? []),
      ...(selections.engineeringPackCodes ?? []),
      ...(selections.organisationPackCodes ?? [])
    );
  }

  // Two different sets, deliberately: `composedPacks` is the traversal's own
  // display-completeness expansion (every Pack reachable via ANY dependency
  // type, so its own contributions are still unravelled even when it's only
  // present because something else needs it) — this is NOT the same as "this
  // SEU's real selection." `directlySelectedPackCodes` is the actual
  // selection (Template's mandatory set + every one of Profile's 7 slots,
  // root codes only) — this is what a `required`/`conditional` dependency's
  // own satisfaction is checked against. Using the expanded traversal set
  // for that check instead would be circular: any dependency that resolves
  // to a real Pack gets auto-included by the traversal itself, so nothing
  // could ever be reported unsatisfied.
  const directlySelectedPackCodes = new Set(rootPackCodes);
  const { resolved: composedPacks, warnings } = await resolveComposedPacksTransitively(rootPackCodes);

  // --- Profile fields -------------------------------------------------
  // Bug fix while building this: the 8 Configuration Parameters (CR-091 Part
  // 2) live in draft_content, keyed by their own field name directly — NOT
  // on the old, retired profile.config_parameters blob. Confirmed against
  // extractProfileDetails's own working, proven read of these exact fields
  // (core/profiles.ts) rather than assumed.
  for (const profile of profiles) {
    const profileSource = toPoolSource("profile", profile.id, profile.code, profile.name);
    const draft = (profile.draft_content ?? {}) as Record<string, unknown>;
    const simpleFields: Record<string, unknown> = {
      environment: profile.environment,
      developmentMethodology: draft.developmentMethodology,
      primaryProgrammingLanguage: draft.primaryProgrammingLanguage,
      sourceControlProvider: draft.sourceControlProvider,
      targetCloudProvider: draft.targetCloudProvider,
      deploymentStrategy: draft.deploymentStrategy,
      aiProviderPreference: draft.aiProviderPreference,
      defaultRepositoryStructure: draft.defaultRepositoryStructure,
      documentationLevel: draft.documentationLevel,
      domain: draft.domain,
      participatingOrganisationCodes: draft.participatingOrganisationCodes,
      environmentConfiguration: draft.environmentConfiguration,
      deploymentTargets: draft.deploymentTargets,
      additionalCapabilityCodes: draft.additionalCapabilityCodes,
      featureFlagCodes: draft.featureFlagCodes,
      compositionOptions: draft.compositionOptions,
    };
    for (const [propertyName, value] of Object.entries(simpleFields)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
      pool.push({ propertyName, value, source: profileSource });
    }

    // Profile's own additionalCapabilityCodes join the SAME code space Pack-
    // contributed Capabilities use (one entry per code, not the whole list),
    // so a genuine collision (a code a Pack also contributes) is caught the
    // same way as everything else.
    for (const code of (draft.additionalCapabilityCodes as string[] | undefined) ?? []) {
      pool.push({ propertyName: code, value: { code }, source: profileSource });
    }
  }

  // --- Template fields --------------------------------------------------
  for (const template of templates) {
    const templateSource = toPoolSource("template", template.id, template.code, template.name);
    if (template.deliverable_catalogue && template.deliverable_catalogue.length > 0) {
      pool.push({ propertyName: "deliverableCatalogue", value: template.deliverable_catalogue, source: templateSource });
    }
    const dependencyGraph = await getDependencyGraphContent(template.id, viewerTenantId);
    if (dependencyGraph.length > 0) {
      pool.push({
        propertyName: "dependencyGraph",
        value: dependencyGraph.map((e) => ({ toCode: e.toCode, fromType: e.fromType, fromCapabilityCode: e.fromCapabilityCode, fromCode: e.fromCode })),
        source: templateSource,
      });
    }
  }

  // --- Exposed parameters: value-bearing cascade (Template default, or
  // Profile's own override where set) — the RESOLVED effective value only,
  // never the raw default and raw override as two separate entries (that
  // pairing is a single-lineage cascade, not a disagreement). Source is
  // whichever side the effective value actually came from.
  for (const profile of profiles) {
    const profileSource = toPoolSource("profile", profile.id, profile.code, profile.name);
    const { data: baseTemplate } = await templatesDB.findById(profile.base_template_id);
    const templateSource = baseTemplate ? toPoolSource("template", baseTemplate.id, baseTemplate.code, baseTemplate.name) : profileSource;
    const effective = await resolveEffectiveParameters(profile);
    for (const p of effective) {
      const key = `${p.sourceType}::${p.sourceCode}::${p.parameterName}`;
      pool.push({ propertyName: key, value: p.effectiveValue, source: p.overriddenByProfile ? profileSource : templateSource });
    }

    // Filter-shaped candidates (Policy applicability, Checklist
    // configurableKey) — resolveEffectiveParameters skips these entirely
    // (they carry no Template-side value, only overridable); a Profile's own
    // stored override is the only possible pool entry for one of these keys
    // — no override means nothing to show, there is no default to fall back
    // to.
    if (baseTemplate) {
      const overridable = await deriveOverridableParameterCandidates(baseTemplate.code, viewerTenantId);
      const overrides = extractExposedParameterOverrides(profile.draft_content);
      for (const candidate of overridable.filter((c) => !c.valueBearing)) {
        const key = `${candidate.sourceType}::${candidate.sourceCode}::${candidate.parameterName}`;
        const override = overrides.find((o) => `${o.sourceType}::${o.sourceCode}::${o.parameterName}` === key);
        if (override) pool.push({ propertyName: key, value: override.value, source: profileSource });
      }
    }
  }

  // --- Every composed Pack's own contributions, read directly off the
  // already-resolved PackRow (no separate query, matching the same pattern
  // detectGovernanceConflicts itself already uses for authorityRules/
  // qualityGates) — except Policies, which need the separate, already-
  // materialised per-Pack adoption row for their real governedTransition.
  for (const pack of composedPacks.values()) {
    const packSource = toPoolSource("pack", pack.id, pack.code, pack.code);
    const c = pack.contributions ?? {};

    for (const cap of c.capabilities ?? []) {
      pool.push({ propertyName: cap.code, value: { code: cap.code }, source: packSource });
    }
    for (const svc of c.services ?? []) {
      pool.push({ propertyName: svc.code, value: { code: svc.code, serviceLevel: svc.serviceLevel ?? [] }, source: packSource });
    }
    // Bug fix, found on review: a single Pack legitimately assigning several
    // different roles to the SAME governedTransition is real, deliberate
    // design (confirmed live: core-engineering's own "knowledgescope.transition"
    // -> general/power/super), not a disagreement — detectGovernanceConflicts
    // itself already knows this (it aggregates roles per Pack before ever
    // comparing across Packs). Pushing one pool entry per individual rule
    // would treat that one Pack's own multi-role design as several sources
    // disagreeing with each other. Aggregate this Pack's own roles per
    // governedTransition into one set first — only a genuine difference in
    // role-SETS between two different Packs is a real conflict.
    const rolesByTransition = new Map<string, Set<string>>();
    for (const rule of c.authorityRules ?? []) {
      const roles = rolesByTransition.get(rule.governedTransition) ?? new Set<string>();
      roles.add(rule.authorisedRole);
      rolesByTransition.set(rule.governedTransition, roles);
    }
    for (const [governedTransition, roles] of rolesByTransition) {
      pool.push({ propertyName: `authorityRule::${governedTransition}`, value: { governedTransition, authorisedRoles: [...roles].sort() }, source: packSource });
    }
    for (const gate of c.qualityGates ?? []) {
      pool.push({ propertyName: `qualityGate::${gate.governedTransition}::${gate.category}`, value: gate, source: packSource });
    }
    for (const checklist of c.checklists ?? []) {
      for (const item of checklist.items ?? []) {
        // No identity field on a Checklist item (no code; the checklist's
        // own name is a label, not a dedup key) — nothing to group these on,
        // so they simply never collide. Still added, for completeness/
        // display, under a key unique to this item (never shared, by
        // construction) so it appears once in the pool, never in conflicts.
        pool.push({ propertyName: `checklistItem::${pack.code}::${checklist.name}::${JSON.stringify(item)}`, value: item, source: packSource });
      }
    }
    for (const gate of c.reviewGates ?? []) {
      pool.push({ propertyName: `reviewGate::${gate.code}::${gate.governedTransition}`, value: gate, source: packSource });
    }
    for (const ob of c.obligationDefinitions ?? []) {
      if (ob.code) pool.push({ propertyName: `obligationDefinition::${ob.code}`, value: ob, source: packSource });
    }
    for (const ec of c.engineeringCapital ?? []) {
      pool.push({ propertyName: `engineeringCapital::${pack.code}::${JSON.stringify(ec)}`, value: ec, source: packSource });
    }

    // Bug fix, found on review — the earlier design grouped Policies by
    // governedTransition and flagged a differing constraintType as a
    // conflict. Owner: "two policies do not have to agree on constraintType
    // at all. Quality gate handles both constraint types." Each adopted
    // Policy is a fully independent, coexisting rule — a transition can
    // legitimately carry several policies at once, some Standard, some
    // Policy, each enforced on its own terms; there is nothing for two of
    // them to "disagree" on. Policies are informational, exactly like
    // Capabilities — keyed by their own code (same code = same canonical
    // row, trivially identical; different codes = independent rules, never
    // compared against each other).
    const { data: policyRows } = await policiesDB.findByPackCode(pack.code);
    for (const policyRow of policyRows ?? []) {
      const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyRow.code, viewerTenantId);
      if (!definition) continue;
      pool.push({
        propertyName: `policy::${definition.code}`,
        value: {
          code: definition.code,
          governedTransition: policyRow.governed_transition,
          constraintType: definition.constraint_type,
          applicabilityDeliverableNames: definition.applicability_deliverable_names,
          applicabilityEnvironments: definition.applicability_environments,
          applicabilityDeliverableLifecycle: definition.applicability_deliverable_lifecycle,
          conditions: definition.conditions,
        },
        source: packSource,
      });
    }

    for (const dep of pack.dependencies ?? []) {
      pool.push({
        propertyName: dep.packCode,
        value: { type: dep.type, satisfiedInComposedSet: directlySelectedPackCodes.has(dep.packCode) },
        source: packSource,
      });
    }
  }

  return {
    pool,
    composedPacks: [...composedPacks.values()].map((pack) => ({ packId: pack.id, packCode: pack.code, packVersion: pack.pack_version })),
    warnings,
    competencyRequirements: computeCompetencyRequirements(profiles, composedPacks),
  };
}

// --- Conflict detection -----------------------------------------------
// No DB access — pure comparison over unravelComposition's own pool. New,
// independent implementation (not a call into compositionEngine.ts's own
// combineFields) — structurally similar in shape for the same reason that
// problem was already solved once there (recurse into nested objects
// unconditionally; recurse into nested arrays by matching items on whichever
// identity field they carry — code, then name — falling back to positional
// matching for same-length arrays with neither).
const ARRAY_IDENTITY_FIELDS = ["code", "name"];

function arrayIdentityField(arrays: unknown[][]): string | null {
  for (const field of ARRAY_IDENTITY_FIELDS) {
    const everyItemHasIt = arrays.every((arr) => arr.every((item) => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>)[field] === "string" && (item as Record<string, unknown>)[field] !== ""));
    if (everyItemHasIt) return field;
  }
  return null;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isDependencyShaped(value: unknown): boolean {
  const v = value as { type?: unknown; satisfiedInComposedSet?: unknown };
  return typeof v?.type === "string" && typeof v?.satisfiedInComposedSet === "boolean";
}

// entries: every pool entry sharing one top-level propertyName (2 or more —
// callers only invoke this once there's something to actually compare).
// Recurses to full depth (owner: "EVERYTHING. Go as deep as you have to"),
// reporting a conflict at the deepest path a real disagreement exists,
// rather than flagging the whole top-level value wholesale. `hasAction` is
// threaded through the recursion rather than always true: a Pack
// Dependency's own {type, satisfiedInComposedSet} shape (two Packs declaring
// different relationship types to the same target) has no field a
// composition strategy could reconcile either, same reasoning as the
// single-entry satisfiedInComposedSet violation below.
function diffEntries(entries: PoolEntry[], path: string, hasAction: boolean): CompositionConflict[] {
  const values = entries.map((e) => e.value);
  if (values.every((v) => isDeepEqual(v, values[0]))) return [];

  const allPlainObjects = values.every((v) => typeof v === "object" && v !== null && !Array.isArray(v));
  if (allPlainObjects) {
    const stillHasAction = hasAction && !values.some(isDependencyShaped);
    const keys = new Set<string>();
    for (const v of values) for (const k of Object.keys(v as Record<string, unknown>)) keys.add(k);
    const conflicts: CompositionConflict[] = [];
    for (const key of keys) {
      const present = entries.filter((e) => key in (e.value as Record<string, unknown>));
      if (present.length < 2) continue;
      const subEntries = present.map((e) => ({ ...e, value: (e.value as Record<string, unknown>)[key] }));
      conflicts.push(...diffEntries(subEntries, `${path}.${key}`, stillHasAction));
    }
    return conflicts;
  }

  const allArrays = values.every((v) => Array.isArray(v));
  if (allArrays) {
    const arrays = values as unknown[][];
    const identityField = arrayIdentityField(arrays);
    if (identityField) {
      const byIdentity = new Map<string, PoolEntry[]>();
      entries.forEach((e, i) => {
        for (const item of arrays[i] as Array<Record<string, unknown>>) {
          const idVal = String(item[identityField]);
          const list = byIdentity.get(idVal) ?? [];
          list.push({ ...e, value: item });
          byIdentity.set(idVal, list);
        }
      });
      const conflicts: CompositionConflict[] = [];
      for (const [idVal, items] of byIdentity) {
        if (items.length < 2) continue;
        conflicts.push(...diffEntries(items, `${path}[${identityField}=${idVal}]`, hasAction));
      }
      return conflicts;
    }
    if (arrays.every((a) => a.length === arrays[0].length)) {
      const conflicts: CompositionConflict[] = [];
      for (let idx = 0; idx < arrays[0].length; idx++) {
        const subEntries = entries.map((e, i) => ({ ...e, value: (arrays[i] as unknown[])[idx] }));
        conflicts.push(...diffEntries(subEntries, `${path}[${idx}]`, hasAction));
      }
      return conflicts;
    }
  }

  // No structural way to recurse further — this is the deepest real
  // disagreement on this path.
  return [{ propertyName: path, options: entries.map((e) => ({ source: e.source, value: e.value })), hasAction }];
}

// resolvedConflicts: the human's own prior picks, keyed by the conflict's
// own propertyName (or the deeper path a nested disagreement was actually
// reported at) — a key already present here is honoured as resolved and
// excluded from the result, mirroring compositionEngine.ts's own
// resolvedParameterOverrides exactly (this function never guesses a winner
// on its own, same as that one doesn't).
export function detectCompositionConflicts(unraveled: UnraveledComposition, resolvedConflicts: Record<string, unknown> = {}): CompositionConflict[] {
  const byProperty = new Map<string, PoolEntry[]>();
  for (const entry of unraveled.pool) {
    const list = byProperty.get(entry.propertyName) ?? [];
    list.push(entry);
    byProperty.set(entry.propertyName, list);
  }

  // Bug fix, found by tracing "what happens when the resolution attempt
  // itself still doesn't produce a real value" (e.g. Intersection genuinely
  // finding nothing in common): checking key presence alone (`in`) treats
  // that as resolved, since the key IS present — even though `undefined`
  // means nothing was actually resolved. An empty result must not silently
  // clear the conflict and let commissioning proceed; only a real, defined
  // value counts as resolved.
  const isReallyResolved = (propertyName: string) => propertyName in resolvedConflicts && resolvedConflicts[propertyName] !== undefined;
  const conflicts: CompositionConflict[] = [];
  for (const [propertyName, entries] of byProperty) {
    if (entries.length < 2) continue;
    conflicts.push(...diffEntries(entries, propertyName, true).filter((c) => !isReallyResolved(c.propertyName)));
  }

  // Pack Dependency's own satisfiedInComposedSet fact — a real/incompatible
  // structural violation, not a value disagreement between two sources, so
  // it's checked separately (a single entry can be "wrong" on its own,
  // unlike everything above which needs 2+ entries to even compare) and
  // reported with hasAction:false (no field for a composition strategy to
  // reconcile — the fix is changing the Pack selection, not merging values).
  for (const entry of unraveled.pool) {
    const value = entry.value as { type?: string; satisfiedInComposedSet?: boolean };
    if (typeof value?.type !== "string" || typeof value?.satisfiedInComposedSet !== "boolean") continue;
    const violated = (value.type === "required" || value.type === "conditional") ? !value.satisfiedInComposedSet : value.type === "incompatible" ? value.satisfiedInComposedSet : false;
    if (violated) {
      conflicts.push({ propertyName: entry.propertyName, options: [{ source: entry.source, value: entry.value }], hasAction: false });
    }
  }

  return conflicts;
}

// Flat, human-readable rendering of one conflict — used for the EBM's own
// audit-record compositionReport.conflicts (a plain string list, same shape
// the old detectGovernanceConflicts output used) and for commissionSeu's
// rejection message. Not used for anything the human resolves interactively
// — that's the structured CompositionConflict itself, rendered by the view.
export function formatCompositionConflict(conflict: CompositionConflict): string {
  const options = conflict.options.map((o) => `${o.source.label} sets ${JSON.stringify(o.value)}`).join(", ");
  return `Conflict on "${conflict.propertyName}": ${options}.`;
}
