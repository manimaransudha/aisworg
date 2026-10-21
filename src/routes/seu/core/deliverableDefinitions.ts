import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { transitionEntity } from "../../../domain/engine/entityTransition.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import type { DeliverableDefinitionRow } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
import { nextAvailablePatchVersion as nextAvailableVersion, semverError } from "../../../utils/version.js";

export interface DeliverableDefinitionSeedInput {
  code: string;
  description?: string;
  definitionVersion: string;
  tenantId?: string;
  parentDeliverableDefinitionId?: string | null;
}

export type DeliverableDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };


export async function validateDeliverableDefinitionSeed(seed: DeliverableDefinitionSeedInput, excludeId?: string): Promise<DeliverableDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  const definitionVersionError = semverError("definitionVersion", seed.definitionVersion);
  if (definitionVersionError) errors.push(definitionVersionError);

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());

  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  if (seed.parentDeliverableDefinitionId) {
    const { data: parent } = await deliverableDefinitionsDB.findById(seed.parentDeliverableDefinitionId);
    if (!parent) {
      errors.push(`parentDeliverableDefinitionId "${seed.parentDeliverableDefinitionId}" not found`);
    } else if (parent.status !== "Active") {
      errors.push(`a Deliverable Definition can only be inherited from an Active Version`);
    } else if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== tenantId) {
      errors.push(`parent Deliverable Definition is not visible to this tenant`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export async function listInheritableDeliverableDefinitions(): Promise<Array<{ id: string; code: string; description: string | null; definitionVersion: string }>> {
  const { data: rows } = await deliverableDefinitionsDB.findActivePlatformOwned();
  return (rows ?? []).map((r) => ({ id: r.id, code: r.code, description: r.description, definitionVersion: r.version })).sort((a, b) => a.code.localeCompare(b.code));
}

export async function inheritedDeliverableDefinitionContent(parentDeliverableDefinitionId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await deliverableDefinitionsDB.findById(parentDeliverableDefinitionId);
  if (!parent) return { ok: false, error: "parent Deliverable Definition not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Deliverable Definition can only be inherited from an Active Version" };
  return { ok: true, content: { code: parent.code, description: parent.description ?? "" } };
}

// Moves a Published Deliverable Definition to Active and deprecates the Active version it replaces, both through the generic transition.
export async function activateDeliverableDefinitionSupersedingPrevious(definition: DeliverableDefinitionRow, actorId: string): Promise<{ ok: true; deliverableDefinition: DeliverableDefinitionRow } | { ok: false; errors: string[] }> {
  const { data: previousActive } = await deliverableDefinitionsDB.findActiveByCode(definition.code, definition.tenant_id);
  const activated = await transitionEntity({ entityType: "DeliverableDefinition", entityId: definition.id, targetState: "Active", actorId });
  if (!activated.ok) return { ok: false, errors: [`transition to "Active" failed: ${"detail" in activated ? activated.detail : activated.reason}`] };
  if (previousActive && previousActive.id !== definition.id) {
    await transitionEntity({ entityType: "DeliverableDefinition", entityId: previousActive.id, targetState: "Deprecated", actorId });
  }
  return { ok: true, deliverableDefinition: activated.row as DeliverableDefinitionRow };
}

async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  return nextAvailableVersion(fromVersion, async (candidate) => !!(await deliverableDefinitionsDB.findByCodeAndVersion(code, candidate, tenantId)).data);
}

export async function copyDeliverableDefinitionAsNewDraft(deliverableDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await deliverableDefinitionsDB.findById(deliverableDefinitionId);
  if (!source) return { ok: false, errors: ["Deliverable Definition not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.version, source.tenant_id);
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Deliverable");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Deliverable`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "DeliverableDefinition", actorId });
  const { data: newDraft, error } = await deliverableDefinitionsDB.createDraft({
    code: source.code,
    description: source.description,
    version: nextVersion,
    status: birth.initialState as DeliverableDefinitionRow["status"],
    authoredBy: copyMaster.id,
    authorBadge: birth.authorityBadge,
    draftContent: { code: source.code, description: source.description, definitionVersion: nextVersion },
    tenantId: source.tenant_id,
    parentDeliverableDefinitionId: source.parent_deliverable_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Deliverable Definition")).message] };
  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "DeliverableDefinition",
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

export interface DeliverableDefinitionWithNextStates {
  deliverableDefinition: DeliverableDefinitionRow;
  possibleNextStates: string[];
}

export async function listDeliverableDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<DeliverableDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await deliverableDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await deliverableDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (deliverableDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("DeliverableDefinition", deliverableDefinition.status);
      return { deliverableDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
