import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { ServiceDefinitionRow, ServiceLevelExpectation } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
import { nextAvailablePatchVersion, semverError } from "../../../utils/version.js";
 

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


export async function validateServiceDefinitionSeed(seed: ServiceDefinitionSeedInput, excludeId?: string): Promise<ServiceDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.capabilityCode?.trim()) errors.push("capabilityCode is required");
  const versionError = semverError("version", seed.version);
  if (versionError) errors.push(versionError);

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());
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

export async function copyServiceDefinitionAsNewDraft(serviceDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await serviceDefinitionsDB.findById(serviceDefinitionId);
  if (!source) return { ok: false, errors: ["Service Definition not found"] };
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Service");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Service`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Service", actorId });
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
    version: await nextAvailablePatchVersion(source.version, async (candidate) => !!(await serviceDefinitionsDB.findByCodeAndVersion(source.code, candidate, source.tenant_id)).data),
    status: birth.initialState as ServiceDefinitionRow["status"],
    authoredBy: copyMaster.id,
    authorBadge: birth.authorityBadge,
    draftContent: {
      code: source.code, name: source.name, capabilityCode: source.capability_code, purpose: source.purpose ?? "", inputs: source.inputs,
      outputs: source.outputs, serviceLevel: source.service_level, governance: source.governance ?? "", success: source.success ?? "", consumers: source.consumers,
    },
    tenantId: source.tenant_id,
    parentServiceDefinitionId: source.parent_service_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Service Definition")).message] };
  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Service",
    originatingObjectId: newDraft.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    actorId: copyMaster.id,
    authorityBadge: birth.authorityBadge,
    versionEvent: birth.versionEvent,
    payload: { code: newDraft.code, version: newDraft.version },
    tenantId: newDraft.tenant_id,
  });
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
