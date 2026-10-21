import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { CapabilityDefinitionRow, CapabilityRole } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
import { nextAvailablePatchVersion, semverError } from "../../../utils/version.js";
 

export interface CapabilityDefinitionSeedInput {
  code: string;
  defaultLabel: string;
  description?: string | null;
  category: string;
  roles?: CapabilityRole[];
  version: string;
  tenantId?: string;
  parentCapabilityDefinitionId?: string | null;
}

export type CapabilityDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };


async function validateRoles(roles: CapabilityRole[] | undefined): Promise<string[]> {
  const errors: string[] = [];
  for (const [i, role] of (roles ?? []).entries()) {
    const label = `role ${i + 1}`;
    if (!role?.name?.trim()) {
      errors.push(`${label}: name is required`);
      continue;
    }
    try {
      await assertCanonicalCategory("role-name", role.name);
    } catch (err) {
      errors.push(`${label}: ${(err as Error).message}`);
    }
    for (const worktype of role.worktypes ?? []) {
      try {
        await assertCanonicalCategory("worktype-name", worktype);
      } catch (err) {
        errors.push(`${label}: ${(err as Error).message}`);
      }
    }
  }
  return errors;
}

export async function validateCapabilityDefinitionSeed(seed: CapabilityDefinitionSeedInput, excludeId?: string): Promise<CapabilityDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.defaultLabel?.trim()) errors.push("defaultLabel is required");
  const versionError = semverError("version", seed.version);
  if (versionError) errors.push(versionError);

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());
  if (!seed.category?.trim()) errors.push("category is required");
  errors.push(...(await validateRoles(seed.roles)));

  if (seed.parentCapabilityDefinitionId) {
    const { data: parent } = await capabilityDefinitionsDB.findById(seed.parentCapabilityDefinitionId);
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    if (!parent) {
      errors.push(`parentCapabilityDefinitionId "${seed.parentCapabilityDefinitionId}" not found`);
    } else if (parent.status !== "Active") {
      errors.push(`a Capability Definition can only be inherited from an Active Version`);
    } else if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== tenantId) {
      errors.push(`parent Capability Definition is not visible to this tenant`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export async function listInheritableCapabilityDefinitions(): Promise<Array<{ id: string; code: string; defaultLabel: string; version: string }>> {
  const { data: rows } = await capabilityDefinitionsDB.findActivePlatformOwned();
  return (rows ?? []).map((r) => ({ id: r.id, code: r.code, defaultLabel: r.default_label, version: r.version })).sort((a, b) => a.code.localeCompare(b.code));
}

export async function inheritedCapabilityDefinitionContent(parentCapabilityDefinitionId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await capabilityDefinitionsDB.findById(parentCapabilityDefinitionId);
  if (!parent) return { ok: false, error: "parent Capability Definition not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Capability Definition can only be inherited from an Active Version" };
  return {
    ok: true,
    content: { code: parent.code, defaultLabel: parent.default_label, description: parent.description ?? "", category: parent.category, roles: parent.roles },
  };
}

export async function copyCapabilityDefinitionAsNewDraft(capabilityDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await capabilityDefinitionsDB.findById(capabilityDefinitionId);
  if (!source) return { ok: false, errors: ["Capability Definition not found"] };
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Capability");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Capability`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "Capability", actorId });
  const { data: newDraft, error } = await capabilityDefinitionsDB.createDraft({
    code: source.code,
    defaultLabel: source.default_label,
    description: source.description,
    category: source.category,
    roles: source.roles,
    version: await nextAvailablePatchVersion(source.version, async (candidate) => !!(await capabilityDefinitionsDB.findByCodeAndVersion(source.code, candidate, source.tenant_id)).data),
    status: birth.initialState as CapabilityDefinitionRow["status"],
    authoredBy: copyMaster.id,
    authorBadge: birth.authorityBadge,
    draftContent: { code: source.code, defaultLabel: source.default_label, description: source.description ?? "", category: source.category, roles: source.roles },
    tenantId: source.tenant_id,
    parentCapabilityDefinitionId: source.parent_capability_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Capability Definition")).message] };
  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Capability",
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

export interface CapabilityDefinitionWithNextStates {
  capabilityDefinition: CapabilityDefinitionRow;
  possibleNextStates: string[];
}

export async function listCapabilityDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<CapabilityDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await capabilityDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await capabilityDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (capabilityDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Capability", capabilityDefinition.status);
      return { capabilityDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
