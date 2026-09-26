// Post-MVP Phase 9 — Pack Platform maturity (Ch.5 Pack Model, Ch.38 Pack
// Platform Architecture, Ch.39 Pack SDK Architecture, Ch.41 Version
// Management applied to Packs). Pack becomes the 11th TransitionEntityType,
// governed by the same generic transitionEngine every other entity type
// already uses (Ch.29 §10) — Draft -> Validated -> Published -> Active ->
// Retired -> Archived (CR-080 — Deprecated dropped, plus a Validated -> Draft
// Reject hop), driven by real transition_definitions rows (migration 137).
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
import { assertCanonicalCategory, validateOntologyFieldsAgainstSchema, validateComposableFieldsAgainstSchema } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { authorityRulesDB } from "../../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { backfillAuthorityRuleCode, backfillPolicyCode } from "../../../dblayer/seed/seedTransitionDefinitions.js";
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { reviewGatesDB } from "../../../dblayer/reviewGatesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { listActiveNouns } from "./authorityVocabulary.js";
import { listTransitionsForEntityType } from "./policyDefinitions.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { compositionEngine } from "../../../domain/engine/compositionEngine.js";
import type { PackCategory, PackClassification, PackContributions, PackRow, PolicyCondition, PolicyDefinitionRow, PolicyScope, TransitionEntityType } from "../../../dblayer/seuTypes.js";

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

// CR-089 follow-on — deliverable-names produced by this Pack's own declared
// Capabilities, via each Capability's canonical Service Definition outputs
// (Ch.11) — same "capability -> Service Definition -> outputs" walk
// loadPackCodesCapabilityCoverage (web/sdkAuthoring.ts) already runs for
// Template's own Pack Codes tab, one level up (there: deliverable-names ->
// capabilities; here: capabilities -> deliverable-names). The narrowing
// signal contributionPolicies[] needed (CR-089's own open question 1,
// resolved this session) — a canonical Policy has no direct Capability tie,
// but its applicabilityDeliverableNames does, indirectly, through this walk.
async function deliverableNamesFromCapabilityCodes(capabilityCodes: string[], viewerTenantId: string): Promise<Set<string>> {
  const { data: definitions } = await serviceDefinitionsDB.findAllVisibleTo(viewerTenantId);
  const names = new Set<string>();
  const capSet = new Set(capabilityCodes);
  for (const def of definitions ?? []) {
    if (def.status !== "Active" || !capSet.has(def.capability_code)) continue;
    for (const code of (def.outputs as unknown as string[] | null) ?? []) names.add(code);
  }
  return names;
}

// CR-089 follow-on, superseded by migration 214, then 216, then 219 (owner:
// "I am inclined to move the applicability inside the condition. That is
// more practical" — "2 reviewers required for Code, sign-off required for
// Deployment Plan" is really two independently-scoped conditions, not one
// condition-set uniformly applied to one shared applicability list; "The
// governing condition should be within applicability deliverables" — each
// (name, transitions) row now carries its own real governing rule too, not
// one rule shared by every row the condition happens to list).
// applicabilityDeliverables now lives on each CONDITION, not the Definition
// — this resolves one condition's own {name, transitions, governingCondition}
// rows into one materialized `policies` row per (name, transition) pair,
// carrying THAT row's own governingCondition through unchanged. A row
// naming no transitions falls back to the same single default this
// mechanism always had ("matches every state") — Deliverable|Approved|Baselined,
// scoped to that row's own name. A condition with an empty
// applicabilityDeliverables altogether (no rows at all — the common case
// for every one of the 34 real seeded Definitions until reseeded) falls
// back to one unscoped (no name filter) row on that same default
// transition, no governingCondition. scope=Eligibility never materializes
// by transition at all (Eligibility policies are resolved live off
// Template/Profile composition, never EBM-materialised or
// governedTransition-matched — compositionCompleted.ts) — one row per named
// noun, governedTransition null, transitions ignored. governedTransition
// itself is otherwise DROPPED as a separate override (owner: "Applicability
// already covers this. So drop governing transition") — applicability's own
// transitions[] are the only source now.
function governedTransitionsFor(scope: PolicyScope, applicabilityDeliverables: PolicyCondition["applicabilityDeliverables"]): Array<{ governedTransition: string | null; deliverableNames: string[]; governingCondition: Record<string, unknown> | null }> {
  if (scope === "Eligibility") {
    if (!applicabilityDeliverables.length) return [{ governedTransition: null, deliverableNames: [], governingCondition: null }];
    return applicabilityDeliverables.map((row) => ({ governedTransition: null, deliverableNames: [row.name], governingCondition: row.governingCondition }));
  }
  if (!applicabilityDeliverables.length) return [{ governedTransition: "Deliverable|Approved|Baselined", deliverableNames: [], governingCondition: null }];
  return applicabilityDeliverables.flatMap((row) =>
    row.transitions.length
      ? row.transitions.map((t) => ({ governedTransition: t, deliverableNames: [row.name], governingCondition: row.governingCondition }))
      : [{ governedTransition: "Deliverable|Approved|Baselined", deliverableNames: [row.name], governingCondition: row.governingCondition }]
  );
}

