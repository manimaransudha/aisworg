import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, validateComposableFieldsAgainstSchema } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { listActiveNouns, activeMappingByNoun } from "./authorityVocabulary.js";
import type { EvidenceDefinition, PolicyDefinitionRow, PolicyCondition, PolicyScope } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";

export interface PolicyDefinitionSeedInput {
  code: string;
  name: string;
  description?: string | null;
  category: string;
  constraintType: "Policy" | "Standard";
  applicabilityEnvironments?: string[];
  conditions?: PolicyCondition[];
  scope?: PolicyScope;
  version: string;
  tenantId?: string;
  parentPolicyDefinitionId?: string | null;
}

export type PolicyDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export async function listTransitionsForEntityType(entityType: string): Promise<string[]> {
  const { data } = await transitionDefinitionsDB.listAll();
  const transitions = new Set<string>();
  for (const row of data ?? []) {
    if (row.entity_type !== entityType || !row.is_active) continue;
    transitions.add(`${entityType}|${row.from_state}|${row.to_state}`);
  }
  return [...transitions].sort();
}

async function assertPolicyDefinitionCodeVersionFree(code: string, version: string, tenantId: string, excludeId?: string): Promise<string | null> {
  const { data: existing } = await policyDefinitionsDB.findByCodeAndVersion(code, version, tenantId);
  if (existing && existing.id !== excludeId) {
    return `A Policy Definition with code "${code}" already exists at version ${version}. Pick a different starting version, or continue authoring that existing Definition instead of starting a new one.`;
  }
  return null;
}

const EXCEPTION_COMPOSITIONS = new Set(["all", "any"]);

async function validateEvidenceDefinition(evidence: EvidenceDefinition | undefined, label: string): Promise<string[]> {
  if (!evidence?.category?.trim()) return [];
  try {
    await assertCanonicalCategory("category:evidence", evidence.category);
    return [];
  } catch (err) {
    return [`${label}: ${(err as Error).message}`];
  }
}

function validateGoverningCondition(governingCondition: Record<string, unknown> | null | undefined, label: string): string[] {
  if (governingCondition == null) return [];
  const errors: string[] = [];
  const gc = governingCondition as { type?: unknown; field?: unknown; operator?: unknown; values?: unknown; value?: unknown };
  if (typeof gc.type !== "string") {
    errors.push(`${label}: governingCondition must have a "type" (e.g. {"type": "always_true"}), or be left blank for a manual condition`);
  } else if (gc.type === "field_in") {
    if (!gc.field) errors.push(`${label}: governingCondition (field_in) requires a field`);
    if (!Array.isArray(gc.values) || !gc.values.length) errors.push(`${label}: governingCondition (field_in) requires at least one value`);
  } else if (gc.type === "comparison" || gc.type === "threshold") {
    if (!gc.field) errors.push(`${label}: governingCondition (${gc.type}) requires a field`);
    if (gc.value === undefined || gc.value === "") errors.push(`${label}: governingCondition (${gc.type}) requires a value`);
    const allowedOperators = gc.type === "threshold" ? new Set(["gte", "gt"]) : new Set(["gt", "gte", "lt", "lte", "eq", "neq"]);
    if (typeof gc.operator !== "string" || !allowedOperators.has(gc.operator)) {
      errors.push(`${label}: governingCondition (${gc.type}) operator "${gc.operator}" is not one of ${[...allowedOperators].join("/")}`);
    }
  } else if (gc.type !== "always_true") {
    errors.push(`${label}: governingCondition type "${gc.type}" is not one of always_true/field_in/comparison/threshold`);
  }
  return errors;
}

