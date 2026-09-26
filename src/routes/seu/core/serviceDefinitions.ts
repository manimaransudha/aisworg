import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { assertCanonicalCategory, syncConceptFromEntity, retireConceptForEntity } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { ServiceDefinitionRow, ServiceLevelExpectation } from "../../../dblayer/seuTypes.js";

// CR-086 follow-on — Service Definition authoring (Book 3 Ch.11), mirroring
// core/deliverableDefinitions.ts in shape. Two differences from that
// entity's own treatment:
//   1. Ch.11 §13's own lifecycle is used verbatim — Defined -> Published ->
//      Active -> Deprecated -> Retired -> Archived, strictly linear (the
//      chapter's own diagram has no reactivation/back-edges, so — unlike
//      Deliverable Definition — reaching Active from a terminal state as a
//      new Version isn't built here).
//   2. `code` syncs the separate `service-name` concept type (not
//      `capability-name` the way Deliverable Definition syncs
//      `deliverable-name`) — owner: "I do not want to reuse the
//      capability-name... makes future mutations easy if required."

export interface ServiceDefinitionSeedInput {
  code: string;
  name: string;
  capabilityCode: string;
  purpose?: string | null;
  // Bug fix — migration 159 made these TEXT[] (a referential-multi-select of
  // deliverable-name Ontology codes, mirroring `consumers` against
  // capability-name), but this field stayed typed/parsed as a bare string
  // ever since — never actually populatable through the real form, and a
  // NOT NULL violation for any caller (including this file's own
  // copyServiceDefinitionAsNewDraft) that omitted it entirely.
  inputs?: string[];
  outputs?: string[];
  serviceLevel?: ServiceLevelExpectation[];
  governance?: string | null;
  success?: string | null;
  consumers?: string[];
  version: string;
  tenantId?: string;
  parentServiceDefinitionId?: string | null;
}