// Migration 216 — a Definition authored before this redesign (all 34 real
// seed Definitions, until reseeded) has an empty `conditions[]` altogether;
// this one synthetic condition reproduces exactly the pre-216 default
// materialization (one unscoped Deliverable|Approved|Baselined row,
// condition {"type":"always_true"}, severity "Medium") so every existing
// real Definition keeps composing identically. Never persisted — used only
// as a fan-out placeholder here.
const DEFAULT_CONDITION: PolicyCondition = {
  statement: "", severity: "Medium", applicabilityDeliverables: [],
  requiredEvidence: { title: "", category: "", description: "", collectionMethod: "" }, relatedObligations: [], exceptionRules: [],
};

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
    // CR-089 follow-on — contributions.policies is now a flat string[] of
    // adopted Policy Definition codes (not locally-named {code} rows), so
    // "this same Pack's own declared policy code" is just a plain membership
    // check now.
    const samePackMatch = (seed.contributions.policies ?? []).includes(ref);
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
  // CR-067 — the Pack(s) this Pack's compositionStrategy combines from.
  compositionSources?: Array<{ packCode: string }>;
  // Pack ownership (owner: "Packs will have ownership... platform or the
  // tenant"). Optional: seed scripts/the CLI publishing with no human author
  // don't set it and get the Platform tenant (packsDB.create's own default);
  // the interactive authoring route always sets it from the real author's
  // own tenant (createAuthoringDraft); copyPackAsNewDraft always sets it to
  // the PRIOR row's own tenant_id (copying is versioning, never a change of
  // ownership).
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

// CR-067 — a composition source's visibility mirrors every other Pack-code
// picker in this codebase (owner: "Platform packs will be available to all
// users of the platform. Tenant packs are visible only to the tenant
// users."): this tenant's own Active row for the code, falling back to
// Platform's. Real for Merge specifically — Pack's own identity is one
// Active row per (code, tenant); two DIFFERENT Active rows sharing a code
// only exist across Platform + a tenant (the "tenant-overrides-a-Domain-Pack"
// case CR-030's own Override definition names), never within one tenant.
export async function findActiveCompositionSource(code: string, tenantId: string): Promise<PackRow | null> {
  const { data: ownTenant } = await packsDB.findActiveByCode(code, tenantId);
  if (ownTenant) return ownTenant;
  if (tenantId === PLATFORM_TENANT_ID) return null;
  const { data: platform } = await packsDB.findActiveByCode(code, PLATFORM_TENANT_ID);
  return platform ?? null;
}

const PACK_DEPENDENCY_TYPES: PackDependencyType[] = ["required", "optional", "conditional", "incompatible"];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export type PackValidationResult = { ok: true } | { ok: false; errors: string[] };

