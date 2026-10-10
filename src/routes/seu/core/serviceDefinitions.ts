import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, syncConceptFromEntity, retireConceptForEntity } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { ServiceDefinitionRow, ServiceLevelExpectation } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
 

export interface ServiceDefinitionSeedInput {
  code: string;
  name: string;
  capabilityCode: string;
  purpose?: string | null;
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

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());
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
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
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

async function syncOntologyOnActivate(row: ServiceDefinitionRow, actorId: string): Promise<void> {
  await syncConceptFromEntity("service-name", row.code, row.name, row.purpose ?? null, row.tenant_id, actorId);
}

async function demoteOntologyIfNoOtherActive(row: ServiceDefinitionRow, actorId: string, actorBadge: string): Promise<void> {
  const { data: stillActive } = await serviceDefinitionsDB.findActiveByCode(row.code, row.tenant_id);
  if (!stillActive) await retireConceptForEntity("service-name", row.code, row.tenant_id, actorId, actorBadge);
}

export async function transitionServiceDefinition(input: { serviceDefinitionId: string; targetState: ServiceDefinitionRow["status"]; actorRole: string; actorId: string }): Promise<TransitionServiceDefinitionResult> {
  const { data: serviceDefinition } = await serviceDefinitionsDB.findById(input.serviceDefinitionId);
  if (!serviceDefinition) return { ok: false, reason: "not_found" };
  const fromState = serviceDefinition.status;
  const gate = await transitionEngine.evaluate({ entityType: "Service", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, entityId: serviceDefinition.id, context: { serviceDefinition } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Service ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  const { data: updated, error } = await serviceDefinitionsDB.updateStatus(serviceDefinition.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Service Definition status");

  if (input.targetState === "Active" || fromState === "Active") {
    if (!input.actorId) throw new Error("a real actorId is required to sync the service-name Ontology concept");
    if (input.targetState === "Active") await syncOntologyOnActivate(updated, input.actorId);
    else {
      if (!gate.authorityBadge) throw new Error("no resolved authority badge for this transition — cannot record the service-name Ontology concept's retirement");
      await demoteOntologyIfNoOtherActive(updated, input.actorId, gate.authorityBadge);
    }
  }

  await eventBus.publish({
    eventType: gate.eventType ?? "ServiceDefinitionTransitioned",
    originatingObjectType: "ServiceDefinition",
    originatingObjectId: updated.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge ?? "root",
    versionEvent: gate.versionEvent,
    fromState,
    toState: input.targetState,
    tenantId: updated.tenant_id,
  });
  return { ok: true, serviceDefinition: updated };
}

const AUTHORING_NEXT_STATE: Partial<Record<ServiceDefinitionRow["status"], ServiceDefinitionRow["status"]>> = {
  Defined: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceServiceDefinitionOneStep(serviceDefinition: ServiceDefinitionRow, actorRole: string, actorId: string): Promise<TransitionServiceDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[serviceDefinition.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Service Definition is already ${serviceDefinition.status} — no further authoring step` };
  return transitionServiceDefinition({ serviceDefinitionId: serviceDefinition.id, targetState, actorRole, actorId });
}

export async function copyServiceDefinitionAsNewDraft(serviceDefinitionId: string, actorId: string, authorBadge: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await serviceDefinitionsDB.findById(serviceDefinitionId);
  if (!source) return { ok: false, errors: ["Service Definition not found"] };
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Service");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Service`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
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
    authoredBy: copyMaster.id,
    authorBadge,
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

export async function listServiceDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<ServiceDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await serviceDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await serviceDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (serviceDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Service", serviceDefinition.status);
      return { serviceDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
