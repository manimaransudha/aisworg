import { qualityGateDefinitionsDB } from "../../../dblayer/qualityGateDefinitionsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory, validateComposableFieldsAgainstSchema } from "./ontology.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { reviewGatesDB } from "../../../dblayer/reviewGatesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import type { QualityGateDefinitionRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";
import {
  getPlatformTenantId, QUALITY_GATE_CRITERIA_TYPE_CONCEPT, QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION,
  QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW, QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY,
} from "../../../dblayer/constants.js";
import { nextAvailablePatchVersion, semverError } from "../../../utils/version.js";

export interface QualityGateDefinitionSeedInput {
  code: string;
  name: string;
  description?: string | null;
  category: string;
  governedTransition: string;
  criteriaType: string;
  evidenceCategory?: string | null;
  // The review gate (by deliverable type) of the Quality Gate form field `deliverableName`.
  reviewGateCode?: string | null;
  requiredPolicyCodes?: string[];
  checklistIds?: string[];
  recommendedChecklistIds?: string[];
  applicabilityDeliverableNames?: string[];
  version: string;
  tenantId?: string;
}

export type QualityGateDefinitionValidationResult = { ok: true } | { ok: false; errors: string[] };

export function parseGovernedTransition(value: string | undefined): { entityType: TransitionEntityType; fromState: string; toState: string } | null {
  const parts = (value ?? "").split("|");
  if (parts.length !== 3 || parts.some((p) => !p.trim())) return null;
  const [entityType, fromState, toState] = parts;
  return { entityType: entityType as TransitionEntityType, fromState, toState };
}

// The references of a quality gate resolve against the Platform and the viewer's tenant, and are not limited to a Pack (CR-145).
async function referenceErrors(seed: QualityGateDefinitionSeedInput, tenantId: string): Promise<string[]> {
  const errors: string[] = [];
  if (seed.criteriaType === QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY) {
    if (!seed.requiredPolicyCodes?.length) errors.push(`criteriaType ${QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY} needs requiredPolicyCodes`);
    else {
      const { data: found } = await policyDefinitionsDB.findActiveByCodesVisibleTo(seed.requiredPolicyCodes, tenantId);
      const foundCodes = new Set((found ?? []).map((p) => p.code));
      for (const code of seed.requiredPolicyCodes) if (!foundCodes.has(code)) errors.push(`requiredPolicyCodes "${code}" is not an Active Policy Definition of the Platform or of this tenant`);
    }
  }
  if (seed.criteriaType === QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW) {
    if (!seed.reviewGateCode?.trim()) errors.push(`criteriaType ${QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW} needs a review gate (deliverableName)`);
    else {
      const { data: gates } = await reviewGatesDB.findActiveVisibleTo(tenantId);
      if (!(gates ?? []).some((g) => g.code === seed.reviewGateCode)) errors.push(`review gate "${seed.reviewGateCode}" is not an active review gate of an Active Pack of the Platform or of this tenant`);
    }
  }
  const checklistRefs = [...(seed.checklistIds ?? []), ...(seed.recommendedChecklistIds ?? [])];
  if (checklistRefs.length > 0) {
    const { data: visible } = await checklistsDB.findActiveVisibleTo(tenantId);
    const visibleIds = new Set((visible ?? []).map((c) => c.id));
    for (const id of checklistRefs) if (!visibleIds.has(id)) errors.push(`Checklist "${id}" is not a Checklist of an Active Pack of the Platform or of this tenant`);
  }
  return errors;
}

