// Post-MVP Phase 9 — Pack Platform maturity (Ch.5 Pack Model, Ch.38 Pack
// Platform Architecture, Ch.39 Pack SDK Architecture, Ch.41 Version
// Management applied to Packs). Pack becomes the 11th TransitionEntityType,
// governed by the same generic transitionEngine every other entity type
// already uses (Ch.29 §10) — Draft -> Validated -> Published -> Active ->
// Deprecated -> Retired -> Archived, exactly the enum packs.status already
// had since MVP, just finally driven by something.
//
// validatePackSeed/publishPack together are this MVP's Pack SDK (Ch.39,
// scoped down — see Post-MVP Build Sequence.md's Phase 9 notes for the full
// list of cuts): no separate packaging artefact format (JSON stays the
// packaging format, satisfying Ch.39 §8's "internal packaging format is
// implementation-defined"), no digital signature/provenance verification
// (single-trusted-operator platform, same reasoning already recorded in
// Technology Decisions.md's Blockchain rejection note), no semver-range
// dependency matching (a declared dependency's Pack code must exist in the
// Registry; the exact declared version is not cross-checked).
import { packsDB } from "../../../dblayer/packsDB.js";
import { assertCanonicalCategory } from "./ontology.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { authorityRulesDB } from "../../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { reviewGatesDB } from "../../../dblayer/reviewGatesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { complianceDB } from "../../../dblayer/complianceDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { PackCategory, PackClassification, PackContributions, PackRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// CR-058 — governedTransition is authored as a single delimited value
// ("EntityType|fromState|toState"), picked from a referential list of real
// transition_definitions rows (owner: "the pack should not define something
// beyond what a transition definition already holds") — parsed back into
// the 3 real quality_gates columns here, the one place both shapes meet.
function parseGovernedTransition(value: string | undefined): { entityType: TransitionEntityType; fromState: string; toState: string } | null {
  const parts = (value ?? "").split("|");
  if (parts.length !== 3 || parts.some((p) => !p.trim())) return null;
  const [entityType, fromState, toState] = parts;
  return { entityType: entityType as TransitionEntityType, fromState, toState };
}

// CR-060, corrected same day — a gate's checklistIds entry can arrive in
// either of two shapes, because a raw Pack seed file and the live SDK
// authoring form can't both express a cross-Pack reference the same way
// (owner: "How does a raw Pack seed JSON file express a cross-Pack
// checklistIds reference before real database ids exist? - It cannot."):
//   1. A real, already-persisted checklists.id — how the form submits it.
//      Scoped, not platform-wide (owner, catching the original build's
//      over-broad reading: "any Pack's gate can point at any Pack's
//      checklist - i thought we said this is if the pack codes match. If
//      checklists are global, then we would have created a registry?"):
//      Policy's reach is genuinely unconstrained AND has its own global,
//      registry-like code namespace; Checklist has neither, deliberately
//      no registry (Ch.47 §16/§20) — so a referenced Checklist's own
//      originating Pack must share THIS Pack's `code` (any version/tenant,
//      not the literal same Pack row).
//   2. This SAME Pack's own declared checklists[].name, not yet persisted —
//      how a raw seed file must express it (mirrors
//      requires_accepted_review's deliverableName -> reviewGates[].code
//      resolution, CR-059's own same-Pack self-reference pattern) — always
//      within-scope trivially, since it's this exact Pack.
// Tried in that order: a same-Pack name match wins over treating the value
// as an id, since a raw seed file's checklist Name and a live UUID can
// never collide in practice.
async function validateChecklistIds(checklistIds: string[] | undefined, seed: PackSeedInput, context: string): Promise<string[]> {
  const errors: string[] = [];
  for (const ref of checklistIds ?? []) {
    const samePackMatch = (seed.contributions.checklists ?? []).some((cl) => cl.name === ref);
    if (samePackMatch) continue;
    const { data: existing } = await checklistsDB.findById(ref);
    if (!existing) {
      errors.push(`${context} references unknown Checklist "${ref}" — must be either this Pack's own declared checklist name, or a real, already-published Checklist's id`);
      continue;
    }
    const { data: owningPack } = await packsDB.findById(existing.originating_pack_id);
    if (!owningPack || owningPack.code !== seed.code) {
      errors.push(`${context} references Checklist "${existing.name}" (id ${ref}) — its owning Pack's code does not match this Pack's own code "${seed.code}"; a Checklist may only be referenced by Packs sharing the same code`);
    }
  }
  return errors;
}

// CR-061 — a Quality Gate's requiredPolicyCodes entry, identical dual-shape
// resolution and code-scoping to validateChecklistIds above: either this
// same Pack's own declared policies[].code (raw seed JSON, not yet
// persisted), or an already-real, code-scoped cross-Pack policies.id
// (form-submitted — owner: "Similar to checklist, if the pack code
// matches, that policy has to be visible to all other packs").
async function validatePolicyCodes(policyRefs: string[] | undefined, seed: PackSeedInput, context: string): Promise<string[]> {
  const errors: string[] = [];
  for (const ref of policyRefs ?? []) {
    const samePackMatch = (seed.contributions.policies ?? []).some((p) => p.code === ref);
    if (samePackMatch) continue;
    const { data: existing } = await policiesDB.findByIds([ref]);
    const policy = existing?.[0];
    if (!policy) {
      errors.push(`${context} references unknown Policy "${ref}" — must be either this Pack's own declared policy code, or a real, already-published Policy's id`);
      continue;
    }
    const { data: owningPack } = await packsDB.findById(policy.originating_pack_id ?? "");
    if (!owningPack || owningPack.code !== seed.code) {
      errors.push(`${context} references Policy "${policy.name}" (id ${ref}) — its owning Pack's code does not match this Pack's own code "${seed.code}"; a Policy may only be referenced by Packs sharing the same code`);
    }
  }
  return errors;
}

// CR-058 follow-up 2 — a Quality Gate contribution has no author-typed
// `code` at all (owner: "the code isn't a UUID or a freeform Pack-specific
// string — it's the category identifier itself"). qualityGatesDB.upsert now
// sets `code = category` itself; no derivation needed here.

// CR-018 — §8/§13 metadata: recorded and validated for shape, not yet acted on
// (dependency resolution, compatibility checks, composition strategy remain the
// §19.9 engine follow-ups). Stored in packs.metadata (JSONB).
export type PackDependencyType = "required" | "optional" | "conditional" | "incompatible";
export interface PackSeedInput {
  code: string;
  name: string;
  category: PackCategory;
  packVersion: string;
  installationClassification: PackClassification;
  contributions: PackContributions;
  dependencies?: Array<{ packCode: string; version: string; type: PackDependencyType }>;
  // Pack ownership (owner: "Packs will have ownership... platform or the
  // tenant"). Optional: seed scripts/the CLI publishing with no human author
  // don't set it and get the Platform tenant (packsDB.create's own default);
  // the interactive authoring route always sets it from the real author's
  // own tenant (createAuthoringDraft); reactivateAsNewVersion always sets it
  // to the PRIOR row's own tenant_id (reactivation is versioning, never a
  // change of ownership).
  tenantId?: string;
  // §8 / §13 metadata (all optional, declaration-only)
  description?: string;
  owner?: string;
  publisher?: string;
  compositionStrategy?: string;
  supportedPlatformVersion?: string;
  minSupportedPlatformVersion?: string;
  maxSupportedPlatformVersion?: string;
  incompatiblePackVersions?: string;
  migrationGuidance?: string;
}

const PACK_METADATA_KEYS = [
  "description", "owner", "publisher", "compositionStrategy", "supportedPlatformVersion",
  "minSupportedPlatformVersion", "maxSupportedPlatformVersion", "incompatiblePackVersions", "migrationGuidance",
] as const;

// Collect the declaration-only §8/§13 fields off a seed into the metadata blob.
export function packMetadataFromSeed(seed: PackSeedInput): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const key of PACK_METADATA_KEYS) {
    const v = seed[key];
    if (typeof v === "string" && v.trim()) meta[key] = v.trim();
  }
  return meta;
}

