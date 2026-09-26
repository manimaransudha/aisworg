import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { assertCanonicalCategory } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { CapabilityDefinitionRow, CapabilityRole } from "../../../dblayer/seuTypes.js";

// CR-111 — Capability Definition authoring, mirroring
// core/serviceDefinitions.ts in shape (Service Definition's own lean 6-state
// lifecycle, Defined -> Published -> Active -> Deprecated -> Retired ->
// Archived, chosen verbatim). No Ontology sync on activation, unlike Service
// (which syncs the separate service-name concept type) — `code` here IS
// itself the capability-name concept (migration 046), not a second,
// independently-synced identity.

export interface CapabilityDefinitionSeedInput {
  code: string;
  defaultLabel: string;
  description?: string | null;
  roles?: CapabilityRole[];
  version: string;
  tenantId?: string;
  parentCapabilityDefinitionId?: string | null;
}

export type CapabilityDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function assertCapabilityDefinitionCodeVersionFree(code: string, version: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await capabilityDefinitionsDB.findByCodeAndVersion(code, version, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Capability Definition with code "${code}" already exists at version ${version}. Pick a different starting version, or continue authoring that existing Definition instead of starting a new one.`;
  }
  return null;
}

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
  if (!SEMVER_RE.test(seed.version ?? "")) errors.push(`version must be semver (x.y.z), got: "${seed.version}"`);

  const tenantId = seed.tenantId ?? PLATFORM_TENANT_ID;
  if (seed.code?.trim() && SEMVER_RE.test(seed.version ?? "")) {
    const collision = await assertCapabilityDefinitionCodeVersionFree(seed.code, seed.version, tenantId, excludeId);
    if (collision) errors.push(collision);
  }
  if (seed.code?.trim()) {
    try {
      await assertCanonicalCategory("capability-name", seed.code.trim());
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  errors.push(...(await validateRoles(seed.roles)));

  if (seed.parentCapabilityDefinitionId) {
    const { data: parent } = await capabilityDefinitionsDB.findById(seed.parentCapabilityDefinitionId);
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
    content: { code: parent.code, defaultLabel: parent.default_label, description: parent.description ?? "", roles: parent.roles },
  };
}

export type TransitionCapabilityDefinitionResult = { ok: true; capabilityDefinition: CapabilityDefinitionRow } | { ok: false; reason: string; detail?: string };

// Version Feature Plan.md — transition_definitions' event_type/version_event
// wired in at build time (migration 273 + seedTransitionDefinitions' own
// data file), read straight off the resolved Transition Definition, same as
// transitionServiceDefinition/transitionPolicyDefinition already do.
export async function transitionCapabilityDefinition(input: { capabilityDefinitionId: string; targetState: CapabilityDefinitionRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionCapabilityDefinitionResult> {
  const { data: capabilityDefinition } = await capabilityDefinitionsDB.findById(input.capabilityDefinitionId);
  if (!capabilityDefinition) return { ok: false, reason: "not_found" };
  const fromState = capabilityDefinition.status;
  const gate = await transitionEngine.evaluate({ entityType: "Capability", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, entityId: capabilityDefinition.id, context: { capabilityDefinition } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Capability ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  const { data: updated, error } = await capabilityDefinitionsDB.updateStatus(capabilityDefinition.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Capability Definition status");

  await eventBus.publish({
    eventType: gate.eventType ?? "CapabilityDefinitionTransitioned",
    originatingObjectType: "CapabilityDefinition",
    originatingObjectId: updated.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, capabilityDefinition: updated };
}

// Mirrors advanceServiceDefinitionOneStep — runs exactly the NEXT governed
// hop off the entity's current status.
const AUTHORING_NEXT_STATE: Partial<Record<CapabilityDefinitionRow["status"], CapabilityDefinitionRow["status"]>> = {
  Defined: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advanceCapabilityDefinitionOneStep(capabilityDefinition: CapabilityDefinitionRow, actorRole: string, actorId: string | undefined): Promise<TransitionCapabilityDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[capabilityDefinition.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Capability Definition is already ${capabilityDefinition.status} — no further authoring step` };
  return transitionCapabilityDefinition({ capabilityDefinitionId: capabilityDefinition.id, targetState, actorRole, actorId });
}

// Registry "Copy" action, mirrors copyServiceDefinitionAsNewDraft.
export async function copyCapabilityDefinitionAsNewDraft(capabilityDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await capabilityDefinitionsDB.findById(capabilityDefinitionId);
  if (!source) return { ok: false, errors: ["Capability Definition not found"] };
  // CR-114 follow-on — same carry-forward-the-source's-own-pin reasoning as
  // templates.ts's copyTemplateAsNewDraft.
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Capability");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Capability`] };
  const { data: newDraft, error } = await capabilityDefinitionsDB.createDraft({
    code: source.code,
    defaultLabel: source.default_label,
    description: source.description,
    roles: source.roles,
    version: source.version,
    authoredBy: Number(actorId),
    draftContent: { code: source.code, defaultLabel: source.default_label, description: source.description ?? "", roles: source.roles },
    tenantId: source.tenant_id,
    parentCapabilityDefinitionId: source.parent_capability_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Capability Definition")).message] };
  return { ok: true, draftId: newDraft.id };
}

export interface CapabilityDefinitionWithNextStates {
  capabilityDefinition: CapabilityDefinitionRow;
  possibleNextStates: string[];
}

// Capability Definition Registry — every Version of every Definition, with
// its own governed next states, mirroring listServiceDefinitionsWithNextStates.
export async function listCapabilityDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<CapabilityDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await capabilityDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await capabilityDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (capabilityDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Capability", capabilityDefinition.status);
      return { capabilityDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
