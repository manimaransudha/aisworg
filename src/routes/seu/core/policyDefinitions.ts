import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { PolicyDefinitionRow, PolicyCondition } from "../../../dblayer/seuTypes.js";

// CR-089 — Policy Definition authoring (Book 3 Ch.24), mirroring
// core/serviceDefinitions.ts in shape. Two differences from that entity's
// own treatment:
//   1. Ch.24 §13's own lifecycle is used verbatim — Draft -> Validated ->
//      Published -> Active -> Deprecated -> Retired -> Archived — one hop
//      longer than Service Definition's leaner 6-state lifecycle (no
//      Validated step there). Owner: "Stick to the policy lifecycle defined
//      in chapter 24 for policy."
//   2. No Ontology sync on activation — `code` isn't itself an Ontology
//      concept type the way Service's `service-name`/Deliverable's
//      `deliverable-name` are (nothing outside this table references a
//      Policy Definition's code yet). Owner: "there is no relationship with
//      any other entity."

export interface PolicyDefinitionSeedInput {
  code: string;
  name: string;
  description?: string | null;
  category: string;
  constraintType: "Policy" | "Standard";
  applicabilityDeliverableNames?: string[];
  applicabilityEnvironments?: string[];
  applicabilityDeliverableLifecycle?: string[];
  conditions?: PolicyCondition[];
  version: string;
  tenantId?: string;
  parentPolicyDefinitionId?: string | null;
}

export type PolicyDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const VALID_SEVERITIES = new Set(["Critical", "High", "Medium", "Low"]);
// Real transition_definitions states for entity_type = 'Deliverable' (the
// SEU-execution-instance lifecycle, Ch.24 §9's own "Deliverable Lifecycle
// State" applicability dimension) — not Ontology-backed, a different
// canonical source than applicabilityDeliverableNames/applicabilityEnvironments.
const VALID_DELIVERABLE_LIFECYCLE_STATES = new Set(["Defined", "In Progress", "Approved", "Baselined"]);