const PACK_DEPENDENCY_TYPES: PackDependencyType[] = ["required", "optional", "conditional", "incompatible"];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export type PackValidationResult = { ok: true } | { ok: false; errors: string[] };

// Ch.39 §9/§7 Schema Validator + Dependency Validator, and FR-38.4/FR-38.5
// (dependencies resolved, conflicts detected before commissioning) applied
// at the one point they can actually be checked cheaply: publish time.
export async function validatePackSeed(seed: PackSeedInput): Promise<PackValidationResult> {
  const errors: string[] = [];

  if (!seed.name?.trim()) errors.push("name is required");
  // CR-022: Ontology concepts are tenant-scoped now (Platform's + this Pack's
  // own owning tenant) — scope the check by the Pack's own tenantId (its real
  // ownership, packsDB.create's own default when unset is the Platform
  // tenant, so an unauthored/CLI-published Pack sees Platform's vocabulary
  // only, same as before this change).
  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? PLATFORM_TENANT_ID };
  // CR-046 bug fix (owner: "why are test scripts adding code that is not in
  // the ontology??? I thought we fixed this") — code (migration 050,
  // capability-name, x-ontology: true) was the one Ontology-backed field on
  // this entire entity that never actually got assertCanonicalCategory
  // treatment, unlike category/installationClassification/compositionStrategy
  // right below, which all did from the start. The browser's own dropdown
  // (x-referential-select) already constrained a real author to a valid
  // value; this is what makes that constraint real for every OTHER caller —
  // tests, scripts, a future API client — not just the browser form.
  try {
    await assertCanonicalCategory("capability-name", seed.code ?? "", ontologyViewer);
  } catch (err) {
    errors.push((err as Error).message);
  }
  // CR-020: category is validated against the Ontology's category:pack
  // concepts (data), not a hardcoded list or the now-superseded pack_category
  // table — a new category is an Ontology Management data change, no code
  // change. assertCanonicalCategory throws; converted to an accumulated error
  // here since validatePackSeed collects every problem rather than failing fast.
  try {
    await assertCanonicalCategory("category:pack", seed.category ?? "", ontologyViewer);
  } catch (err) {
    errors.push((err as Error).message);
  }
  if (!SEMVER_RE.test(seed.packVersion ?? "")) errors.push(`packVersion must be semver (x.y.z), got: "${seed.packVersion}"`);
  // CR-020: same Ontology treatment as category — installation-classification
  // concepts (migration 051), not a hardcoded array.
  try {
    await assertCanonicalCategory("installation-classification", seed.installationClassification ?? "", ontologyViewer);
  } catch (err) {
    errors.push((err as Error).message);
  }
  // CR-030 (owner: "these have to be declared as composition strategy in
  // Ontology and on the pack, this is a dropdown field") — same Ontology
  // treatment, but compositionStrategy stays OPTIONAL (unlike category/
  // installationClassification): only validated when the author actually
  // set one, so an unset field remains valid exactly as it always was.
  if (seed.compositionStrategy?.trim()) {
    try {
      await assertCanonicalCategory("composition-strategy", seed.compositionStrategy, ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  function checkDuplicates(label: string, items: Array<{ code: string }> | undefined): void {
    const seen = new Set<string>();
    for (const item of items ?? []) {
      if (seen.has(item.code)) errors.push(`duplicate ${label} code within Pack: "${item.code}"`);
      seen.add(item.code);
    }
  }
  checkDuplicates("capability", seed.contributions.capabilities);
  checkDuplicates("service", seed.contributions.services);
  checkDuplicates("authority rule", seed.contributions.authorityRules);
  checkDuplicates("policy", seed.contributions.policies);

  // CR-058 — no author-typed `code` on a Quality Gate contribution
  // (deriveQualityGateCode above); duplicate detection within one Pack's
  // own contributions checks the real identity pair instead — two rows
  // targeting the same (governedTransition, category) would otherwise
  // silently collapse into the same derived code at insert time.
  const seenGateSlots = new Set<string>();
  for (const gate of seed.contributions.qualityGates ?? []) {
    const slotKey = `${gate.governedTransition ?? ""}::${gate.category ?? ""}`;
    if (seenGateSlots.has(slotKey)) errors.push(`duplicate quality gate within Pack: "${gate.governedTransition}" [${gate.category}] is targeted by more than one contribution`);
    seenGateSlots.add(slotKey);
  }

  // CR-058 — each Quality Gate contribution: category must be a canonical
  // category:evidence concept (CR-058 follow-up 2: reused directly, not a
  // separate quality-gate vocabulary — "the code isn't a UUID or a freeform
  // Pack-specific string — it's the category identifier itself, drawn from
  // the same Ontology-governed vocabulary as Ch.17 §7's Evidence
  // Categories"), governedTransition must resolve to a real
  // transition_definitions row (the Pack may not invent a transition that
  // doesn't already exist), and requires_active_policy must reference a
  // real, resolvable Policy code.
  for (const gate of seed.contributions.qualityGates ?? []) {
    try {
      await assertCanonicalCategory("category:evidence", gate.category ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
    const scope = parseGovernedTransition(gate.governedTransition);
    if (!scope) {
      errors.push(`quality gate "${gate.name}" has an invalid governedTransition — expected "EntityType|fromState|toState"`);
    } else {
      const { data: definition } = await transitionDefinitionsDB.find(scope.entityType, scope.fromState, scope.toState);
      if (!definition) {
        errors.push(`quality gate "${gate.name}" references a transition that doesn't exist: ${scope.entityType} ${scope.fromState} -> ${scope.toState}`);
      }
    }
    if (gate.criteriaType === "requires_active_policy") {
      if (!gate.requiredPolicyCodes?.length) {
        errors.push(`quality gate "${gate.name}" has criteriaType requires_active_policy but no requiredPolicyCodes`);
      } else {
        for (const err of await validatePolicyCodes(gate.requiredPolicyCodes, seed, `quality gate "${gate.name}"`)) errors.push(err);
      }
    }
    // CR-059 — requires_accepted_review must reference a real Review Gate,
    // never a free-text category (owner: "the qualitygate now has to show
    // the reviews in the dropdown to completely define it"). Scoped to this
    // same Pack's own contributions only (owner: "if something is global,
    // it has to be a policy" — Review Gates aren't the cross-Pack sharing
    // mechanism).
    if (gate.criteriaType === "requires_accepted_review") {
      if (!gate.deliverableName?.trim()) {
        errors.push(`quality gate "${gate.name}" has criteriaType requires_accepted_review but no deliverableName`);
      } else if (!(seed.contributions.reviewGates ?? []).some((rg) => rg.code === gate.deliverableName)) {
        errors.push(`quality gate "${gate.name}" references unknown Review Gate "${gate.deliverableName}" — the Review Gate must be declared in this same Pack's contributions`);
      }
    }
    for (const err of await validateChecklistIds(gate.checklistIds, seed, `quality gate "${gate.name}"`)) errors.push(err);
    for (const err of await validateChecklistIds(gate.recommendedChecklistIds, seed, `quality gate "${gate.name}"`)) errors.push(err);
  }

  // CR-059 — Review Gate contributions: `code` (the deliverable type it's
  // for) and `name` are both required; governedTransition must resolve to a
  // real transition_definitions row, same discipline as Quality Gate's own
  // scope check. `code` is picked via the same "deliverable-name" referential
  // dropdown Template's own Deliverable Catalogue uses, but — matching that
  // same field's own existing precedent (deliverableCatalogue.name is never
  // re-validated via assertCanonicalCategory either) — not independently
  // re-checked against the Ontology here: the concept's own code/default_label
  // mismatch (deliverable_definitions' human name is stored as default_label,
  // not the slug `code` assertCanonicalCategory matches on) would make that
  // check always fail, the same reason no other deliverable-name consumer
  // performs it.
  const seenReviewGateSlots = new Set<string>();
  for (const rg of seed.contributions.reviewGates ?? []) {
    if (!rg.code?.trim()) errors.push("review gate is missing a code (deliverable type)");
    if (!rg.name?.trim()) errors.push(`review gate "${rg.code}" is missing a name`);
    const scope = parseGovernedTransition(rg.governedTransition);
    if (!scope) {
      errors.push(`review gate "${rg.name}" has an invalid governedTransition — expected "EntityType|fromState|toState"`);
    } else {
      const { data: definition } = await transitionDefinitionsDB.find(scope.entityType, scope.fromState, scope.toState);
      if (!definition) errors.push(`review gate "${rg.name}" references a transition that doesn't exist: ${scope.entityType} ${scope.fromState} -> ${scope.toState}`);
    }
    const slotKey = `${rg.governedTransition ?? ""}::${rg.code ?? ""}`;
    if (seenReviewGateSlots.has(slotKey)) errors.push(`duplicate review gate within Pack: "${rg.governedTransition}" [${rg.code}] is targeted by more than one contribution`);
    seenReviewGateSlots.add(slotKey);
    for (const err of await validateChecklistIds(rg.checklistIds, seed, `review gate "${rg.name}"`)) errors.push(err);
    for (const err of await validateChecklistIds(rg.recommendedChecklistIds, seed, `review gate "${rg.name}"`)) errors.push(err);
  }

  // CR-060 — Checklist contributions: Name required, at least one Item, each
  // Item requires a Statement (Ch.47 §9). No Category/Capability/Applicable-Deliverable-Type/Applicable-
  // Transition to validate — Checklist carries none of that; whichever
  // Review/Quality Gate references it via checklistIds carries the scope
  // instead. Name uniqueness within the Pack matches checklistsDB.upsert's
  // own (originating_pack_id, name) key.
  const seenChecklistNames = new Set<string>();
  for (const cl of seed.contributions.checklists ?? []) {
    if (!cl.name?.trim()) errors.push("checklist is missing a name");
    else if (seenChecklistNames.has(cl.name)) errors.push(`duplicate checklist name within Pack: "${cl.name}"`);
    else seenChecklistNames.add(cl.name);
    if (!cl.items?.length) {
      errors.push(`checklist "${cl.name}" has no items`);
    } else {
      // CR-060, revised same day — an item is just its statement now
      // (owner: "you cannot determine a checklist item to be mandatory.
      // Checklist is generic. Pack has the specifics." — Mandatory/
      // Recommended moved to the referencing gate's own checklistIds/
      // recommendedChecklistIds, see validateChecklistIds below).
      cl.items.forEach((item, i) => {
        if (!item.statement?.trim()) errors.push(`checklist "${cl.name}" item ${i + 1} is missing a statement`);
      });
    }
  }

  // CR-061 — Policy contributions: Name/Category/Constraint Type/Governed
  // Transition required. Category is Ontology-backed (category:policy,
  // migration 107 — a new concept type, not reused from category:evidence/
  // category:pack, owner: "It does not change the policy category").
  // Governed Transition resolves to a real transition_definitions row, same
  // discipline as Quality Gate/Review Gate's own scope check — definition-
  // side only (owner: "we are not addressing this here" re: the evaluation
  // engine actually consulting it). Condition's flat, authored shape
  // (conditionType/conditionField/conditionValues) is structurally checked
  // here; reassembled into condition's real nested JSONB shape at
  // seedContributions time. code uniqueness matches policiesDB.upsert's own
  // (originating_pack_id, code) key.
  const seenPolicyCodes = new Set<string>();
  for (const policy of seed.contributions.policies ?? []) {
    if (!policy.code?.trim()) errors.push("policy is missing a code");
    else if (seenPolicyCodes.has(policy.code)) errors.push(`duplicate policy code within Pack: "${policy.code}"`);
    else seenPolicyCodes.add(policy.code);
    if (!policy.name?.trim()) errors.push(`policy "${policy.code}" is missing a name`);
    try {
      await assertCanonicalCategory("category:policy", policy.category ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
    const scope = parseGovernedTransition(policy.governedTransition);
    if (!scope) {
      errors.push(`policy "${policy.name}" has an invalid governedTransition — expected "EntityType|fromState|toState"`);
    } else {
      const { data: definition } = await transitionDefinitionsDB.find(scope.entityType, scope.fromState, scope.toState);
      if (!definition) errors.push(`policy "${policy.name}" references a transition that doesn't exist: ${scope.entityType} ${scope.fromState} -> ${scope.toState}`);
    }
    if (policy.conditionType === "field_in") {
      if (!policy.conditionField?.trim()) errors.push(`policy "${policy.name}" has conditionType field_in but no conditionField`);
      if (!policy.conditionValues?.trim()) errors.push(`policy "${policy.name}" has conditionType field_in but no conditionValues`);
    }
  }

  // CR-062 — Obligation Definition contributions: Code/Category required.
  // Category is Ontology-backed (category:obligation — already existed as a
  // real, working precedent, Ch.23 §19.4; 4 values added by migration 110).
  // Origin, if given, is Ontology-backed too (category:obligation-origin,
  // new concept type, migration 110). No real Obligation Definition table —
  // nothing cross-references one by id (unlike Checklist/Policy), so this
  // stays declaration-only validation, no seedContributions upsert.
  const seenObligationCodes = new Set<string>();
  for (const ob of seed.contributions.obligationDefinitions ?? []) {
    if (!ob.code?.trim()) errors.push("obligation definition is missing a code");
    else if (seenObligationCodes.has(ob.code)) errors.push(`duplicate obligation definition code within Pack: "${ob.code}"`);
    else seenObligationCodes.add(ob.code);
    try {
      await assertCanonicalCategory("category:obligation", ob.category ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
    if (ob.origin) {
      try {
        await assertCanonicalCategory("category:obligation-origin", ob.origin, ontologyViewer);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
  }

  // CR-064 — Service contributions: code is real, Ontology-backed
  // (service-name, migration 113 — freely-extensible, same capability-name/
  // feature-flag pattern, deliberately shared across Packs so two different
  // Packs can each declare their own row under the same canonical code).
  // capabilityCode stays same-Pack-only, unchanged. serviceLevel items each
  // need both label and target.
  const capabilityCodes = new Set((seed.contributions.capabilities ?? []).map((c) => c.code));
  for (const svc of seed.contributions.services ?? []) {
    if (!capabilityCodes.has(svc.capabilityCode)) {
      errors.push(`service "${svc.code}" references unknown capability "${svc.capabilityCode}" — the capability must be declared in this same Pack's contributions`);
    }
    try {
      await assertCanonicalCategory("service-name", svc.code ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
    (svc.serviceLevel ?? []).forEach((sl, i) => {
      if (!sl.label?.trim()) errors.push(`service "${svc.code}" service level ${i + 1} is missing a label`);
      if (!sl.target?.trim()) errors.push(`service "${svc.code}" service level ${i + 1} is missing a target`);
    });
  }

  for (const dep of seed.dependencies ?? []) {
    if (!PACK_DEPENDENCY_TYPES.includes(dep.type)) errors.push(`dependency "${dep.packCode}" has invalid type "${dep.type}" (${PACK_DEPENDENCY_TYPES.join(", ")})`);
    // CR-018: only a *required* dependency must resolve at author time. Optional/
    // conditional/incompatible resolution is enforcement (§19.9), out of scope here.
    if (dep.type === "required") {
      const { data: depPack } = await packsDB.findByCode(dep.packCode);
      if (!depPack) errors.push(`required dependency not resolved: Pack "${dep.packCode}" not found in the Registry`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export interface PublishPackResult {
  ok: boolean;
  pack?: PackRow;
  alreadyPublished?: boolean;
  supersededPack?: PackRow | null;
  errors?: string[];
}

// Split from publishPack below for one real reason: bootstrapping the very
// first Pack ever published. That Pack (platform-core-engineering) is the
// one that *contributes* the Authority Rule + Policy rows Pack transitions
// themselves require — but transition_definitions rows for the "Pack"
// entity type live in a separate seed file (transitionDefinitions.json),
// not inside any Pack's own contributions. On a fresh database there is a
// real ordering dependency: contributions must exist before
// transitionDefinitions.json can resolve their ids, and
// transitionDefinitions.json's Pack rows must exist before this Pack's own
// Draft -> Validated -> Published -> Active lifecycle can be driven through
// transitionEngine. createPackDraft/advancePackLifecycle let a caller
// interleave those two steps correctly for a genuinely first, bootstrap Pack
// (platform-core-engineering has this chicken-and-egg problem: its own
// contributions are what power its own transitions); every Pack published
// afterwards (including a second real Pack, or a second version of the
// first) has no such ordering problem and can just call the combined
// publishPack below.
export async function createPackDraft(seed: PackSeedInput): Promise<{ ok: true; pack: PackRow; alreadyExists: boolean } | { ok: false; errors: string[] }> {
  const validation = await validatePackSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  // CR-026 Part 2: scoped to this seed's own tenant — otherwise re-publishing
  // a Platform pack idempotently could resolve to a DIFFERENT tenant's
  // same-code-and-version row instead of treating it as a fresh publish.
  const { data: existing } = await packsDB.findByCodeAndVersion(seed.code, seed.packVersion, seed.tenantId ?? PLATFORM_TENANT_ID);
  if (existing) {
    await seedContributions(existing, seed);
    return { ok: true, pack: existing, alreadyExists: true };
  }

  const { data: pack, error } = await packsDB.create({ ...seed, metadata: packMetadataFromSeed(seed) });
  if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create pack")).message] };

  await eventBus.publish({
    eventType: "PackRegistered",
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { code: pack.code, packVersion: pack.pack_version },
  });

  await seedContributions(pack, seed);
  return { ok: true, pack, alreadyExists: false };
}

// Draft -> Validated -> Published, and optionally -> Active (superseding
// whichever version of the same code was previously Active), each hop a
// real, governed transitionEngine evaluation — not a direct status write.
// A no-op (returns the pack unchanged) if it's already past Draft, so this
// is safe to call again on a re-seeded, already-published Pack.
export async function advancePackLifecycle(pack: PackRow, actorRole: string, actorId: string | undefined, options?: { activate?: boolean }): Promise<PublishPackResult> {
  let currentPack = pack;

  if (currentPack.status === "Draft") {
    for (const targetState of ["Validated", "Published"]) {
      const result = await transitionPack({ packId: currentPack.id, targetState, actorRole, actorId });
      if (!result.ok) return { ok: false, pack: currentPack, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
      currentPack = result.pack;
    }
  }

  let supersededPack: PackRow | null = null;
  if (options?.activate && currentPack.status === "Published") {
    const { data: previousActive } = await packsDB.findActiveByCode(currentPack.code, currentPack.tenant_id);
    const activateResult = await transitionPack({ packId: currentPack.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return { ok: false, pack: currentPack, errors: [`transition to "Active" failed: ${"detail" in activateResult ? activateResult.detail : activateResult.reason}`] };
    currentPack = activateResult.pack;

    if (previousActive && previousActive.id !== currentPack.id) {
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
      if (supersedeResult.ok) supersededPack = supersedeResult.pack;
    }
  }

  return { ok: true, pack: currentPack, supersededPack };
}

// Entity-direct authoring, one hop at a time (owner: separation of duties —
// the seeded pack-validate@/pack-publish@/pack-activate@ Athens accounts each
// hold exactly ONE lifecycle verb; advancePackLifecycle above requires the
// SAME actor to hold every remaining verb to move a Draft at all, so a
// single-verb holder could never actually perform their own step through the
// authoring UI). Runs exactly the next governed hop off the Pack's CURRENT
// status — Draft->Validated (validate), Validated->Published (publish), or
// Published->Active (activate, with the same supersede-previous-Active
// behaviour advancePackLifecycle's activate step has). Each hop is its own
// transitionPack call, authorised on ONLY that hop's verb.
const AUTHORING_NEXT_STATE: Partial<Record<PackRow["status"], PackRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
};

export async function advancePackOneStep(pack: PackRow, actorRole: string, actorId: string | undefined): Promise<PublishPackResult> {
  const targetState = AUTHORING_NEXT_STATE[pack.status];
  if (!targetState) return { ok: false, pack, errors: [`Pack is already ${pack.status} — no further authoring step`] };

  if (targetState === "Active") {
    const { data: previousActive } = await packsDB.findActiveByCode(pack.code, pack.tenant_id);
    const activateResult = await transitionPack({ packId: pack.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return { ok: false, pack, errors: [`transition to "Active" failed: ${"detail" in activateResult ? activateResult.detail : activateResult.reason}`] };
    let supersededPack: PackRow | null = null;
    if (previousActive && previousActive.id !== activateResult.pack.id) {
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
      if (supersedeResult.ok) supersededPack = supersedeResult.pack;
    }
    return { ok: true, pack: activateResult.pack, supersededPack };
  }

  const result = await transitionPack({ packId: pack.id, targetState, actorRole, actorId });
  if (!result.ok) return { ok: false, pack, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
  return { ok: true, pack: result.pack };
}

// Ch.39's publish pipeline: validate -> create (Draft) -> seed contributions
// -> Validated -> Published -> optionally Active. Rerun-safe: publishing the
// exact same (code, packVersion) again is a no-op that returns the existing
// immutable row (VM-002) — the seed script and CLI can be re-run freely,
// same discipline as every migration in this codebase.
export async function publishPack(input: { seed: PackSeedInput; actorRole: string; actorId?: string; activate?: boolean }): Promise<PublishPackResult> {
  const draft = await createPackDraft(input.seed);
  if (!draft.ok) return { ok: false, errors: draft.errors };

  const advanced = await advancePackLifecycle(draft.pack, input.actorRole, input.actorId, { activate: input.activate });
  return { ...advanced, alreadyPublished: draft.alreadyExists };
}

async function seedContributions(pack: PackRow, seed: PackSeedInput): Promise<void> {
  const capabilityIdByCode = new Map<string, string>();
  for (const cap of seed.contributions.capabilities ?? []) {
    const { data: capability, error } = await capabilitiesDB.upsertFromPack({
      code: cap.code,
      name: cap.name,
      description: cap.description ?? null,
      version: pack.pack_version,
      originatingPackId: pack.id,
    });
    if (error || !capability) throw error ?? new Error(`capability upsert failed: ${cap.code}`);
    capabilityIdByCode.set(cap.code, capability.id);
  }

  for (const svc of seed.contributions.services ?? []) {
    const capabilityId = capabilityIdByCode.get(svc.capabilityCode);
    if (!capabilityId) throw new Error(`service ${svc.name} references unknown capability ${svc.capabilityCode}`);
    const { error } = await servicesDB.upsertFromPack({
      code: svc.code,
      providingCapabilityId: capabilityId,
      name: svc.name,
      contractDescription: svc.contractDescription,
      serviceLevel: svc.serviceLevel,
      originatingPackId: pack.id,
    });
    if (error) throw error;
  }

  for (const rule of seed.contributions.authorityRules ?? []) {
    const { error } = await authorityRulesDB.upsert({
      code: rule.code,
      governedTransition: rule.governedTransition,
      authorisedRole: rule.authorisedRole,
      originatingPackId: pack.id,
    });
    if (error) throw error;
  }

  // CR-061 — processed before qualityGates: a requires_active_policy gate
  // resolves its target Policies' real ids from this same map, mirroring
  // exactly how checklistIdByName/reviewGateIdByCode already work.
  // condition's flat, authored shape (conditionType/conditionField/
  // conditionValues) is reassembled into its real nested JSONB shape here —
  // the same criteriaType-flattening pattern Quality Gate's own criteria
  // already uses. Policy's identity is (originating_pack_id, code), not
  // global (owner: "it is not global so no versioning required similar to
  // checklist") — policiesDB.upsert keeps a Policy's id stable across every
  // republish of this Pack, same as checklistsDB.upsert.
  const policyIdByCode = new Map<string, string>();
  for (const policy of seed.contributions.policies ?? []) {
    const condition: Record<string, unknown> =
      policy.conditionType === "field_in"
        ? { type: "field_in", field: policy.conditionField, values: (policy.conditionValues ?? "").split(",").map((v) => v.trim()).filter(Boolean) }
        : { type: policy.conditionType ?? "always_true" };
    const { data: created, error } = await policiesDB.upsert({
      code: policy.code,
      name: policy.name,
      category: policy.category,
      constraintType: policy.constraintType,
      governedTransition: policy.governedTransition,
      condition,
      severity: policy.severity,
      originatingPackId: pack.id,
    });
    if (error || !created) throw error ?? new Error(`policy upsert failed: ${policy.code}`);
    policyIdByCode.set(policy.code, created.id);
  }
  const resolvePolicyCodes = (refs: string[] | undefined): string[] => (refs ?? []).map((ref) => policyIdByCode.get(ref) ?? ref);

  // CR-060 — processed before reviewGates/qualityGates: both may reference
  // a Checklist via checklistIds, resolved from this same map when the
  // reference is this same Pack's own checklist name (see
  // resolveChecklistIds's own comment for the two-shape resolution this
  // mirrors from requires_accepted_review's deliverableName). checklistsDB.
  // upsert keeps a Checklist's id stable across every republish of this
  // Pack (owner: "It stays"), keyed by (originating_pack_id, name).
  const checklistIdByName = new Map<string, string>();
  for (const cl of seed.contributions.checklists ?? []) {
    const { data: checklist, error } = await checklistsDB.upsert({
      name: cl.name,
      description: cl.description,
      items: cl.items,
      originatingPackId: pack.id,
    });
    if (error || !checklist) throw error ?? new Error(`checklist upsert failed: ${cl.name}`);
    checklistIdByName.set(cl.name, checklist.id);
  }
  // A checklistIds entry is either this same Pack's own checklist name
  // (resolved via checklistIdByName above) or an already-real, cross-Pack
  // checklists.id (validatePackSeed already confirmed it resolves one way
  // or the other) — pass real ids straight through.
  const resolveChecklistIds = (ids: string[] | undefined): string[] => (ids ?? []).map((ref) => checklistIdByName.get(ref) ?? ref);

  // CR-059 — processed before qualityGates: a requires_accepted_review gate
  // resolves its target Review Gate's real id from this same map, mirroring
  // exactly how capabilityIdByCode resolves a service's capabilityCode.
  const reviewGateIdByCode = new Map<string, string>();
  for (const rg of seed.contributions.reviewGates ?? []) {
    const scope = parseGovernedTransition(rg.governedTransition);
    if (!scope) throw new Error(`review gate "${rg.name}" has an invalid governedTransition (validatePackSeed should have caught this)`);
    const { data: reviewGate, error } = await reviewGatesDB.upsert({
      code: rg.code,
      name: rg.name,
      entityType: scope.entityType,
      fromState: scope.fromState,
      toState: scope.toState,
      originatingPackId: pack.id,
      checklistIds: resolveChecklistIds(rg.checklistIds),
      recommendedChecklistIds: resolveChecklistIds(rg.recommendedChecklistIds),
    });
    if (error || !reviewGate) throw error ?? new Error(`review gate upsert failed: ${rg.code}`);
    reviewGateIdByCode.set(rg.code, reviewGate.id);
  }

  for (const gate of seed.contributions.qualityGates ?? []) {
    const scope = parseGovernedTransition(gate.governedTransition);
    if (!scope) throw new Error(`quality gate "${gate.name}" has an invalid governedTransition (validatePackSeed should have caught this)`);
    // CR-058 — reassemble the flat, form-authored fields back into
    // quality_gates.criteria's nested shape.
    // CR-058 follow-up 2 — requires_accepted_evidence_or_approved_decision's
    // category narrowing now reads the gate's own `category` column
    // directly (qualityGateEngine.ts), so criteria stays a bare `{type}`
    // for it.
    // CR-059 — requires_accepted_review resolves its authored
    // `deliverableName` (a reviewGates[].code reference) to the real
    // Review Gate id created just above, once, here — not re-resolved at
    // evaluation time (owner: explicit reference, "save a db trip").
    // CR-061 — requires_active_policy resolves its authored
    // requiredPolicyCodes (same-Pack codes or already-real, code-scoped
    // cross-Pack ids) to real Policy ids the same way, once, here.
    const criteria: Record<string, unknown> =
      gate.criteriaType === "requires_active_policy"
        ? { type: gate.criteriaType, policyIds: resolvePolicyCodes(gate.requiredPolicyCodes) }
        : gate.criteriaType === "requires_accepted_review"
          ? { type: gate.criteriaType, reviewGateId: gate.deliverableName ? reviewGateIdByCode.get(gate.deliverableName) : undefined }
          : { type: gate.criteriaType ?? "no_unresolved_obligations" };
    const { error } = await qualityGatesDB.upsert({
      name: gate.name,
      category: gate.category,
      entityType: scope.entityType,
      fromState: scope.fromState,
      toState: scope.toState,
      criteria,
      originatingPackId: pack.id,
      checklistIds: resolveChecklistIds(gate.checklistIds),
      recommendedChecklistIds: resolveChecklistIds(gate.recommendedChecklistIds),
    });
    if (error) throw error;
  }

  // Compliance Model (Phase 15, Ch.27 FR-27.1): frameworks + their declarative
  // requirements, attributed to this Pack so per-SEU applicability follows the
  // SEU's composed Packs (FR-27.2).
  for (const framework of seed.contributions.complianceFrameworks ?? []) {
    const { error } = await complianceDB.upsertFramework({ code: framework.code, name: framework.name, description: framework.description, originatingPackId: pack.id });
    if (error) throw error;
  }
  for (const req of seed.contributions.complianceRequirements ?? []) {
    const { error } = await complianceDB.upsertRequirement({
      code: req.code,
      frameworkCode: req.frameworkCode,
      name: req.name,
      description: req.description,
      criteria: req.criteria,
      severity: req.severity,
      conflictsWith: req.conflictsWith,
      originatingPackId: pack.id,
    });
    if (error) throw error;
  }
}

// Ch.5 §15 / Ch.38 §15 event names, one per lifecycle hop.
const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "PackValidated",
  Published: "PackPublished",
  Active: "PackActivated",
  Deprecated: "PackDeprecated",
  Retired: "PackRetired",
  Archived: "PackArchived",
};

// A Pack transitioning back to Active from one of these does not resurrect
// its own row (see reactivateAsNewVersion below) — added per
// Open Design Questions.md, logged there for a relook during Phase 9/10.
const TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

export type TransitionPackResult =
  | { ok: true; pack: PackRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  // Structurally unreachable today (Pack has no seu_id — see the doc comment
  // below), but transitionEngine.evaluate's return type now includes this
  // reason unconditionally (SDK UI Layer Plan), so it's handled here for
  // type-correctness even though nothing can currently produce it.
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

// Post-completion fix (Open Design Questions.md #3): every SEU-scoped entity
// type now runs its transition through qualityGateEngine.evaluate first,
// same as transitionDeliverable always has. Pack deliberately does not — a
// Pack has no seu_id at all (it's platform-wide, not SEU-scoped), and
// quality_gate_evaluations.seu_id is NOT NULL, so there is nowhere to record
// an evaluation against. Logged as a real, structural limitation, not
// silently skipped.
export async function transitionPack(input: { packId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionPackResult> {
  const { data: pack } = await packsDB.findById(input.packId);
  if (!pack) return { ok: false, reason: "not_found" };

  const fromState = pack.status;
  const gate = await transitionEngine.evaluate({
    entityType: "Pack",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { pack },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Pack ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  // Reactivating from a terminal state: governance above already authorised
  // this specific (fromState -> Active) transition — what actually happens
  // is a new Version, not a status flip on this row (immutable per VM-002).
  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    const result = await reactivateAsNewVersion(pack, input.actorRole, input.actorId);
    if (!result.ok || !result.pack) {
      return { ok: false, reason: "policy_blocked", detail: result.errors?.join("; ") ?? "reactivation failed" };
    }
    return { ok: true, pack: result.pack, appliedTransition: { fromState, toState: input.targetState } };
  }

  const { data: updated, error } = await packsDB.updateStatus(pack.id, input.targetState as PackRow["status"]);
  if (error || !updated) throw error ?? new Error("failed to update pack status");

  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "PackTransitioned",
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: pack.code, packVersion: pack.pack_version },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, pack: updated, appliedTransition: { fromState, toState: input.targetState } };
}

// Ch.41 VM-002 "Versions are immutable" — reactivating a Deprecated/Retired/
// Archived Pack back to Active must never resurrect the old row in place;
// that would mutate a published Version after the fact, and could leave two
// rows of the same code simultaneously Active with no record of which one
// is "real." Instead this publishes a brand new Version carrying the same
// content (name/category/classification/contributions/dependencies) as the
// old row, auto-bumping the patch number until an unused (code,
// packVersion) is found, then runs it through the normal Draft -> Validated
// -> Published -> Active pipeline — which also supersedes whatever else is
// currently Active for this code, same as any other activation. The old row
// itself is untouched and stays at its old status forever.
async function reactivateAsNewVersion(pack: PackRow, actorRole: string, actorId: string | undefined): Promise<PublishPackResult> {
  const nextVersion = await nextAvailablePatchVersion(pack.code, pack.pack_version, pack.tenant_id);
  const seed: PackSeedInput = {
    code: pack.code,
    name: pack.name,
    category: pack.category,
    packVersion: nextVersion,
    installationClassification: pack.installation_classification,
    contributions: pack.contributions,
    dependencies: pack.dependencies,
    // Reactivation is versioning, not a change of ownership — the new
    // Version stays owned by whichever tenant (or Platform) the ORIGINAL
    // Pack belonged to, regardless of who holds the badge that triggers it.
    tenantId: pack.tenant_id,
  };
  return publishPack({ seed, actorRole, actorId, activate: true });
}

// CR-026 Part 2: scoped to the reactivating Pack's own tenant — a bumped
// version only needs to dodge THIS tenant's own existing rows, not every
// other tenant (or Platform's) unrelated same-code history.
async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    const { data: existing } = await packsDB.findByCodeAndVersion(code, candidate, tenantId);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for Pack ${code} after bumping from ${fromVersion}`);
}

// Registry "Copy" action (owner, 2026-08-19: "Add a Copy button... enabled
// for users that have *_define badge. It should create a copy and bump up
// the version"). Unlike reactivateAsNewVersion (reactivation, straight to
// Active) this lands in Draft — a real, editable starting point, not an
// instant republish. No lineage recorded (parent_template_id-style field
// doesn't exist on Pack) — a copy is not Inheritance (CR-026's parent-code-
// lock model): it's a new, independently-editable Draft that merely starts
// from this row's current content, same code, bumped version, same tenant
// (ownership doesn't change just because someone with authoring rights
// copied it forward).
export async function copyPackAsNewDraft(packId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await packsDB.findById(packId);
  if (!source) return { ok: false, errors: ["Pack not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.pack_version, source.tenant_id);
  const { data: pack, error } = await packsDB.create({
    code: source.code,
    name: source.name,
    category: source.category,
    packVersion: nextVersion,
    installationClassification: source.installation_classification,
    contributions: source.contributions,
    dependencies: source.dependencies,
    metadata: source.metadata,
    authoredBy: Number(actorId),
    tenantId: source.tenant_id,
  });
  if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to copy Pack")).message] };
  return { ok: true, draftId: pack.id };
}

export interface PackWithNextStates {
  pack: PackRow;
  possibleNextStates: string[];
}

// Registry listing (Ch.38 §10) — every Version of every Pack, newest first
// within each code, with its own governed next states.
// Pack ownership visibility (owner: "Platform packs will be available to all
// users of the platform. Tenant packs are visible only to the tenant
// users."). viewer null = unscoped (root — sees every Pack, every tenant).
export async function listPacksWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<PackWithNextStates[]> {
  const { data: packs } = viewer && !viewer.isRoot ? await packsDB.findAllVisibleTo(viewer.tenantId) : await packsDB.findAll();
  return Promise.all(
    (packs ?? []).map(async (pack) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Pack", pack.status);
      return { pack, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
