import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { syncConceptFromEntity, retireConceptForEntity } from "./ontology.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import type { DeliverableDefinitionRow } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";

export interface DeliverableDefinitionSeedInput {
  code: string;
  description?: string;
  definitionVersion: string;
  tenantId?: string;
  parentDeliverableDefinitionId?: string | null;
}

export type DeliverableDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function assertDeliverableDefinitionCodeVersionFree(code: string, version: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await deliverableDefinitionsDB.findByCodeAndVersion(code, version, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Deliverable Definition with code "${code}" already exists at version ${version}. Pick a different starting version, or continue authoring that existing Definition instead of starting a new one.`;
  }
  return null;
}

export async function validateDeliverableDefinitionSeed(seed: DeliverableDefinitionSeedInput, excludeId?: string): Promise<DeliverableDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!SEMVER_RE.test(seed.definitionVersion ?? "")) errors.push(`definitionVersion must be semver (x.y.z), got: "${seed.definitionVersion}"`);

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());
  if (seed.code?.trim() && SEMVER_RE.test(seed.definitionVersion ?? "")) {
    const collision = await assertDeliverableDefinitionCodeVersionFree(seed.code, seed.definitionVersion, tenantId, excludeId);
    if (collision) errors.push(collision);
  }

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

export type TransitionDeliverableDefinitionResult = { ok: true; deliverableDefinition: DeliverableDefinitionRow } | { ok: false; reason: string; detail?: string };

const TERMINAL_REACTIVATABLE_STATES = new Set(["Deprecated", "Retired", "Archived"]);

const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "DeliverableDefinitionValidated",
  Published: "DeliverableDefinitionPublished",
  Active: "DeliverableDefinitionActivated",
  Deprecated: "DeliverableDefinitionDeprecated",
  Retired: "DeliverableDefinitionRetired",
  Archived: "DeliverableDefinitionArchived",
};

async function syncOntologyOnActivate(row: DeliverableDefinitionRow, actorId: string): Promise<void> {
  await syncConceptFromEntity("deliverable-name", row.code, row.code, row.description ?? null, row.tenant_id, actorId);
}

async function demoteOntologyIfNoOtherActive(row: DeliverableDefinitionRow, actorId: string, actorBadge: string): Promise<void> {
  const { data: stillActive } = await deliverableDefinitionsDB.findActiveByCode(row.code, row.tenant_id);
  if (!stillActive) await retireConceptForEntity("deliverable-name", row.code, row.tenant_id, actorId, actorBadge);
}

export async function transitionDeliverableDefinition(input: { deliverableDefinitionId: string; targetState: DeliverableDefinitionRow["status"]; actorRole: string; actorId: string }): Promise<TransitionDeliverableDefinitionResult> {
  const { data: concept } = await deliverableDefinitionsDB.findById(input.deliverableDefinitionId);
  if (!concept) return { ok: false, reason: "not_found" };
  const fromState = concept.status;
  const gate = await transitionEngine.evaluate({ entityType: "Deliverable", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, context: { deliverableDefinition: concept } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }
  if (!gate.authorityBadge) {
    return { ok: false, reason: "not_authorised" };
  }
  if (input.targetState === "Active" && TERMINAL_REACTIVATABLE_STATES.has(fromState)) {
    return reactivateAsNewVersion(concept, input.actorRole, input.actorId, gate.authorityBadge);
  }

  const { data: updated, error } = await deliverableDefinitionsDB.updateStatus(concept.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Deliverable Definition status");

  if (input.targetState === "Active" || fromState === "Active") {
    if (!input.actorId) throw new Error("a real actorId is required to sync the deliverable-name Ontology concept");
    if (input.targetState === "Active") await syncOntologyOnActivate(updated, input.actorId);
    else {
      if (!gate.authorityBadge) throw new Error("no resolved authority badge for this transition — cannot record the deliverable-name Ontology concept's retirement");
      await demoteOntologyIfNoOtherActive(updated, input.actorId, gate.authorityBadge);
    }
  }

  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "DeliverableDefinitionTransitioned",
    originatingObjectType: "DeliverableDefinition",
    originatingObjectId: updated.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, deliverableDefinition: updated };
}

async function nextAvailablePatchVersion(code: string, fromVersion: string, tenantId: string): Promise<string> {
  const [major, minor, startingPatch] = fromVersion.split(".").map(Number);
  let patch = startingPatch ?? 0;
  for (let attempts = 0; attempts < 1000; attempts++) {
    patch += 1;
    const candidate = `${major}.${minor}.${patch}`;
    const { data: existing } = await deliverableDefinitionsDB.findByCodeAndVersion(code, candidate, tenantId);
    if (!existing) return candidate;
  }
  throw new Error(`could not find an unused version for Deliverable Definition ${code} after bumping from ${fromVersion}`);
}

async function reactivateAsNewVersion(concept: DeliverableDefinitionRow, actorRole: string, actorId: string, authorBadge: string): Promise<TransitionDeliverableDefinitionResult> {
  const nextVersion = await nextAvailablePatchVersion(concept.code, concept.version, concept.tenant_id);
  const { data: reactivationSchema } = concept.schema_definition_id ? { data: { id: concept.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Deliverable");
  if (!reactivationSchema) return { ok: false, reason: "policy_blocked", detail: `no schema_definitions grammar for Deliverable` };
  if (!actorId) return { ok: false, reason: "policy_blocked", detail: "reactivation requires a real actorId to author the new Version's Draft" };
  if (!authorBadge) return { ok: false, reason: "policy_blocked", detail: "no authority badge resolved for this Deliverable Definition reactivation" };
  const { data: reactivateMaster } = await participantsMasterDB.findById(actorId);
  if (!reactivateMaster) return { ok: false, reason: "policy_blocked", detail: `No superuser provisioned.` };
  const { data: newDraft, error } = await deliverableDefinitionsDB.createDraft({
    code: concept.code,
    description: concept.description,
    version: nextVersion,
    authoredBy: reactivateMaster.id,
    authorBadge,
    draftContent: { code: concept.code, description: concept.description, definitionVersion: nextVersion },
    tenantId: concept.tenant_id,
    parentDeliverableDefinitionId: concept.parent_deliverable_definition_id,
    schemaDefinitionId: reactivationSchema.id,
  });
  if (error || !newDraft) return { ok: false, reason: "policy_blocked", detail: (error ?? new Error("failed to create new Deliverable Definition version")).message };

  let current = newDraft;
  for (const targetState of ["Validated", "Published", "Active"] as const) {
    const result = await transitionDeliverableDefinition({ deliverableDefinitionId: current.id, targetState, actorRole, actorId });
    if (!result.ok) return result;
    current = result.deliverableDefinition;
  }

  const { data: previousActive } = await deliverableDefinitionsDB.findActiveByCode(concept.code, concept.tenant_id);
  if (previousActive && previousActive.id !== current.id) {
    await transitionDeliverableDefinition({ deliverableDefinitionId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
  }

  return { ok: true, deliverableDefinition: current };
}

const AUTHORING_NEXT_STATE: Partial<Record<DeliverableDefinitionRow["status"], DeliverableDefinitionRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceDeliverableDefinitionOneStep(concept: DeliverableDefinitionRow, actorRole: string, actorId: string): Promise<TransitionDeliverableDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[concept.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Deliverable Definition is already ${concept.status} — no further authoring step` };

  if (targetState === "Active") {
    const { data: previousActive } = await deliverableDefinitionsDB.findActiveByCode(concept.code, concept.tenant_id);
    const activateResult = await transitionDeliverableDefinition({ deliverableDefinitionId: concept.id, targetState: "Active", actorRole, actorId });
    if (!activateResult.ok) return activateResult;
    if (previousActive && previousActive.id !== activateResult.deliverableDefinition.id) {
      await transitionDeliverableDefinition({ deliverableDefinitionId: previousActive.id, targetState: "Deprecated", actorRole, actorId });
    }
    return activateResult;
  }

  return transitionDeliverableDefinition({ deliverableDefinitionId: concept.id, targetState, actorRole, actorId });
}

export async function copyDeliverableDefinitionAsNewDraft(deliverableDefinitionId: string, actorId: string, authorBadge: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await deliverableDefinitionsDB.findById(deliverableDefinitionId);
  if (!source) return { ok: false, errors: ["Deliverable Definition not found"] };
  const nextVersion = await nextAvailablePatchVersion(source.code, source.version, source.tenant_id);
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Deliverable");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Deliverable`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const { data: newDraft, error } = await deliverableDefinitionsDB.createDraft({
    code: source.code,
    description: source.description,
    version: nextVersion,
    authoredBy: copyMaster.id,
    authorBadge,
    draftContent: { code: source.code, description: source.description, definitionVersion: nextVersion },
    tenantId: source.tenant_id,
    parentDeliverableDefinitionId: source.parent_deliverable_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Deliverable Definition")).message] };
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
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Deliverable", deliverableDefinition.status);
      return { deliverableDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