// Ch.39 §9/§7 Schema Validator + Dependency Validator, and FR-38.4/FR-38.5
// (dependencies resolved, conflicts detected before commissioning) applied
// at the one point they can actually be checked cheaply: publish time.
//
// `skipComposableChecks` (owner: "whatever is x-ontology-composable will be
// gated at publish time"): `category`/`code` are schema-driven — whichever of
// them the Pack schema (schema_definitions) currently marks
// `x-ontology-composable` gets skipped here and deferred to
// validateComposableFieldsAgainstSchema at the Validated->Published hop
// instead (sdkAuthoring.ts); draft-save already proposes it rather than
// rejecting it (proposeComposableOntologyValues, core/ontology.ts). CR-112's
// own gap (owner: "idea of doing 112 was to have a single source of truth"):
// this used to hardcode both fields' concept types in TS (category:pack,
// `${category}-name`) — schema_definitions already declares both
// (x-referential-source/-by/-suffix, migrations 049/133), so marking a new
// field composable, or changing a concept type, is now purely a schema
// change here, no code change, via validateOntologyFieldsAgainstSchema/
// validateComposableFieldsAgainstSchema (core/ontology.ts).
export async function validatePackSeed(seed: PackSeedInput, options?: { skipComposableChecks?: boolean }): Promise<PackValidationResult> {
  const errors: string[] = [];

  if (!seed.name?.trim()) errors.push("name is required");
  // CR-022: Ontology concepts are tenant-scoped now (Platform's + this Pack's
  // own owning tenant) — scope the check by the Pack's own tenantId (its real
  // ownership, packsDB.create's own default when unset is the Platform
  // tenant, so an unauthored/CLI-published Pack sees Platform's vocabulary
  // only, same as before this change).
  const ontologyViewer = { isRoot: false, tenantId: seed.tenantId ?? PLATFORM_TENANT_ID };
  const { data: packSchemaRow } = await schemaDefinitionsDB.findLatest("Pack");
  if (packSchemaRow) {
    const packSchema = packSchemaRow.schema as JsonSchemaDocument;
    // contributionObligationDefinitions[].category, contributionEngineeringCapital[].type,
    // and contributionQualityGates[].category are x-ontology-composable too
    // (migration 276) — folded in here so the same schema-driven walker
    // (core/ontology.ts, recurses into array items) covers them, same as
    // code/category above. Their own hand-coded assertCanonicalCategory
    // checks further down are gone; this is now their only check.
    const ontologyContent = {
      code: seed.code, category: seed.category,
      contributionObligationDefinitions: seed.contributions.obligationDefinitions,
      contributionEngineeringCapital: seed.contributions.engineeringCapital,
      contributionQualityGates: seed.contributions.qualityGates,
    };
    errors.push(...(await validateOntologyFieldsAgainstSchema(packSchema, ontologyContent, ontologyViewer)));
    if (!options?.skipComposableChecks) {
      errors.push(...(await validateComposableFieldsAgainstSchema(packSchema, ontologyContent, ontologyViewer)));
    }
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
    // CR-067 — Conflict Detection is the escalation path inside Merge/Union,
    // not an independent, author-selectable strategy.
    if (seed.compositionStrategy === "conflict-detection") {
      errors.push(`"Conflict Detection" is not an independent Composition Strategy — it activates automatically inside Merge/Union. Choose one of the other strategies.`);
    } else {
      const req = compositionEngine.strategyRequirements(seed.compositionStrategy);
      const sourceCodes = (seed.compositionSources ?? []).map((s) => s.packCode).filter((c) => c?.trim());
      if (sourceCodes.length < req.minSources || (req.maxSources != null && sourceCodes.length > req.maxSources)) {
        const arity = req.maxSources == null ? `at least ${req.minSources}` : req.minSources === req.maxSources ? `exactly ${req.minSources}` : `${req.minSources}-${req.maxSources}`;
        errors.push(`Composition Strategy "${seed.compositionStrategy}" requires ${arity} composition source(s), got ${sourceCodes.length}.`);
      }
      if (req.sameCodeRequired && new Set(sourceCodes).size > 1) {
        errors.push(`Composition Strategy "${seed.compositionStrategy}" requires every composition source to share the same code — got: ${[...new Set(sourceCodes)].join(", ")}.`);
      }
      for (const code of sourceCodes) {
        const sourcePack = await findActiveCompositionSource(code, seed.tenantId ?? PLATFORM_TENANT_ID);
        if (!sourcePack) errors.push(`composition source Pack "${code}" has no Active Version visible to this tenant.`);
      }
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
  // CR-079 step (c) — a Capability contribution's own code is now real,
  // Ontology-backed (capability-name), same treatment CR-064 already gave
  // Service's own code below: the browser dropdown already constrains a
  // real author; this makes it real for every OTHER caller (JSON import,
  // seed files, tests, a future API client). Strictly enforced — no
  // free-text/"type new" path for this field (owner: "contributionCapabilities[].code
  // is a strict dropdown of the capability-name"), unlike Pack's own
  // top-level code.
  for (const cap of seed.contributions.capabilities ?? []) {
    try {
      await assertCanonicalCategory("capability-name", cap.code ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  checkDuplicates("service", seed.contributions.services);
  checkDuplicates("authority rule", seed.contributions.authorityRules);
  // CR-089 follow-on — policies is now a flat string[] of codes (no {code}
  // wrapper, unlike every other contribution type), so checkDuplicates'
  // generic Array<{code}> shape doesn't fit; checked directly instead.
  {
    const seenPolicyCodes = new Set<string>();
    for (const code of seed.contributions.policies ?? []) {
      if (seenPolicyCodes.has(code)) errors.push(`duplicate policy code within Pack: "${code}"`);
      seenPolicyCodes.add(code);
    }
  }

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
  // Categories") — checked generically above via contributionQualityGates in
  // ontologyContent (x-ontology-composable, migration 276), not here.
  // governedTransition must resolve to a real transition_definitions row
  // (the Pack may not invent a transition that doesn't already exist), and
  // requires_active_policy must reference a real, resolvable Policy code.
  for (const gate of seed.contributions.qualityGates ?? []) {
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
        // CR-088 prerequisite — configurableKey/configurableValue are a pair:
        // a dimension with no value can't be filtered on, and a value with no
        // named dimension has nothing to attach to.
        if (!!item.configurableKey?.trim() !== !!item.configurableValue?.trim()) {
          errors.push(`checklist "${cl.name}" item ${i + 1} has ${item.configurableKey?.trim() ? "a Configurable Dimension but no Configurable Value" : "a Configurable Value but no Configurable Dimension"}`);
        }
      });
    }
  }

  // CR-089 follow-on — Policy contributions: code now resolves against a
  // real Policy Definition (policy_definitions), same move CR-086 made for
  // Services above. Duplicate-code checked generically already
  // (checkDuplicates("policy", ...) below). Scoped the same way: the
  // Definition's own applicability_deliverable_names must intersect a
  // deliverable-name produced by this Pack's own declared Capabilities'
  // Service Definitions — or be empty ("matches every deliverable-name
  // today", the same always-present-list convention CR-089 established),
  // which always passes regardless of this Pack's Capabilities.
  const packCapabilityCodes = (seed.contributions.capabilities ?? []).map((c) => c.code);
  const packDeliverableNames = await deliverableNamesFromCapabilityCodes(packCapabilityCodes, ontologyViewer.tenantId ?? PLATFORM_TENANT_ID);
  for (const policyCode of seed.contributions.policies ?? []) {
    if (!policyCode?.trim()) {
      errors.push("policy is missing a code");
      continue;
    }
    const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyCode, ontologyViewer.tenantId ?? PLATFORM_TENANT_ID);
    if (!definition) {
      errors.push(`policy "${policyCode}" does not resolve to an Active Policy Definition visible to this tenant`);
      continue;
    }
    // Migration 216 dropped policy_definitions.applicability_deliverable_names
    // as a standalone column — deliverable-name scoping now lives per
    // condition, in each conditions[].applicabilityDeliverables[].name (see
    // PolicyDefinitionRow's own comment). Union across every condition to
    // reproduce the same "any named deliverable this Definition governs"
    // check the old single column used to answer directly.
    // This check only means anything for a Definition actually naming real
    // Deliverable types: scope "Eligibility" names Authority Vocabulary
    // nouns (e.g. "Participant"), not deliverable-names at all, and an
    // SEU-scoped scope "Transition" Definition (compositionCompleted.ts's
    // own `governed_transition?.startsWith("SEU|")` distinguishing signal)
    // names "SEU" itself, never something this Pack's Capabilities could
    // "produce" — both are out of scope for this check, same as the old
    // column's own always-Deliverable-shaped values were.
    const definitionDeliverableNames =
      definition.scope === "Eligibility"
        ? new Set<string>()
        : new Set(
            definition.conditions.flatMap((c) =>
              (c.applicabilityDeliverables ?? [])
                .filter((row) => !row.transitions.some((t) => t.startsWith("SEU|")) && row.name !== "SEU")
                .map((row) => row.name)
            )
          );
    if (definitionDeliverableNames.size > 0 && ![...definitionDeliverableNames].some((d) => packDeliverableNames.has(d))) {
      errors.push(`policy "${policyCode}" does not govern any deliverable-name produced by this Pack's own declared Capabilities`);
    }
  }

  // CR-104 — a Quality Gate's own applicabilityDeliverableNames. Unlike
  // Policy's applicability_deliverable_names above, this is NOT scoped to
  // "produced by this same Pack's own declared Capabilities" — a governance-
  // only Pack (a customer-signoff gate, say) legitimately targets a named
  // Deliverable it never produces itself; the Pack that produces a
  // Deliverable and the Pack that governs one of its transitions need not be
  // the same Pack. Validated the same way Template's own deliverableCatalogue
  // entries are (CR-087): each name must be a real, canonical deliverable-name
  // Ontology concept. Empty list always passes ("matches every deliverable
  // reaching this transition").
  for (const gate of seed.contributions.qualityGates ?? []) {
    for (const name of gate.applicabilityDeliverableNames ?? []) {
      try {
        await assertCanonicalCategory("deliverable-name", name, ontologyViewer);
      } catch (err) {
        errors.push(`quality gate "${gate.name}"'s applicabilityDeliverableNames: ${(err as Error).message}`);
      }
    }
  }

  // CR-062 — Obligation Definition contributions: Code/Category required.
  // Category is Ontology-backed (category:obligation — already existed as a
  // real, working precedent, Ch.23 §19.4; 4 values added by migration 110) —
  // checked generically above via contributionObligationDefinitions in
  // ontologyContent (x-ontology-composable, migration 276), not here.
  // Origin, if given, is Ontology-backed too (category:obligation-origin,
  // new concept type, migration 110) — not composable, still checked here.
  // No real Obligation Definition table — nothing cross-references one by id
  // (unlike Checklist/Policy), so this stays declaration-only validation, no
  // materializeContributions upsert.
  const seenObligationCodes = new Set<string>();
  // Migration 249 — applicabilityDeliverables reuses Policy's own
  // scope=Eligibility vocabulary exactly (validateConditions,
  // policyDefinitions.ts): a Pack never knows Deliverable identity, so name
  // is always a real Authority Vocabulary noun, never a Deliverable name.
  const validNouns = new Set((await listActiveNouns()).map((n) => n.code));
  for (const ob of seed.contributions.obligationDefinitions ?? []) {
    if (!ob.code?.trim()) errors.push("obligation definition is missing a code");
    else if (seenObligationCodes.has(ob.code)) errors.push(`duplicate obligation definition code within Pack: "${ob.code}"`);
    else seenObligationCodes.add(ob.code);
    if (ob.origin) {
      try {
        await assertCanonicalCategory("category:obligation-origin", ob.origin, ontologyViewer);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
    for (const [d, row] of (ob.applicabilityDeliverables ?? []).entries()) {
      const dLabel = `obligation definition "${ob.code ?? "?"}" applicabilityDeliverables ${d + 1}`;
      if (!row.name?.trim()) {
        errors.push(`${dLabel}: name is required`);
        continue;
      }
      if (!validNouns.has(row.name)) {
        errors.push(`${dLabel}: name "${row.name}" is not one of this platform's real active Authority Vocabulary nouns (${[...validNouns].join(", ")})`);
      }
      if (row.transitions.length) {
        const validTransitions = new Set(await listTransitionsForEntityType(row.name));
        for (const transition of row.transitions) {
          if (!validTransitions.has(transition)) errors.push(`${dLabel}: transition "${transition}" is not one of ${row.name}'s real transitions (${[...validTransitions].join(", ")})`);
        }
      }
    }
  }

  // CR-082 — Engineering Capital contributions: minimal stub (type + url).
  // type is Ontology-backed (engineering-capital, migration 141) — checked
  // generically above via contributionEngineeringCapital in ontologyContent
  // (x-ontology-composable, migration 276), not here. url is plain text, no
  // format check — "these should be in details later".
  for (const ec of seed.contributions.engineeringCapital ?? []) {
    if (!ec.url?.trim()) errors.push("engineering capital entry is missing a url");
  }

  // CR-099 — Competency contributions: {dimension, value}. dimension is
  // Ontology-backed off category:pack directly (the same vocabulary this
  // Pack's own `category` above already validates against — a Pack's
  // competency dimension and its own category are the same concept, not a
  // separate one); value is checked against dimension's own lower-cased
  // child concept type (e.g. dimension "Technology" -> concept type
  // "technology"). Owner: "Pack has to now define mandatory competency.
  // Otherwise it will lead to gaps" — required whenever this Pack's own
  // category is Technology or Domain, the two categories with a real
  // competency vocabulary to draw from (migrations 195/196).
  for (const comp of seed.contributions.competencies ?? []) {
    try {
      await assertCanonicalCategory("category:pack", comp.dimension ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
      continue;
    }
    try {
      await assertCanonicalCategory((comp.dimension ?? "").toLowerCase(), comp.value ?? "", ontologyViewer);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  if ((seed.category === "Technology" || seed.category === "Domain") && (seed.contributions.competencies ?? []).length === 0) {
    errors.push(`a ${seed.category} Pack must declare at least one Competency (contributionCompetencies)`);
  }

  // CR-086 follow-on (owner: "the services form should show all services
  // tied to the capabilities that are in contributions.capability[]...
  // Capability Code/Name/Contract Description... do not have to be stored")
  // — code now resolves against a real Service Definition (not a freestanding
  // service-name concept), and that Definition's own capability_code must be
  // one of THIS Pack's own declared Capabilities (mirrors the old
  // svc.capabilityCode check, just resolved off the Definition instead of a
  // stored field). serviceLevel overrides are validated against the
  // Definition's own rows — a Pack may only override a target the Definition
  // actually declares, never invent a new dimension.
  const capabilityCodes = new Set((seed.contributions.capabilities ?? []).map((c) => c.code));
  for (const svc of seed.contributions.services ?? []) {
    const { data: definition } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(svc.code ?? "", ontologyViewer.tenantId ?? PLATFORM_TENANT_ID);
    if (!definition) {
      errors.push(`service "${svc.code}" does not resolve to an Active Service Definition visible to this tenant`);
      continue;
    }
    if (!capabilityCodes.has(definition.capability_code)) {
      errors.push(`service "${svc.code}" is aligned to capability "${definition.capability_code}", which is not declared in this same Pack's own Capabilities`);
    }
    const definitionLevelCodes = new Set(definition.service_level.map((sl) => sl.code));
    for (const override of svc.serviceLevel ?? []) {
      if (!definitionLevelCodes.has(override.code)) {
        errors.push(`service "${svc.code}" overrides service level "${override.code}", which the Service Definition does not declare`);
      }
      if (typeof override.target !== "number" || Number.isNaN(override.target)) {
        errors.push(`service "${svc.code}" service level "${override.code}" target must be a number`);
      }
    }
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
    await materializeContributions(existing, seed);
    return { ok: true, pack: existing, alreadyExists: true };
  }

  // CR-114 follow-on — packsDB.create's schemaDefinitionId is now mandatory;
  // a bootstrap/seed-facing create (as opposed to the real SDK authoring
  // form, which lets an author pick) always pins to whatever's latest.
  const { data: packSchema } = await schemaDefinitionsDB.findLatest("Pack");
  if (!packSchema) return { ok: false, errors: [`no schema_definitions grammar for Pack`] };
  const { data: pack, error } = await packsDB.create({ ...seed, metadata: packMetadataFromSeed(seed), schemaDefinitionId: packSchema.id });
  if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create pack")).message] };

  // Version Feature Plan.md — materializeContributions must finish before the event
  // publishes, not after: nothing here reads the event or its result, so
  // the ordering was accidental, and "no logic after publish" (the event
  // pub-sub model takes over from here, not linear code) is a real rule
  // going forward, not just for Objective/Pack's own transitions.
  await materializeContributions(pack, seed);

  await eventBus.publish({
    eventType: "PackRegistered",
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { code: pack.code, packVersion: pack.pack_version },
  });

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
      // CR-080 — superseded-on-republish now lands on Retired directly (was
      // Deprecated, which never had any functional difference from Retired
      // anyway) — the same Active -> Retired hop the explicit lifecycle
      // wind-down step uses, not a separate mechanism.
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Retired", actorRole, actorId });
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
      // CR-080 — superseded-on-republish now lands on Retired directly (was
      // Deprecated, which never had any functional difference from Retired
      // anyway) — the same Active -> Retired hop the explicit lifecycle
      // wind-down step uses, not a separate mechanism.
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Retired", actorRole, actorId });
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

async function materializeContributions(pack: PackRow, seed: PackSeedInput): Promise<void> {
  const capabilityIdByCode = new Map<string, string>();
  for (const cap of seed.contributions.capabilities ?? []) {
    // Owner: "what is stored in contributionCapabilities[]? Just store only
    // the code" — name/description no longer travel with the Pack's own
    // authored row at all; resolved here from the capability-name Ontology
    // concept the code already validates against (validatePackSeed's own
    // assertCanonicalCategory check), the single real source for both.
    const { data: concept } = await ontologyDB.findConcept("capability-name", cap.code, { isRoot: false, tenantId: pack.tenant_id });
    const { data: capability, error } = await capabilitiesDB.upsertFromPack({
      code: cap.code,
      name: concept?.default_label ?? cap.code,
      description: concept?.description ?? null,
      version: pack.pack_version,
      originatingPackId: pack.id,
    });
    if (error || !capability) throw error ?? new Error(`capability upsert failed: ${cap.code}`);
    capabilityIdByCode.set(cap.code, capability.id);
  }

  for (const svc of seed.contributions.services ?? []) {
    // Owner: "the original service definition should not be overwritten" —
    // read-only lookup; this Pack's own overrides are merged into a fresh
    // array below and written only to `services` (the Pack-composed table),
    // never back to service_definitions.
    const { data: definition } = await serviceDefinitionsDB.findActiveByCodeVisibleTo(svc.code, pack.tenant_id);
    if (!definition) throw new Error(`service ${svc.code} does not resolve to an Active Service Definition`);
    const capabilityId = capabilityIdByCode.get(definition.capability_code);
    if (!capabilityId) throw new Error(`service ${svc.code} references unknown capability ${definition.capability_code}`);
    const overrideByCode = new Map<string, number>();
    for (const ov of svc.serviceLevel ?? []) overrideByCode.set(ov.code, ov.target);
    const mergedServiceLevel = definition.service_level.map((base) => ({
      ...base,
      target: overrideByCode.has(base.code) ? overrideByCode.get(base.code)! : base.target,
    }));
    const { error } = await servicesDB.upsertFromPack({
      code: svc.code,
      providingCapabilityId: capabilityId,
      name: definition.name,
      contractDescription: definition.purpose ?? "",
      serviceLevel: mergedServiceLevel,
      originatingPackId: pack.id,
    });
    if (error) throw error;
  }

  for (const rule of seed.contributions.authorityRules ?? []) {
    const { data: createdRule, error } = await authorityRulesDB.upsert({
      code: rule.code,
      governedTransition: rule.governedTransition,
      authorisedRole: rule.authorisedRole,
      originatingPackId: pack.id,
    });
    if (error || !createdRule) throw error ?? new Error(`authority rule upsert failed: ${rule.code}`);
    // 2026-08-25 — self-heals any transition_definitions row that wanted
    // this exact authority rule code but couldn't resolve it at seed time
    // (dev/test seed data; transitionDefinitions.json's own codes aren't
    // guaranteed to exist yet when it's seeded, see seedTransitionDefinitions.ts).
    await backfillAuthorityRuleCode(rule.code, createdRule.id);
  }

  // CR-089 follow-on, migration 216 — processed before qualityGates: a
  // requires_active_policy gate resolves its target Policies' real ids from
  // this same map, mirroring exactly how checklistIdByName/reviewGateIdByCode
  // already work. Fans out TWO levels now: once per condition (each
  // condition's own real severity/governingCondition — owner: "they will be
  // multiple rules on each deliverable. Transition X to Y has condition 1,
  // condition 2"), then once per that condition's own applicabilityDeliverables
  // (name, transition) pair (governedTransitionsFor, above). A condition
  // left without a governingCondition materializes as {"type":"always_true"}
  // — never blocks automatically, same default as before this redesign,
  // just per-condition now (owner: "If it is empty, the policy checking
  // will be manual"). Policy's identity is (originating_pack_id, code), not
  // global (owner: "it is not global so no versioning required similar to
  // checklist") — policiesDB.upsert keeps a Policy's id stable across every
  // republish of this Pack, same as checklistsDB.upsert; a fanned-out row's
  // own code is suffixed by its condition index and transition so each
  // stays distinct under that same identity.
  const policyIdByCode = new Map<string, string[]>();
  for (const policyCode of seed.contributions.policies ?? []) {
    const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(policyCode, pack.tenant_id);
    if (!definition) throw new Error(`policy ${policyCode} does not resolve to an Active Policy Definition`);
    const scope: PolicyScope = definition.scope ?? "Transition";
    const conditions = definition.conditions.length ? definition.conditions : [DEFAULT_CONDITION];
    const createdIds: string[] = [];
    for (const [condIndex, cond] of conditions.entries()) {
      const materializedRows = governedTransitionsFor(scope, cond.applicabilityDeliverables ?? []);
      const fansOut = conditions.length > 1 || materializedRows.length > 1;
      for (const { governedTransition, deliverableNames, governingCondition } of materializedRows) {
        const code = fansOut ? `${policyCode}::${condIndex}::${governedTransition ?? "none"}::${deliverableNames[0] ?? ""}` : policyCode;
        const { data: created, error } = await policiesDB.upsert({
          code,
          name: definition.name,
          category: definition.category,
          constraintType: definition.constraint_type,
          scope,
          governedTransition,
          condition: governingCondition ?? { type: "always_true" },
          severity: cond.severity || "Medium",
          originatingPackId: pack.id,
          applicabilityDeliverableNames: deliverableNames,
        });
        if (error || !created) throw error ?? new Error(`policy upsert failed: ${code}`);
        createdIds.push(created.id);
        // 2026-08-25 — same self-heal as authority rules, above.
        await backfillPolicyCode(policyCode, created.id);
      }
    }
    policyIdByCode.set(policyCode, createdIds);
  }
  const resolvePolicyCodes = (refs: string[] | undefined): string[] => (refs ?? []).flatMap((ref) => policyIdByCode.get(ref) ?? [ref]);

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
      applicabilityDeliverableNames: gate.applicabilityDeliverableNames ?? [],
    });
    if (error) throw error;
  }

}

export type TransitionPackResult =
  | { ok: true; pack: PackRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  // Structurally unreachable today (Pack has no seu_id — see the doc comment
  // below), but transitionEngine.evaluate's return type now includes this
  // reason unconditionally (SDK UI Layer Plan), so it's handled here for
  // type-correctness even though nothing can currently produce it.
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  // CR-080 — Reject (Validated -> Draft) requires feedback every time, and it
  // must actually be new text, not the same value as the most recent comment
  // already on record — mirrors Objective's CR-073 "comment_required"
  // discipline exactly (owner: "There has to be a comment field and a
  // similar implementation").
  | { ok: false; reason: "comment_required"; detail: string };

// Post-completion fix (Open Design Questions.md #3): every SEU-scoped entity
// type now runs its transition through qualityGateEngine.evaluate first,
// same as transitionDeliverable always has. Pack deliberately does not — a
// Pack has no seu_id at all (it's platform-wide, not SEU-scoped), and
// quality_gate_evaluations.seu_id is NOT NULL, so there is nowhere to record
// an evaluation against. Logged as a real, structural limitation, not
// silently skipped.
// Owner (2026-08-30, notes.md): "Validation can happen by both the badges
// define and validate, otherwise pack will never move out of draft.
// Similarly, reject can be done by validate badge also and validate can be
// done by reject badge also." The ONE definition of these alternates — both
// transitionPack's own transitionEngine.evaluate call below (the actual
// authority, for every caller: web /publish, web /transition, and every
// api/packs.ts transition/* route) and the badge-gate resolvers upstream of
// it (core/sdkAuthoring.ts's requiredBadgeForRowAction, api/packs.ts's own
// route registrations) read from this same table, so the door and the
// actual enforcement can never name a different acceptable set.
export function alternateBadgesForPackTransition(fromState: string, toState: string): string[] | undefined {
  const ALTERNATE_BADGES: Record<string, string[]> = {
    "Draft->Validated": ["pack_define", "pack_reject"],
    "Validated->Draft": ["pack_validate"],
  };
  return ALTERNATE_BADGES[`${fromState}->${toState}`];
}

export async function transitionPack(input: { packId: string; targetState: string; actorRole: string; actorId?: string; comment?: string }): Promise<TransitionPackResult> {
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
    // Version Feature Plan.md — was missing entirely. Without it, the
    // generic submit_verb gate (transitionEngine.evaluate's own
    // hasBeenSubmitted check) always reads as "not submitted" — dormant
    // while no Pack transition declared a submit_verb, but Draft->Validated
    // now does (migration 184), so this is load-bearing from here on.
    entityId: pack.id,
    alternateBadges: alternateBadgesForPackTransition(fromState, input.targetState),
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Pack ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  // CR-080 — Reject (Validated -> Draft) requires its own, new feedback on
  // every use. Checked after authorisation (so an under-badged actor sees
  // "authority_denied", not a comment-validation error) and before writing
  // anything — mirrors transitionObjective's identical CR-073 check exactly.
  const trimmedComment = input.comment?.trim() ?? "";
  if (fromState === "Validated" && input.targetState === "Draft") {
    if (!trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Rejecting requires feedback — provide a comment explaining what needs to change." };
    }
    const { data: existingComments } = await packsDB.getComments(pack.id);
    const mostRecent = existingComments?.[existingComments.length - 1];
    if (mostRecent && mostRecent.comment_text.trim() === trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Provide new feedback — this matches the most recent comment already on record." };
    }
  }

  const { data: updated, error } = await packsDB.updateStatus(pack.id, input.targetState as PackRow["status"]);
  if (error || !updated) throw error ?? new Error("failed to update pack status");

  if (trimmedComment) {
    await packsDB.addComment(pack.id, input.actorId != null ? Number(input.actorId) : null, trimmedComment);
  }

  // Version Feature Plan.md §3 — eventType now comes straight off the
  // resolved Transition Definition (gate.eventType, migration 184), not the
  // old hardcoded EVENT_BY_TARGET_STATE map.
  await eventBus.publish({
    eventType: gate.eventType ?? "PackTransitioned",
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

// CR-081 — real numeric semver comparison, not string comparison ("10.0.0" <
// "2.0.0" lexicographically, which is wrong). Returns >0 if a > b, <0 if
// a < b, 0 if equal.
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// CR-081 — Pack version is a single SEQUENCE per (code, tenant), not a
// semver tree (owner: "version is to be treated like a 'sequence'. If it['s]
// taken, assign the next"). "New Pack" form's branch picker, driven by this:
// for every code this tenant already has a Pack row under, the Published-
// through-Archived versions to offer as a content starting point (Draft/
// Validated excluded — owner: "Those are still 'draft'... they should be
// clickable and you should be able to continue edits", not a thing to branch
// a NEW version off of), plus the version the next Draft will actually get —
// always the highest version across EVERY status for that code (including
// Draft/Validated, so an in-progress, not-yet-visible Draft's number is
// still never collided with), patch-bumped via the existing
// nextAvailablePatchVersion (already does "if taken, try the next patch").
// This is what makes the version genuinely a sequence: which existing
// version an author picks to copy CONTENT from never changes which number
// the new Draft gets.
export interface PackCodeVersionSummary {
  versions: Array<{ id: string; version: string; status: PackRow["status"] }>;
  nextVersion: string;
}
const BRANCHABLE_STATUSES = new Set<PackRow["status"]>(["Published", "Active", "Retired", "Archived"]);

// Bug fix (owner: "why does it take it so long to load the record?") —
// nextAvailablePatchVersion's own DB round trip is right for a real
// creation/branch (must check the LIVE table, since another actor could
// have taken a version in the meantime), but calling it once per distinct
// code here made this whole summary O(n) SEQUENTIAL, AWAITED queries — one
// per code the tenant has ever used, every single time the New Pack page
// loads. Measured directly against a real dev DB: 77 codes, 2.76s, ~36ms/
// code — almost the entire page's load time. findAllForTenant, one line
// above, already fetched every row nextAvailablePatchVersion's own query
// could ever match (identical tenant scoping — see findByCodeAndVersion),
// so the same "is this candidate already taken" check can be answered
// entirely from the rows already in hand, with zero further queries. This
// summary is inherently a point-in-time snapshot regardless (a genuinely
// new collision from another actor between page load and actual submit is
// already caught for real at creation time, same as before) — so trading
// the live re-check for the free in-memory one changes nothing about
// correctness, only about not paying for 77 round trips to render a list.
function nextAvailablePatchVersionInMemory(fromVersion: string, takenVersions: ReadonlySet<string>): string {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    if (!takenVersions.has(candidate)) return candidate;
  }
  throw new Error(`could not find an unused version after bumping from ${fromVersion}`);
}

function groupByCode(rows: PackRow[]): Map<string, PackRow[]> {
  const byCode = new Map<string, PackRow[]>();
  for (const pack of rows) {
    const list = byCode.get(pack.code) ?? [];
    list.push(pack);
    byCode.set(pack.code, list);
  }
  return byCode;
}

export async function packCodeVersionSummaries(tenantId: string): Promise<Record<string, PackCodeVersionSummary>> {
  const { data: ownPacks } = await packsDB.findAllForTenant(tenantId);
  const byCode = groupByCode(ownPacks ?? []);

  // Bug fix (owner: logged in as a real tenant author — pack-define@athens.com,
  // a tenant with zero Packs of its own — picked an existing Domain code and
  // saw an empty branch-picker, even though Platform has real published
  // versions under it). Confirmed live: findAllForTenant's own "no
  // Platform-or-own merge" scoping was working exactly as CR-081 originally
  // specified — but that spec, tested for real against a genuine tenant
  // identity for the first time, turned out to be the wrong default. Owner:
  // "Include Platform as a fallback" — when this tenant has NOTHING of its
  // own under a code, offer Platform's own branchable versions as a content
  // source instead, the same way Template/Profile Inheritance already lets a
  // tenant start from a Platform baseline. `nextVersion` is deliberately
  // NOT part of this fallback — it stays this tenant's own sequence
  // (starts fresh at "1.0.0" when they have nothing of their own) regardless
  // of which version they copy content from; CR-081's own "which version you
  // branch FROM never changes which number the new Draft gets" rule is
  // unaffected by widening WHERE that content can come from.
  const platformByCode = tenantId === PLATFORM_TENANT_ID ? null : groupByCode((await packsDB.findAllForTenant(PLATFORM_TENANT_ID)).data ?? []);

  const result: Record<string, PackCodeVersionSummary> = {};
  const allCodes = new Set([...byCode.keys(), ...(platformByCode?.keys() ?? [])]);
  for (const code of allCodes) {
    const ownRows = byCode.get(code) ?? [];
    if (ownRows.length > 0) {
      const highest = ownRows.reduce((max, r) => (compareSemver(r.pack_version, max) > 0 ? r.pack_version : max), ownRows[0]!.pack_version);
      const nextVersion = nextAvailablePatchVersionInMemory(highest, new Set(ownRows.map((r) => r.pack_version)));
      const versions = ownRows
        .filter((r) => BRANCHABLE_STATUSES.has(r.status))
        .map((r) => ({ id: r.id, version: r.pack_version, status: r.status }))
        .sort((a, b) => compareSemver(b.version, a.version));
      result[code] = { versions, nextVersion };
      continue;
    }
    const platformRows = platformByCode?.get(code) ?? [];
    if (platformRows.length === 0) continue;
    const versions = platformRows
      .filter((r) => BRANCHABLE_STATUSES.has(r.status))
      .map((r) => ({ id: r.id, version: r.pack_version, status: r.status }))
      .sort((a, b) => compareSemver(b.version, a.version));
    result[code] = { versions, nextVersion: "1.0.0" };
  }
  return result;
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