async function validateConditions(conditions: PolicyCondition[] | undefined, scope: PolicyScope | undefined, draft: boolean, constraintType: "Policy" | "Standard"): Promise<string[]> {
  const errors: string[] = [];
  const validBadges = new Set(
    Object.entries(await activeMappingByNoun()).flatMap(([noun, verbs]) => verbs.map((verb) => `${noun}_${verb}`))
  );
  const validNouns = scope === "Eligibility" ? new Set((await listActiveNouns()).map((n) => n.code)) : null;
  const deliverableTransitions = scope === "Eligibility" ? null : new Set(await listTransitionsForEntityType("Deliverable"));
  for (const [i, cond] of (conditions ?? []).entries()) {
    const label = `condition ${i + 1}`;
    if (!cond?.statement?.trim()) errors.push(`${label}: statement is required`);
    if (cond?.severity) {
      try {
        await assertCanonicalCategory("category:policy-condition-severity", cond.severity);
      } catch (err) {
        errors.push(`${label}: ${(err as Error).message}`);
      }
    }
    for (const [d, row] of (cond?.applicabilityDeliverables ?? []).entries()) {
      const dLabel = `${label} applicabilityDeliverables ${d + 1}`;
      if (!row.name?.trim()) {
        errors.push(`${dLabel}: name is required`);
        continue;
      }
      if (scope === "Eligibility") {
        if (!draft && !validNouns!.has(row.name)) {
          errors.push(`${dLabel}: name "${row.name}" is not one of this platform's real active Authority Vocabulary nouns (${[...validNouns!].join(", ")})`);
        }
        if (row.transitions.length) {
          const validTransitions = new Set(await listTransitionsForEntityType(row.name));
          for (const transition of row.transitions) {
            if (!validTransitions.has(transition)) errors.push(`${dLabel}: transition "${transition}" is not one of ${row.name}'s real transitions (${[...validTransitions].join(", ")})`);
          }
        }
      } else {
        if (!draft) {
          try {
            await assertCanonicalCategory("deliverable-name", row.name);
          } catch (err) {
            errors.push(`${dLabel}: ${(err as Error).message}`);
          }
        }
        for (const transition of row.transitions) {
          if (!deliverableTransitions!.has(transition)) errors.push(`${dLabel}: transition "${transition}" is not one of Deliverable's real transitions (${[...deliverableTransitions!].join(", ")})`);
        }
      }
      errors.push(...validateGoverningCondition(row.governingCondition, dLabel));
    }
    errors.push(...(await validateEvidenceDefinition(cond?.requiredEvidence, `${label} requiredEvidence`)));
    for (const [j, ob] of (cond?.relatedObligations ?? []).entries()) {
      const obLabel = `${label} relatedObligations ${j + 1}`;
      if (!ob.category?.trim()) {
        errors.push(`${obLabel}: category is required`);
        continue;
      }
      try {
        await assertCanonicalCategory("category:obligation", ob.category);
      } catch (err) {
        errors.push(`${obLabel}: ${(err as Error).message}`);
      }
      if (ob.origin) {
        try {
          await assertCanonicalCategory("category:obligation-origin", ob.origin);
        } catch (err) {
          errors.push(`${obLabel}: ${(err as Error).message}`);
        }
      }
      if (ob.priority) {
        try {
          await assertCanonicalCategory("category:obligation-priority", ob.priority);
        } catch (err) {
          errors.push(`${obLabel}: ${(err as Error).message}`);
        }
      }
      if (ob.severity) {
        try {
          await assertCanonicalCategory("category:obligation-severity", ob.severity);
        } catch (err) {
          errors.push(`${obLabel}: ${(err as Error).message}`);
        }
      }
      errors.push(...(await validateEvidenceDefinition(ob.requiredEvidence, `${obLabel} requiredEvidence`)));
    }
    if ((cond?.exceptionRules ?? []).length && constraintType !== "Policy") {
      errors.push(`${label}: exceptionRules can only be declared when constraintType is "Policy" (this Definition is "${constraintType}")`);
    }
    for (const [k, ex] of (cond?.exceptionRules ?? []).entries()) {
      const exLabel = `${label} exceptionRules ${k + 1}`;
      if (!ex.exceptionStatement?.trim()) errors.push(`${exLabel}: exceptionStatement is required`);
      if (ex.exceptionComposition && !EXCEPTION_COMPOSITIONS.has(ex.exceptionComposition)) {
        errors.push(`${exLabel}: exceptionComposition "${ex.exceptionComposition}" is not one of all/any`);
      }
      for (const approver of ex.exceptionApprovers ?? []) {
        if (!validBadges.has(approver)) {
          errors.push(`${exLabel}: exceptionApprovers "${approver}" is not one of this platform's real active badges (noun_verb)`);
        }
      }
    }
  }
  return errors;
}

export async function validatePolicyDefinitionSeed(seed: PolicyDefinitionSeedInput, excludeId?: string, draft = false, skipComposableChecks: boolean = draft): Promise<PolicyDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.category?.trim()) errors.push("category is required");
  if (!SEMVER_RE.test(seed.version ?? "")) errors.push(`version must be semver (x.y.z), got: "${seed.version}"`);

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());
  if (seed.code?.trim() && SEMVER_RE.test(seed.version ?? "")) {
    const collision = await assertPolicyDefinitionCodeVersionFree(seed.code, seed.version, tenantId, excludeId);
    if (collision) errors.push(collision);
  }
  if (!skipComposableChecks) {
    const { data: policySchemaRow } = await schemaDefinitionsDB.findLatest("Policy");
    if (policySchemaRow) {
      errors.push(...(await validateComposableFieldsAgainstSchema(policySchemaRow.schema as JsonSchemaDocument, { applicabilityEnvironments: seed.applicabilityEnvironments, category: seed.category }, { isRoot: false, tenantId })));
    }
  }
  if (seed.scope && seed.scope !== "Transition" && seed.scope !== "Eligibility") {
    errors.push(`scope "${seed.scope}" is not one of Transition/Eligibility`);
  }
  errors.push(...(await validateConditions(seed.conditions, seed.scope, draft, seed.constraintType)));

  if (seed.parentPolicyDefinitionId) {
    const { data: parent } = await policyDefinitionsDB.findById(seed.parentPolicyDefinitionId);
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
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
      applicabilityEnvironments: parent.applicability_environments,
      conditions: parent.conditions,
      scope: parent.scope,
    },
  };
}

