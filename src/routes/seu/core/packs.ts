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
import { complianceDB } from "../../../dblayer/complianceDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { PackCategory, PackClassification, PackContributions, PackRow } from "../../../dblayer/seuTypes.js";

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
  checkDuplicates("quality gate", seed.contributions.qualityGates);

  const capabilityCodes = new Set((seed.contributions.capabilities ?? []).map((c) => c.code));
  for (const svc of seed.contributions.services ?? []) {
    if (!capabilityCodes.has(svc.capabilityCode)) {
      errors.push(`service "${svc.code}" references unknown capability "${svc.capabilityCode}" — the capability must be declared in this same Pack's contributions`);
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
    await seedContributions(existing, seed);
    return { ok: true, pack: existing, alreadyExists: true };
  }

  const { data: pack, error } = await packsDB.create({ ...seed, metadata: packMetadataFromSeed(seed) });
  if (error || !pack) return { ok: false, errors: [(error ?? new Error("failed to create pack")).message] };

  await eventBus.publish({
    eventType: "PackRegistered",
    originatingObjectType: "Pack",
    originatingObjectId: pack.id,
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
      category: cap.category ?? null,
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

  for (const policy of seed.contributions.policies ?? []) {
    const { error } = await policiesDB.upsert({
      code: policy.code,
      name: policy.name,
      category: policy.category,
      constraintType: policy.constraintType,
      governedTransition: policy.governedTransition,
      condition: policy.condition,
      severity: policy.severity,
      originatingPackId: pack.id,
    });
    if (error) throw error;
  }

  for (const gate of seed.contributions.qualityGates ?? []) {
    const { error } = await qualityGatesDB.upsert({
      code: gate.code,
      name: gate.name,
      category: gate.category,
      entityType: gate.entityType,
      fromState: gate.fromState,
      toState: gate.toState,
      criteria: gate.criteria,
      originatingPackId: pack.id,
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
