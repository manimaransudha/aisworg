import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, listConceptsForType } from "./ontology.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
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

export interface ServiceDefinitionViewData {
  serviceDefinition: ServiceDefinitionRow;
  // The Capability this Service is offered by: its Active Definition when one is visible to the viewer.
  capability: { id: string | null; displayName: string };
  labels: { deliverables: Record<string, string>; capabilities: Record<string, string> };
  // Active Deliverable Definition id per input/output code visible to the viewer.
  deliverableIds: Record<string, string>;
}

async function labelsFor(conceptType: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, string>> {
  const concepts = await listConceptsForType(conceptType, viewer);
  return Object.fromEntries(concepts.map((c) => [c.code, c.default_label]));
}

// One Service Definition for the Registry view page, with the Ontology labels of its inputs, outputs and consumers.
// Returns null when the row does not exist or is not visible to the viewer's tenant.
export async function getServiceDefinitionView(id: string, viewer: { isRoot: boolean; tenantId: string | null }): Promise<ServiceDefinitionViewData | null> {
  const { data: row, error } = await serviceDefinitionsDB.findById(id);
  if (error) throw error;
  if (!row) return null;
  const platformTenantId = await getPlatformTenantId();
  if (!viewer.isRoot && row.tenant_id !== platformTenantId && row.tenant_id !== viewer.tenantId) return null;
  const [deliverables, capabilities] = await Promise.all([labelsFor("deliverable-name", viewer), labelsFor("capability-name", viewer)]);
  const { data: capabilityRow, error: capabilityError } = await capabilityDefinitionsDB.findActiveByCodeVisibleTo(row.capability_code, viewer.tenantId);
  if (capabilityError) throw capabilityError;
  const capability = capabilityRow
    ? { id: capabilityRow.id, displayName: capabilityRow.default_label }
    : { id: null, displayName: capabilities[row.capability_code] ?? row.capability_code };
  const deliverableIds: Record<string, string> = {};
  for (const code of new Set([...(row.inputs ?? []), ...(row.outputs ?? [])])) {
    const { data: deliverable, error: deliverableError } = await deliverableDefinitionsDB.findActiveByCodeVisibleTo(code, viewer.tenantId);
    if (deliverableError) throw deliverableError;
    if (deliverable) deliverableIds[code] = deliverable.id;
  }
  return { serviceDefinition: row, capability, labels: { deliverables, capabilities }, deliverableIds };
}