export type ServiceDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function assertServiceDefinitionCodeVersionFree(code: string, version: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await serviceDefinitionsDB.findByCodeAndVersion(code, version, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Service Definition with code "${code}" already exists at version ${version}. Pick a different starting version, or continue authoring that existing Definition instead of starting a new one.`;
  }
  return null;
}

export async function validateServiceDefinitionSeed(seed: ServiceDefinitionSeedInput, excludeId?: string): Promise<ServiceDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.capabilityCode?.trim()) errors.push("capabilityCode is required");
  if (!SEMVER_RE.test(seed.version ?? "")) errors.push(`version must be semver (x.y.z), got: "${seed.version}"`);

  const tenantId = seed.tenantId ?? PLATFORM_TENANT_ID;
  if (seed.code?.trim() && SEMVER_RE.test(seed.version ?? "")) {
    const collision = await assertServiceDefinitionCodeVersionFree(seed.code, seed.version, tenantId, excludeId);
    if (collision) errors.push(collision);
  }
  if (seed.code?.trim()) {
    try {
      await assertCanonicalCategory("service-name", seed.code.trim());
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  if (seed.capabilityCode?.trim()) {
    try {
      await assertCanonicalCategory("capability-name", seed.capabilityCode.trim());
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  for (const consumer of seed.consumers ?? []) {
    try {
      await assertCanonicalCategory("capability-name", consumer);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  // Bug fix — migration 159 made inputs/outputs a referential-multi-select
  // against deliverable-name (the same treatment consumers already gets
  // against capability-name, just above), but no validation was ever added
  // to match; this is the missing half of that migration.
  for (const input of seed.inputs ?? []) {
    try {
      await assertCanonicalCategory("deliverable-name", input);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  for (const output of seed.outputs ?? []) {
    try {
      await assertCanonicalCategory("deliverable-name", output);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  if (seed.parentServiceDefinitionId) {
    const { data: parent } = await serviceDefinitionsDB.findById(seed.parentServiceDefinitionId);
    if (!parent) {
      errors.push(`parentServiceDefinitionId "${seed.parentServiceDefinitionId}" not found`);
    } else if (parent.status !== "Active") {
      errors.push(`a Service Definition can only be inherited from an Active Version`);
    } else if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== tenantId) {
      errors.push(`parent Service Definition is not visible to this tenant`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export async function listInheritableServiceDefinitions(): Promise<Array<{ id: string; code: string; name: string; capabilityCode: string; version: string }>> {
  const { data: rows } = await serviceDefinitionsDB.findActivePlatformOwned();
  return (rows ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name, capabilityCode: r.capability_code, version: r.version })).sort((a, b) => a.code.localeCompare(b.code));
}

export async function inheritedServiceDefinitionContent(parentServiceDefinitionId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await serviceDefinitionsDB.findById(parentServiceDefinitionId);
  if (!parent) return { ok: false, error: "parent Service Definition not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Service Definition can only be inherited from an Active Version" };
  return {
    ok: true,
    content: {
      code: parent.code, name: parent.name, capabilityCode: parent.capability_code, purpose: parent.purpose ?? "", inputs: parent.inputs,
      outputs: parent.outputs, serviceLevel: parent.service_level, governance: parent.governance ?? "", success: parent.success ?? "", consumers: parent.consumers,
    },
  };
}

export type TransitionServiceDefinitionResult = { ok: true; serviceDefinition: ServiceDefinitionRow } | { ok: false; reason: string; detail?: string };

// Syncs the `service-name` Ontology concept — only at the moment of
// genuinely becoming (or ceasing to be) Active, mirroring
// syncOntologyOnActivate/demoteOntologyIfNoOtherActive in
// core/deliverableDefinitions.ts exactly, one concept type over.
async function syncOntologyOnActivate(row: ServiceDefinitionRow): Promise<void> {
  await syncConceptFromEntity("service-name", row.code, row.name, row.purpose ?? null, row.tenant_id);
}

async function demoteOntologyIfNoOtherActive(row: ServiceDefinitionRow): Promise<void> {
  const { data: stillActive } = await serviceDefinitionsDB.findActiveByCode(row.code, row.tenant_id);
  if (!stillActive) await retireConceptForEntity("service-name", row.code, row.tenant_id);
}

// Version Feature Plan.md §3/§4 (Ch.11, migration 188) — event_type is now
// read straight off the resolved Transition Definition (transitionEngine's
// TransitionOutcome), replacing the hardcoded EVENT_BY_TARGET_STATE map this
// used to carry — mirrors how Template's/Profile's identical maps were
// replaced, migrations 185/187.
export async function transitionServiceDefinition(input: { serviceDefinitionId: string; targetState: ServiceDefinitionRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionServiceDefinitionResult> {
  const { data: serviceDefinition } = await serviceDefinitionsDB.findById(input.serviceDefinitionId);
  if (!serviceDefinition) return { ok: false, reason: "not_found" };
  const fromState = serviceDefinition.status;
  // entityId passed so a Service Definition row ever declaring submit_verb
  // (none do today) would have its triggerEngine.hasBeenSubmitted check
  // actually work — the same latent gap Template's/Profile's own
  // transitionTemplate/transitionProfile had before their fix.
  const gate = await transitionEngine.evaluate({ entityType: "Service", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, entityId: serviceDefinition.id, context: { serviceDefinition } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Service ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  const { data: updated, error } = await serviceDefinitionsDB.updateStatus(serviceDefinition.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Service Definition status");

  if (input.targetState === "Active") await syncOntologyOnActivate(updated);
  else if (fromState === "Active") await demoteOntologyIfNoOtherActive(updated);

  await eventBus.publish({
    eventType: gate.eventType ?? "ServiceDefinitionTransitioned",
    originatingObjectType: "ServiceDefinition",
    originatingObjectId: updated.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, serviceDefinition: updated };
}

// Mirrors advanceDeliverableDefinitionOneStep — runs exactly the NEXT
// governed hop off the entity's current status. No Active-reached
// supersession branch here (unlike Deliverable Definition): Ch.11's own
// lifecycle never returns to Active from a terminal state.
const AUTHORING_NEXT_STATE: Partial<Record<ServiceDefinitionRow["status"], ServiceDefinitionRow["status"]>> = {
  Defined: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceServiceDefinitionOneStep(serviceDefinition: ServiceDefinitionRow, actorRole: string, actorId: string | undefined): Promise<TransitionServiceDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[serviceDefinition.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Service Definition is already ${serviceDefinition.status} — no further authoring step` };
  return transitionServiceDefinition({ serviceDefinitionId: serviceDefinition.id, targetState, actorRole, actorId });
}

// Registry "Copy" action, mirrors copyDeliverableDefinitionAsNewDraft.
export async function copyServiceDefinitionAsNewDraft(serviceDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await serviceDefinitionsDB.findById(serviceDefinitionId);
  if (!source) return { ok: false, errors: ["Service Definition not found"] };
  // CR-114 follow-on — same carry-forward-the-source's-own-pin reasoning as
  // templates.ts's copyTemplateAsNewDraft.
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Service");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Service`] };
  const { data: newDraft, error } = await serviceDefinitionsDB.createDraft({
    code: source.code,
    name: source.name,
    capabilityCode: source.capability_code,
    purpose: source.purpose,
    inputs: source.inputs,
    outputs: source.outputs,
    serviceLevel: source.service_level,
    governance: source.governance,
    success: source.success,
    consumers: source.consumers,
    version: source.version,
    authoredBy: Number(actorId),
    draftContent: {
      code: source.code, name: source.name, capabilityCode: source.capability_code, purpose: source.purpose ?? "", inputs: source.inputs,
      outputs: source.outputs, serviceLevel: source.service_level, governance: source.governance ?? "", success: source.success ?? "", consumers: source.consumers,
    },
    tenantId: source.tenant_id,
    parentServiceDefinitionId: source.parent_service_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Service Definition")).message] };
  return { ok: true, draftId: newDraft.id };
}

export interface ServiceDefinitionWithNextStates {
  serviceDefinition: ServiceDefinitionRow;
  possibleNextStates: string[];
}

// Service Definition Registry — every Version of every Definition, with its
// own governed next states, mirroring listDeliverableDefinitionsWithNextStates.
export async function listServiceDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<ServiceDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await serviceDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await serviceDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (serviceDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Service", serviceDefinition.status);
      return { serviceDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
