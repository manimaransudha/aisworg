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
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { authorityRulesDB } from "../../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { qualityGatesDB } from "../../../dblayer/qualityGatesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { PackCategory, PackClassification, PackContributions, PackRow } from "../../../dblayer/seuTypes.js";

export interface PackSeedInput {
  code: string;
  name: string;
  category: PackCategory;
  packVersion: string;
  installationClassification: PackClassification;
  contributions: PackContributions;
  dependencies?: Array<{ packCode: string; version: string; type: "required" }>;
}

const PACK_CATEGORIES: PackCategory[] = ["Platform", "Organisation", "Domain", "Compliance", "Technology", "Integration"];
const PACK_CLASSIFICATIONS: PackClassification[] = ["Mandatory", "Recommended", "Optional", "Conditional"];
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export type PackValidationResult = { ok: true } | { ok: false; errors: string[] };

// Ch.39 §9/§7 Schema Validator + Dependency Validator, and FR-38.4/FR-38.5
// (dependencies resolved, conflicts detected before commissioning) applied
// at the one point they can actually be checked cheaply: publish time.
export async function validatePackSeed(seed: PackSeedInput): Promise<PackValidationResult> {
  const errors: string[] = [];

  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!PACK_CATEGORIES.includes(seed.category)) errors.push(`category must be one of ${PACK_CATEGORIES.join(", ")}, got: ${seed.category}`);
  if (!SEMVER_RE.test(seed.packVersion ?? "")) errors.push(`packVersion must be semver (x.y.z), got: "${seed.packVersion}"`);
  if (!PACK_CLASSIFICATIONS.includes(seed.installationClassification)) {
    errors.push(`installationClassification must be one of ${PACK_CLASSIFICATIONS.join(", ")}, got: ${seed.installationClassification}`);
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
    const { data: depPack } = await packsDB.findByCode(dep.packCode);
    if (!depPack) errors.push(`dependency not resolved: Pack "${dep.packCode}" not found in the Registry`);
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
// transitionEngine. createPackDraft/advancePackLifecycle let seedSeu.ts
// interleave those two steps correctly for the bootstrap Pack; every Pack
// published afterwards (including a second real Pack, or a second version
// of the first) has no such ordering problem and can just call the combined
// publishPack below.
export async function createPackDraft(seed: PackSeedInput): Promise<{ ok: true; pack: PackRow; alreadyExists: boolean } | { ok: false; errors: string[] }> {
  const validation = await validatePackSeed(seed);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { data: existing } = await packsDB.findByCodeAndVersion(seed.code, seed.packVersion);
  if (existing) {
    await seedContributions(existing, seed);
    return { ok: true, pack: existing, alreadyExists: true };
  }

  const { data: pack, error } = await packsDB.create(seed);
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
export async function advancePackLifecycle(pack: PackRow, actorRole: string, options?: { activate?: boolean }): Promise<PublishPackResult> {
  let currentPack = pack;

  if (currentPack.status === "Draft") {
    for (const targetState of ["Validated", "Published"]) {
      const result = await transitionPack({ packId: currentPack.id, targetState, actorRole });
      if (!result.ok) return { ok: false, pack: currentPack, errors: [`transition to "${targetState}" failed: ${"detail" in result ? result.detail : result.reason}`] };
      currentPack = result.pack;
    }
  }

  let supersededPack: PackRow | null = null;
  if (options?.activate && currentPack.status === "Published") {
    const { data: previousActive } = await packsDB.findActiveByCode(currentPack.code);
    const activateResult = await transitionPack({ packId: currentPack.id, targetState: "Active", actorRole });
    if (!activateResult.ok) return { ok: false, pack: currentPack, errors: [`transition to "Active" failed: ${"detail" in activateResult ? activateResult.detail : activateResult.reason}`] };
    currentPack = activateResult.pack;

    if (previousActive && previousActive.id !== currentPack.id) {
      const supersedeResult = await transitionPack({ packId: previousActive.id, targetState: "Deprecated", actorRole });
      if (supersedeResult.ok) supersededPack = supersedeResult.pack;
    }
  }

  return { ok: true, pack: currentPack, supersededPack };
}

// Ch.39's publish pipeline: validate -> create (Draft) -> seed contributions
// -> Validated -> Published -> optionally Active. Rerun-safe: publishing the
// exact same (code, packVersion) again is a no-op that returns the existing
// immutable row (VM-002) — the seed script and CLI can be re-run freely,
// same discipline as every migration in this codebase.
export async function publishPack(input: { seed: PackSeedInput; actorRole: string; activate?: boolean }): Promise<PublishPackResult> {
  const draft = await createPackDraft(input.seed);
  if (!draft.ok) return { ok: false, errors: draft.errors };

  const advanced = await advancePackLifecycle(draft.pack, input.actorRole, { activate: input.activate });
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
export async function transitionPack(input: { packId: string; targetState: string; actorRole: string }): Promise<TransitionPackResult> {
  const { data: pack } = await packsDB.findById(input.packId);
  if (!pack) return { ok: false, reason: "not_found" };

  const fromState = pack.status;
  const gate = await transitionEngine.evaluate({
    entityType: "Pack",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    context: { pack },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Pack ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires role ${gate.requiredRole}, actor has ${gate.actorRole}` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  // Reactivating from a terminal state: governance above already authorised
  // this specific (fromState -> Active) transition — what actually happens
  // is a new Version, not a status flip on this row (immutable per VM-002).
  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    const result = await reactivateAsNewVersion(pack, input.actorRole);
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
async function reactivateAsNewVersion(pack: PackRow, actorRole: string): Promise<PublishPackResult> {
  const nextVersion = await nextAvailablePatchVersion(pack.code, pack.pack_version);
  const seed: PackSeedInput = {
    code: pack.code,
    name: pack.name,
    category: pack.category,
    packVersion: nextVersion,
    installationClassification: pack.installation_classification,
    contributions: pack.contributions,
    dependencies: pack.dependencies,
  };
  return publishPack({ seed, actorRole, activate: true });
}

async function nextAvailablePatchVersion(code: string, fromVersion: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    const { data: existing } = await packsDB.findByCodeAndVersion(code, candidate);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for Pack ${code} after bumping from ${fromVersion}`);
}

export interface PackWithNextStates {
  pack: PackRow;
  possibleNextStates: string[];
}

// Registry listing (Ch.38 §10) — every Version of every Pack, newest first
// within each code, with its own governed next states.
export async function listPacksWithNextStates(): Promise<PackWithNextStates[]> {
  const { data: packs } = await packsDB.findAll();
  return Promise.all(
    (packs ?? []).map(async (pack) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Pack", pack.status);
      return { pack, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