async function assertPolicyDefinitionCodeVersionFree(code: string, version: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await policyDefinitionsDB.findByCodeAndVersion(code, version, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Policy Definition with code "${code}" already exists at version ${version}. Pick a different starting version, or continue authoring that existing Definition instead of starting a new one.`;
  }
  return null;
}

function validateConditions(conditions: PolicyCondition[] | undefined): string[] {
  const errors: string[] = [];
  for (const [i, cond] of (conditions ?? []).entries()) {
    if (!cond?.statement?.trim()) errors.push(`condition ${i + 1}: statement is required`);
    if (cond?.severity && !VALID_SEVERITIES.has(cond.severity)) errors.push(`condition ${i + 1}: severity "${cond.severity}" is not one of Critical/High/Medium/Low`);
  }
  return errors;
}

export async function validatePolicyDefinitionSeed(seed: PolicyDefinitionSeedInput, excludeId?: string): Promise<PolicyDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.category?.trim()) errors.push("category is required");
  if (!SEMVER_RE.test(seed.version ?? "")) errors.push(`version must be semver (x.y.z), got: "${seed.version}"`);

  const tenantId = seed.tenantId ?? PLATFORM_TENANT_ID;
  if (seed.code?.trim() && SEMVER_RE.test(seed.version ?? "")) {
    const collision = await assertPolicyDefinitionCodeVersionFree(seed.code, seed.version, tenantId, excludeId);
    if (collision) errors.push(collision);
  }
  if (seed.category?.trim()) {
    try {
      await assertCanonicalCategory("category:policy", seed.category.trim());
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  for (const deliverableName of seed.applicabilityDeliverableNames ?? []) {
    try {
      await assertCanonicalCategory("deliverable-name", deliverableName);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  for (const environment of seed.applicabilityEnvironments ?? []) {
    try {
      await assertCanonicalCategory("category:environment", environment);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  for (const state of seed.applicabilityDeliverableLifecycle ?? []) {
    if (!VALID_DELIVERABLE_LIFECYCLE_STATES.has(state)) {
      errors.push(`applicabilityDeliverableLifecycle "${state}" is not one of Defined/In Progress/Approved/Baselined`);
    }
  }
  errors.push(...validateConditions(seed.conditions));

  if (seed.parentPolicyDefinitionId) {
    const { data: parent } = await policyDefinitionsDB.findById(seed.parentPolicyDefinitionId);
    if (!parent) {
      errors.push(`parentPolicyDefinitionId "${seed.parentPolicyDefinitionId}" not found`);
    } else if (parent.status !== "Active") {
      errors.push(`a Policy Definition can only be inherited from an Active Version`);
    } else if (parent.tenant_id !== PLATFORM_TENANT_ID && parent.tenant_id !== tenantId) {
      errors.push(`parent Policy Definition is not visible to this tenant`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export async function listInheritablePolicyDefinitions(): Promise<Array<{ id: string; code: string; name: string; category: string; version: string }>> {
  const { data: rows } = await policyDefinitionsDB.findActivePlatformOwned();
  return (rows ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name, category: r.category, version: r.version })).sort((a, b) => a.code.localeCompare(b.code));
}

export async function inheritedPolicyDefinitionContent(parentPolicyDefinitionId: string): Promise<{ ok: true; content: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: parent } = await policyDefinitionsDB.findById(parentPolicyDefinitionId);
  if (!parent) return { ok: false, error: "parent Policy Definition not found" };
  if (parent.status !== "Active") return { ok: false, error: "a Policy Definition can only be inherited from an Active Version" };
  return {
    ok: true,
    content: {
      code: parent.code, name: parent.name, description: parent.description ?? "", category: parent.category, constraintType: parent.constraint_type,
      applicabilityDeliverableNames: parent.applicability_deliverable_names, applicabilityEnvironments: parent.applicability_environments,
      applicabilityDeliverableLifecycle: parent.applicability_deliverable_lifecycle.join(", "), conditions: parent.conditions,
    },
  };
}

export type TransitionPolicyDefinitionResult = { ok: true; policyDefinition: PolicyDefinitionRow } | { ok: false; reason: string; detail?: string };

const EVENT_BY_TARGET_STATE: Record<string, string> = {
  Validated: "PolicyDefinitionValidated",
  Published: "PolicyDefinitionPublished",
  Active: "PolicyDefinitionActivated",
  Deprecated: "PolicyDefinitionDeprecated",
  Retired: "PolicyDefinitionRetired",
  Archived: "PolicyDefinitionArchived",
};

export async function transitionPolicyDefinition(input: { policyDefinitionId: string; targetState: PolicyDefinitionRow["status"]; actorRole: string; actorId?: string }): Promise<TransitionPolicyDefinitionResult> {
  const { data: policyDefinition } = await policyDefinitionsDB.findById(input.policyDefinitionId);
  if (!policyDefinition) return { ok: false, reason: "not_found" };
  const fromState = policyDefinition.status;
  const gate = await transitionEngine.evaluate({ entityType: "Policy", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, context: { policyDefinition } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Policy ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }

  const { data: updated, error } = await policyDefinitionsDB.updateStatus(policyDefinition.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Policy Definition status");

  await eventBus.publish({
    eventType: EVENT_BY_TARGET_STATE[input.targetState] ?? "PolicyDefinitionTransitioned",
    originatingObjectType: "PolicyDefinition",
    originatingObjectId: updated.id,
    seuId: null, // platform catalog entity, not SEU-scoped
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });
  return { ok: true, policyDefinition: updated };
}

// Mirrors advanceServiceDefinitionOneStep — runs exactly the NEXT governed
// hop off the entity's current status.
const AUTHORING_NEXT_STATE: Partial<Record<PolicyDefinitionRow["status"], PolicyDefinitionRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advancePolicyDefinitionOneStep(policyDefinition: PolicyDefinitionRow, actorRole: string, actorId: string | undefined): Promise<TransitionPolicyDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[policyDefinition.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Policy Definition is already ${policyDefinition.status} — no further authoring step` };
  return transitionPolicyDefinition({ policyDefinitionId: policyDefinition.id, targetState, actorRole, actorId });
}

// Registry "Copy" action, mirrors copyServiceDefinitionAsNewDraft.
export async function copyPolicyDefinitionAsNewDraft(policyDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await policyDefinitionsDB.findById(policyDefinitionId);
  if (!source) return { ok: false, errors: ["Policy Definition not found"] };
  const { data: newDraft, error } = await policyDefinitionsDB.createDraft({
    code: source.code,
    name: source.name,
    description: source.description,
    category: source.category,
    constraintType: source.constraint_type,
    applicabilityDeliverableNames: source.applicability_deliverable_names,
    applicabilityEnvironments: source.applicability_environments,
    applicabilityDeliverableLifecycle: source.applicability_deliverable_lifecycle,
    conditions: source.conditions,
    version: source.version,
    authoredBy: Number(actorId),
    draftContent: {
      code: source.code, name: source.name, description: source.description ?? "", category: source.category, constraintType: source.constraint_type,
      applicabilityDeliverableNames: source.applicability_deliverable_names, applicabilityEnvironments: source.applicability_environments,
      applicabilityDeliverableLifecycle: source.applicability_deliverable_lifecycle.join(", "), conditions: source.conditions,
    },
    tenantId: source.tenant_id,
    parentPolicyDefinitionId: source.parent_policy_definition_id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Policy Definition")).message] };
  return { ok: true, draftId: newDraft.id };
}

export interface PolicyDefinitionWithNextStates {
  policyDefinition: PolicyDefinitionRow;
  possibleNextStates: string[];
}

// Policy Definition Registry — every Version of every Definition, with its
// own governed next states, mirroring listServiceDefinitionsWithNextStates.
export async function listPolicyDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<PolicyDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await policyDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await policyDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (policyDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Policy", policyDefinition.status);
      return { policyDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