export async function validateQualityGateDefinitionSeed(seed: QualityGateDefinitionSeedInput, draft = false, skipComposableChecks: boolean = draft): Promise<QualityGateDefinitionValidationResult> {
  const errors: string[] = [];
  if (!seed.code?.trim()) errors.push("code is required");
  if (!seed.name?.trim()) errors.push("name is required");
  if (!seed.category?.trim()) errors.push("category is required");
  if (!seed.criteriaType?.trim()) errors.push("criteriaType is required");
  const versionError = semverError("version", seed.version);
  if (versionError) errors.push(versionError);

  const tenantId = seed.tenantId ?? (await getPlatformTenantId());

  const scope = parseGovernedTransition(seed.governedTransition);
  if (!scope) errors.push(`governedTransition must be "EntityType|fromState|toState"`);
  else {
    const { data: definition } = await transitionDefinitionsDB.find(scope.entityType, scope.fromState, scope.toState);
    if (!definition) errors.push(`governedTransition references a transition that does not exist: ${scope.entityType} ${scope.fromState} -> ${scope.toState}`);
  }

  if (seed.criteriaType) {
    try {
      await assertCanonicalCategory(QUALITY_GATE_CRITERIA_TYPE_CONCEPT, seed.criteriaType, { isRoot: false, tenantId });
    } catch (err) {
      errors.push(`criteriaType: ${(err as Error).message}`);
    }
  }
  if (seed.criteriaType === QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION && !seed.evidenceCategory?.trim()) {
    errors.push(`criteriaType ${QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION} needs an evidenceCategory`);
  }
  for (const name of seed.applicabilityDeliverableNames ?? []) {
    try {
      await assertCanonicalCategory("deliverable-name", name, { isRoot: false, tenantId });
    } catch (err) {
      errors.push(`applicabilityDeliverableNames: ${(err as Error).message}`);
    }
  }
  errors.push(...(await referenceErrors(seed, tenantId)));

  if (!skipComposableChecks) {
    const { data: schemaRow } = await schemaDefinitionsDB.findLatest("QualityGate");
    if (schemaRow) {
      errors.push(...(await validateComposableFieldsAgainstSchema(schemaRow.schema as JsonSchemaDocument, { code: seed.code, category: seed.category, evidenceCategory: seed.evidenceCategory ?? "" }, { isRoot: false, tenantId })));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

export async function copyQualityGateDefinitionAsNewDraft(qualityGateDefinitionId: string, actorId: string): Promise<{ ok: true; draftId: string } | { ok: false; errors: string[] }> {
  const { data: source } = await qualityGateDefinitionsDB.findById(qualityGateDefinitionId);
  if (!source) return { ok: false, errors: ["Quality Gate Definition not found"] };
  const { data: copySchema } = source.schema_definition_id ? { data: { id: source.schema_definition_id } } : await schemaDefinitionsDB.findLatest("QualityGate");
  if (!copySchema) return { ok: false, errors: [`no schema_definitions grammar for QualityGate`] };
  const { data: copyMaster } = await participantsMasterDB.findById(actorId);
  if (!copyMaster) return { ok: false, errors: [`No superuser provisioned.`] };
  const birth = await transitionEngine.beginBirth({ entityType: "QualityGate", actorId });
  const { data: newDraft, error } = await qualityGateDefinitionsDB.createDraft({
    code: source.code,
    name: source.name,
    description: source.description,
    category: source.category,
    governedTransition: source.governed_transition,
    criteriaType: source.criteria_type,
    evidenceCategory: source.evidence_category,
    reviewGateCode: source.review_gate_code,
    requiredPolicyCodes: source.required_policy_codes,
    checklistIds: source.checklist_ids,
    recommendedChecklistIds: source.recommended_checklist_ids,
    applicabilityDeliverableNames: source.applicability_deliverable_names,
    version: await nextAvailablePatchVersion(source.version, async (candidate) => !!(await qualityGateDefinitionsDB.findByCodeAndVersion(source.code, candidate, copyMaster.tenant_id)).data),
    status: birth.initialState as QualityGateDefinitionRow["status"],
    authoredBy: copyMaster.id,
    authorBadge: birth.authorityBadge,
    draftContent: { ...(source.draft_content ?? {}) },
    tenantId: copyMaster.tenant_id,
    parentQualityGateDefinitionId: source.parent_quality_gate_definition_id,
    schemaDefinitionId: copySchema.id,
  });
  if (error || !newDraft) return { ok: false, errors: [(error ?? new Error("failed to copy Quality Gate Definition")).message] };
  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "QualityGate",
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

export interface QualityGateDefinitionWithNextStates {
  qualityGateDefinition: QualityGateDefinitionRow;
  possibleNextStates: string[];
}

export async function listQualityGateDefinitionsWithNextStates(viewer?: { isRoot: boolean; tenantId: string } | null): Promise<QualityGateDefinitionWithNextStates[]> {
  const { data: rows } = viewer && !viewer.isRoot ? await qualityGateDefinitionsDB.findAllVisibleTo(viewer.tenantId) : await qualityGateDefinitionsDB.findAll();
  return Promise.all(
    (rows ?? []).map(async (qualityGateDefinition) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("QualityGate", qualityGateDefinition.status);
      return { qualityGateDefinition, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}
