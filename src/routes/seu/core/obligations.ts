import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { evaluateCondition, type GoverningCondition } from "../../../domain/engine/governingCondition.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine, RESOLVED_OBLIGATION_STATUSES } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { raiseAttentionItem, resolveAuthor, resolveSystemActor } from "./attentionItems.js";
import type { AttentionItemRow, ObligationDefinition, ObligationRow, PolicyApplicabilityDeliverable, TransitionEntityType } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 
export async function resolveSeuIdFromRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<string> {
  if (relatedObjectType === "SEU") return relatedObjectId;
  if (relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${relatedObjectId}`);
    return deliverable.seu_id;
  }
  if (relatedObjectType === "Obligation") {
    const { data: related } = await obligationsDB.findById(relatedObjectId);
    if (!related) throw new Error(`obligation not found: ${relatedObjectId}`);
    return related.seu_id;
  }
  if (relatedObjectType === "AttentionItem") {
    const { data: attentionItem } = await attentionItemsDB.findById(relatedObjectId);
    if (!attentionItem) throw new Error(`attention item not found: ${relatedObjectId}`);
    return attentionItem.seu_id;
  }
  throw new Error(`createObligation: relatedObjectType "${relatedObjectType}" is not a SEU-scoped entity type`);
}

export async function createObligation(input: {
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  category: string;
  title: string;
  description?: string | null;
  severity?: string;
  origin?: string | null;
  priority?: string | null;
  completionCriteria?: string | null;
  blockedFromState?: string | null;
  blockedToState?: string | null;
  originatingEntityType?: string | null;
  originatingEntityId?: string | null;
  assignedEntityType?: string | null;
  assignedEntityId?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<ObligationRow> {
  await assertCanonicalCategory("category:obligation", input.category);
  if (input.origin) await assertCanonicalCategory("category:obligation-origin", input.origin);
  if (input.priority) await assertCanonicalCategory("category:obligation-priority", input.priority);
  const seuId = await resolveSeuIdFromRelatedObject(input.relatedObjectType, input.relatedObjectId);

  let originatingEntityType = input.originatingEntityType ?? null;
  let originatingEntityId = input.originatingEntityId ?? null;
  if (!originatingEntityType || !originatingEntityId) {
    const { data: seu } = await seusDB.findById(seuId);
    originatingEntityType = "EBM";
    originatingEntityId = seu?.active_ebm_id ?? null;
  }

  const { authorId } = await resolveAuthor(seuId, input.actorId);

  const { data: obligation, error } = await obligationsDB.create({
    seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    category: input.category,
    title: input.title,
    description: input.description,
    severity: input.severity,
    origin: input.origin,
    priority: input.priority,
    completionCriteria: input.completionCriteria,
    blockedFromState: input.blockedFromState,
    blockedToState: input.blockedToState,
    originatingEntityType,
    originatingEntityId,
    assignedEntityType: input.assignedEntityType ?? null,
    assignedEntityId: input.assignedEntityId ?? null,
    authorId,
    authorBadge: input.authorBadge,
  });
  if (error || !obligation) throw error ?? new Error("failed to create obligation");

  await eventBus.publish({
    eventType: "ObligationCreated",
    originatingObjectType: "Obligation",
    originatingObjectId: obligation.id,
    seuId: obligation.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category, severity: obligation.severity },
  });

  return obligation;
}

function parseMaterializedPolicyCode(materializedCode: string): { plainCode: string; conditionIndex: number } {
  const [plainCode, conditionIndexRaw] = materializedCode.split("::");
  const conditionIndex = conditionIndexRaw !== undefined ? Number(conditionIndexRaw) : 0;
  return { plainCode, conditionIndex: Number.isFinite(conditionIndex) ? conditionIndex : 0 };
}

export async function raiseObligationForBlockedTransition(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  fromState: string;
  toState: string;
  policyCode: string;
}): Promise<{ obligations: ObligationRow[]; attentionItems: AttentionItemRow[] }> {
  const systemActor = await resolveSystemActor(input.seuId);
  const { data: policy } = await policiesDB.findByCode(input.policyCode);
  if (!policy) throw new Error(`policy "${input.policyCode}" not found while raising a blocked-transition Obligation`);

  const { plainCode, conditionIndex } = parseMaterializedPolicyCode(policy.code);
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(plainCode, PLATFORM_TENANT_ID);
  const condition = definition?.conditions?.[conditionIndex];
  const declaredObligations = condition?.relatedObligations ?? [];

  const { data: existingForEntity } = await obligationsDB.findByRelatedObject(input.relatedObjectType, input.relatedObjectId);
  const stillOpenForThisTransition = (existingForEntity ?? []).filter(
    (o) => o.blocked_to_state === input.toState && o.blocked_from_state === input.fromState && !RESOLVED_OBLIGATION_STATUSES.has(o.status)
  );

  const obligations: ObligationRow[] = [];
  const attentionItems: AttentionItemRow[] = [];
  for (const declared of declaredObligations) {
    const existing = stillOpenForThisTransition.find((o) => o.title === declared.title);

    const obligation =
      existing ??
      (await createObligation({
        relatedObjectType: input.relatedObjectType,
        relatedObjectId: input.relatedObjectId,
        category: declared.category,
        title: declared.title,
        description: declared.description,
        severity: declared.severity,
        origin: declared.origin,
        priority: declared.priority,
        completionCriteria: declared.completionCriteria,
        blockedFromState: input.fromState,
        blockedToState: input.toState,
        originatingEntityType: "Policy",
        originatingEntityId: policy.id,
        actorId: systemActor.actorId,
        authorBadge: systemActor.authorBadge,
      }));
    obligations.push(obligation);

    const { attentionItem } = await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      title: `${input.relatedObjectType} is blocked by Policy "${policy.name}" — ${declared.title}`,
      description: declared.description,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
      ...systemActor,
    });
    attentionItems.push(attentionItem);
  }

  return { obligations, attentionItems };
}

export async function raiseObligationsForPackDefinitions(input: {
  seuId: string;
  ebmId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  fromState: string;
  toState: string;
  context?: Record<string, unknown>;
}): Promise<{ obligations: ObligationRow[]; attentionItems: AttentionItemRow[] }> {
  const systemActor = await resolveSystemActor(input.seuId);
  const { data: ebm } = await ebmsDB.findById(input.ebmId);
  const pool = (ebm?.behaviors as { pool?: Array<{ propertyName: string; value: unknown; source?: { id?: string } }> } | null)?.pool ?? [];
  const governedTransition = `${input.relatedObjectType}|${input.fromState}|${input.toState}`;
  const context = input.context ?? {};

  type PoolObligationDefinition = { code: string; applicabilityDeliverables?: PolicyApplicabilityDeliverable[] } & ObligationDefinition;
  const definitions = pool
    .filter((entry) => entry.propertyName.startsWith("obligationDefinition::"))
    .map((entry) => ({ def: entry.value as PoolObligationDefinition, packId: entry.source?.id ?? null }))
    .filter(({ def }) => {
      const matchingRow = (def.applicabilityDeliverables ?? []).find((row) => row.name === input.relatedObjectType && row.transitions.includes(governedTransition));
      if (!matchingRow) return false;
      const condition = (matchingRow.governingCondition ?? { type: "always_true" }) as GoverningCondition;
      return evaluateCondition(condition, context);
    });
  if (definitions.length === 0) return { obligations: [], attentionItems: [] };

  const { data: existingForEntity } = await obligationsDB.findByRelatedObject(input.relatedObjectType, input.relatedObjectId);
  const existingForThisTransition = (existingForEntity ?? []).filter(
    (o) => o.blocked_to_state === input.toState && o.blocked_from_state === input.fromState
  );

  const obligations: ObligationRow[] = [];
  const attentionItems: AttentionItemRow[] = [];
  for (const { def, packId } of definitions) {
    const title = def.title || `Obligation "${def.code}" must be resolved before ${input.relatedObjectType} can move ${input.fromState} -> ${input.toState}`;
    const existing = existingForThisTransition.find((o) => o.title === title);
    if (existing && RESOLVED_OBLIGATION_STATUSES.has(existing.status)) continue;

    const obligation =
      existing ??
      (await createObligation({
        relatedObjectType: input.relatedObjectType,
        relatedObjectId: input.relatedObjectId,
        category: def.category,
        title,
        description: def.description,
        severity: def.severity,
        origin: def.origin,
        priority: def.priority,
        completionCriteria: def.completionCriteria,
        blockedFromState: input.fromState,
        blockedToState: input.toState,
        originatingEntityType: packId ? "Pack" : undefined,
        originatingEntityId: packId,
        actorId: systemActor.actorId,
        authorBadge: systemActor.authorBadge,
      }));
    obligations.push(obligation);

    const { attentionItem } = await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      title: `${input.relatedObjectType} is blocked by Obligation "${def.code}"`,
      description: def.description,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
      ...systemActor,
    });
    attentionItems.push(attentionItem);
  }

  return { obligations, attentionItems };
}

const REVISABLE_FIELDS = ["title", "description", "category", "severity", "priority", "completionCriteria", "assignedEntityType", "assignedEntityId"] as const;
const REVISABLE_FIELD_TO_COLUMN: Record<(typeof REVISABLE_FIELDS)[number], "title" | "description" | "category" | "severity" | "priority" | "completion_criteria" | "assigned_entity_type" | "assigned_entity_id"> = {
  title: "title",
  description: "description",
  category: "category",
  severity: "severity",
  priority: "priority",
  completionCriteria: "completion_criteria",
  assignedEntityType: "assigned_entity_type",
  assignedEntityId: "assigned_entity_id",
};

export async function reviseObligation(input: {
  obligationId: string;
  actorId: string;
  title?: string;
  description?: string | null;
  category?: string;
  severity?: string;
  priority?: string | null;
  completionCriteria?: string | null;
  assignedEntityType?: string | null;
  assignedEntityId?: string | null;
}): Promise<ObligationRow | null> {
  const { data: obligation } = await obligationsDB.findById(input.obligationId);
  if (!obligation) return null;

  if (input.category) await assertCanonicalCategory("category:obligation", input.category);
  if (input.priority) await assertCanonicalCategory("category:obligation-priority", input.priority);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const fields: Record<string, unknown> = {};
  for (const field of REVISABLE_FIELDS) {
    if (!(field in input)) continue;
    const column = REVISABLE_FIELD_TO_COLUMN[field];
    const newValue = (input as Record<string, unknown>)[field];
    const oldValue = obligation[column];
    if (newValue === oldValue) continue;
    changes[field] = { from: oldValue, to: newValue };
    fields[column] = newValue;
  }
  if (Object.keys(changes).length === 0) return obligation;

  const historyEntry = { occurred_at: new Date().toISOString(), actor_id: input.actorId ?? null, changes };
  const { data: updated, error } = await obligationsDB.update(
    input.obligationId,
    fields as Partial<Pick<ObligationRow, "title" | "description" | "category" | "severity" | "priority" | "completion_criteria" | "assigned_entity_type" | "assigned_entity_id">>,
    historyEntry
  );
  if (error || !updated) throw error ?? new Error("failed to revise obligation");
  return updated;
}

export async function listObligationsBySeu(seuId: string): Promise<ObligationRow[]> {
  const { data } = await obligationsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface ObligationWithNextStates {
  obligation: ObligationRow;
  possibleNextStates: string[];
}

export async function listObligationsWithNextStates(seuId: string): Promise<ObligationWithNextStates[]> {
  const obligations = await listObligationsBySeu(seuId);
  return Promise.all(
    obligations.map(async (obligation) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Obligation", obligation.status);
      return { obligation, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionObligationResult =
  | { ok: true; obligation: ObligationRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionObligation(input: { obligationId: string; targetState: string; actorRole: string; actorId: string }): Promise<TransitionObligationResult> {
  const { data: obligation } = await obligationsDB.findById(input.obligationId);
  if (!obligation) return { ok: false, reason: "not_found" };

  const fromState = obligation.status;

  const gate = await transitionEngine.evaluate({
    entityType: "Obligation",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { obligation },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Obligation ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  if (!input.actorId) throw new Error("actorId is required to transition an Obligation");
  if (!gate.authorityBadge) throw new Error(`no authority badge resolved for Obligation ${fromState} -> ${input.targetState} — Transition Definition declares no verb`);
  const { authorId } = await resolveAuthor(obligation.seu_id, input.actorId);
  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Obligation",
    entityId: obligation.id,
    seuId: obligation.seu_id,
    fromState,
    toState: input.targetState,
    authorId,
    authorBadge: gate.authorityBadge,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const { data: updated, error } = await obligationsDB.updateStatus(obligation.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update obligation status");

  const correlationId = eventBus.newCorrelationId();
  if (gate.eventType) {
    await eventBus.publish({
      eventType: gate.eventType,
      originatingObjectType: "Obligation",
      originatingObjectId: obligation.id,
      seuId: obligation.seu_id,
      correlationId,
      payload: { fromState, toState: input.targetState },
      actorId: input.actorId ?? null,
      authorityBadge: gate.authorityBadge,
    });
  }
  await eventBus.publish({
    eventType: "ObligationTransitioned",
    originatingObjectType: "Obligation",
    originatingObjectId: obligation.id,
    seuId: obligation.seu_id,
    correlationId,
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, obligation: updated, appliedTransition: { fromState, toState: input.targetState } };
}