export type TransitionPolicyDefinitionResult = { ok: true; policyDefinition: PolicyDefinitionRow } | { ok: false; reason: string; detail?: string };

export async function transitionPolicyDefinition(input: { policyDefinitionId: string; targetState: PolicyDefinitionRow["status"]; actorRole: string; actorId: string }): Promise<TransitionPolicyDefinitionResult> {
  const { data: policyDefinition } = await policyDefinitionsDB.findById(input.policyDefinitionId);
  if (!policyDefinition) return { ok: false, reason: "not_found" };
  const fromState = policyDefinition.status;
  const gate = await transitionEngine.evaluate({ entityType: "Policy", fromState, toState: input.targetState, actorRole: input.actorRole, actorId: input.actorId, entityId: policyDefinition.id, context: { policyDefinition } });
  if (!gate.allowed) {
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Policy ${fromState} -> ${input.targetState}` };
    if (gate.reason === "policy_blocked") return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
    return { ok: false, reason: gate.reason };
  }
  if (!gate.authorityBadge) {
    return { ok: false, reason: "not_authorised" };
  }
  const { data: updated, error } = await policyDefinitionsDB.updateStatus(policyDefinition.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update Policy Definition status");

  await eventBus.publish({
    eventType: gate.eventType ?? "PolicyDefinitionTransitioned",
    originatingObjectType: "PolicyDefinition",
    originatingObjectId: updated.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState, code: updated.code },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
    versionEvent: gate.versionEvent,
    fromState,
    toState: input.targetState,
    tenantId: updated.tenant_id,
  });
  return { ok: true, policyDefinition: updated };
}

const AUTHORING_NEXT_STATE: Partial<Record<PolicyDefinitionRow["status"], PolicyDefinitionRow["status"]>> = {
  Draft: "Validated",
  Validated: "Published",
  Published: "Active",
  Active: "Deprecated",
  Deprecated: "Retired",
  Retired: "Archived",
};

export async function advancePolicyDefinitionOneStep(policyDefinition: PolicyDefinitionRow, actorRole: string, actorId: string): Promise<TransitionPolicyDefinitionResult> {
  const targetState = AUTHORING_NEXT_STATE[policyDefinition.status];
  if (!targetState) return { ok: false, reason: "no_further_step", detail: `Policy Definition is already ${policyDefinition.status} — no further authoring step` };
  return transitionPolicyDefinition({ policyDefinitionId: policyDefinition.id, targetState, actorRole, actorId });
}

export async function copyPolicyDefinitionAsNewDraft(policyDefinitionId: string, actorId: string, authorBadge: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await policyDefinitionsDB.findById(policyDefinitionId);
  if (!source) return { ok: false, errors: ["Policy Definition not found"] };
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("Policy");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for Policy`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const { data: newDraft, error } = await policyDefinitionsDB.createDraft({
    code: source.code,
    name: source.name,
    description: source.description,
    category: source.category,
    constraintType: source.constraint_type,
    applicabilityEnvironments: source.applicability_environments,
    conditions: source.conditions,
    scope: source.scope,
    version: source.version,
    authoredBy: copyMaster.id,
    authorBadge,
    draftContent: {
      code: source.code, name: source.name, description: source.description ?? "", category: source.category, constraintType: source.constraint_type,
      applicabilityEnvironments: source.applicability_environments,
      conditions: source.conditions,
      scope: source.scope,
    },
    tenantId: source.tenant_id,
    parentPolicyDefinitionId: source.parent_policy_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Policy Definition")).message] };
  return { ok: true, draftId: newDraft.id };
}

export interface PolicyDefinitionWithNextStates {
  policyDefinition: PolicyDefinitionRow;
  possibleNextStates: string[];
}

export async function listPolicyDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<PolicyDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await policyDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await policyDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (policyDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Policy", policyDefinition.status);
      return { policyDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
