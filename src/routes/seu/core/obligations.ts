// Ch.23 Obligation Model — Post-MVP Phase 4. Lifecycle transitions reuse the
// same generic transitionEngine SEU/Deliverable/Objective already use
// (Ch.29 §10), extended to a fourth entity type — Build Plan §2.2's "small
// core" split holds again: nothing here duplicates governance logic.
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
import { raiseAttentionItem } from "./attentionItems.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import type { AttentionItemRow, ObligationDefinition, ObligationRow, PolicyApplicabilityDeliverable, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// related_object_type/id are polymorphic (Open Design Questions.md #3) — an
// Obligation can now attach to any governed entity, not just a Deliverable.
// seuId is not a caller-given input at all — it's derived from
// relatedObjectType/relatedObjectId, the one thing every real caller already
// has and which is always genuinely SEU-scoped (an Obligation "about"
// something that isn't SEU-scoped, e.g. a Pack or Objective directly,
// doesn't make sense in this platform's own model). This also closes the
// class of bug the old explicit seuId param allowed — a caller passing a
// seuId that didn't match its own relatedObjectId — since there's no longer
// a second value to mismatch against.
async function resolveSeuIdFromRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<string> {
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
  // Migration 226 (CR-106) — Ch.23 §8's Origin/Priority/Completion Criteria,
  // closing the execution-side gap the Definition-side ObligationDefinition
  // shape already had. Optional so every existing caller stays unaffected.
  origin?: string | null;
  priority?: string | null;
  completionCriteria?: string | null;
  // Set only by raiseObligationForBlockedTransition, below.
  blockedFromState?: string | null;
  blockedToState?: string | null;
  // Migration 251 — which specific entity raised this Obligation (a real
  // pointer, unlike origin's own categorical label) and who/what it's
  // currently assigned to for resolution. originatingEntity defaults to
  // ("EBM", this SEU's own active_ebm_id) when the caller doesn't know a
  // more specific one — every Obligation traces back to at least the EBM it
  // was raised under.
  originatingEntityType?: string | null;
  originatingEntityId?: string | null;
  assignedEntityType?: string | null;
  assignedEntityId?: string | null;
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
  });
  if (error || !obligation) throw error ?? new Error("failed to create obligation");

  await eventBus.publish({
    eventType: "ObligationCreated",
    originatingObjectType: "Obligation",
    originatingObjectId: obligation.id,
    seuId: obligation.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category, severity: obligation.severity },
  });

  return obligation;
}

// packs.ts's own materialization fans one Policy Definition out into
// multiple `policies` rows whenever it has more than one condition, or one
// condition maps to more than one transition — each fanned row's code is
// rewritten to `${policyCode}::${condIndex}::${governedTransition}::${deliverableName}`
// (packs.ts, "a fanned-out row's own code is suffixed by its condition
// index and transition") so they don't collide under Policy's own
// (originating_pack_id, code) identity. Recovers the plain author code (for
// looking the Definition back up) and the real condition index (for picking
// the exact condition that produced THIS materialized row) — an unfanned
// Policy (single condition, single transition) never gets a suffix, so
// splitting a code with none of these is a no-op returning index 0.
function parseMaterializedPolicyCode(materializedCode: string): { plainCode: string; conditionIndex: number } {
  const [plainCode, conditionIndexRaw] = materializedCode.split("::");
  const conditionIndex = conditionIndexRaw !== undefined ? Number(conditionIndexRaw) : 0;
  return { plainCode, conditionIndex: Number.isFinite(conditionIndex) ? conditionIndex : 0 };
}

// CR-106 Option C, step 1/2 — called from a governed-transition call site
// (commissioning.ts's SEU-scoped commence-work check, deliverables.ts's
// Policy block) the moment policyEngine.evaluate reports outcome: "Blocked",
// instead of that call site hard-failing the entity. Raises a real
// Obligation per entry in the blocking condition's own declared
// relatedObligations[] (Ch.23 §8's content — a condition can declare
// several, all of them relevant the moment it fails, not just one) plus a
// matching Attention Item each (mirroring the existing blocked-Quality-Gate
// precedent, deliverables.ts), and records exactly which transition is
// blocked (blocked_from_state/blocked_to_state) on every one so
// executionEngineKickoff (domain/engine/executionEngineKickoff.ts) knows
// precisely what to re-attempt once they reach Verified/Closed/Archived — never
// re-derived from the entity's own current state, which can have more than
// one possible next state. A condition with nothing declared raises no
// Obligation at all — the blocked transition is already visible via its own
// failure (policy_blocked), and nothing is fabricated on the Policy's behalf.
// Idempotent per declared obligation (matched by blocked transition + title,
// there being no other stable identity to dedupe on): a second call for the
// same still-open block returns the existing rows rather than duplicating.
export async function raiseObligationForBlockedTransition(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  fromState: string;
  toState: string;
  policyCode: string;
}): Promise<{ obligations: ObligationRow[]; attentionItems: AttentionItemRow[] }> {
  const { data: policy } = await policiesDB.findByCode(input.policyCode);
  if (!policy) throw new Error(`policy "${input.policyCode}" not found while raising a blocked-transition Obligation`);

  const { plainCode, conditionIndex } = parseMaterializedPolicyCode(policy.code);
  const { data: definition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(plainCode, PLATFORM_TENANT_ID);
  const condition = definition?.conditions?.[conditionIndex];
  const declaredObligations = condition?.relatedObligations ?? [];

  const { data: existingForEntity } = await obligationsDB.findByRelatedObject(input.relatedObjectType, input.relatedObjectId);
  const stillOpenForThisTransition = (existingForEntity ?? []).filter(
    (o) => o.blocked_to_state === input.toState && o.blocked_from_state === input.fromState && !RESOLVED_OBLIGATION_STATUSES.has(o.status)
  );

  // Owner: "Why raise an obligation when a policy has none?" — a blocked
  // transition is already visible via its own failure (policy_blocked,
  // surfaced to the caller); a Policy that never declared what to raise
  // gets nothing fabricated on its behalf. Every field below reads straight
  // off the Definition's own declared ObligationDefinition — no fallback —
  // since ObligationDefinition's own type already requires all of them.
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
      }));
    obligations.push(obligation);

    const { attentionItem } = await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      title: `${input.relatedObjectType} is blocked by Policy "${policy.name}" — ${declared.title}`,
      description: declared.description,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
    });
    attentionItems.push(attentionItem);
  }

  return { obligations, attentionItems };
}

// Migration 249/250 (owner: "look at the SEUActivated -> SEUOperational
// event handler. This is where the Policy obligations are instantiated...
// This should have a step to do the same for the pack obligations", then:
// "In Policy, governing condition is defined as a structure. I do not see
// this in the Pack obligation definition. Did I not say this has to
// resemble the policy") — a Pack's own standalone
// contributionObligationDefinitions[] is composed onto the EBM's
// behaviors.pool (`obligationDefinition::<code>` entries,
// profileCompositionUnravel.ts) but nothing ever reads that pool to raise a
// real Obligation from it (CR-108 line 35). Deliberately generic over the
// governed transition, mirroring raiseObligationForBlockedTransition above,
// not a separate function per call site.
//
// `governingCondition` is evaluated the same real evaluateCondition every
// other governed mechanism reuses (Policy/Quality Gate), but its true/false
// meaning is inverted from Policy's own use of it: Policy's condition is a
// GATE (true = satisfied = transition allowed, false = blocked); this row's
// condition is a TRIGGER (true = this situation applies = raise the
// Obligation, false = doesn't apply right now = skip). That inversion is
// required for backward compatibility, not a free choice: `{type:
// "always_true"}` is the default when a row declares no condition at all
// (same default packs.ts's own Policy materialization already uses), and a
// bare applicabilityDeliverables match with no condition authored must keep
// unconditionally raising, exactly as migration 249 already shipped and was
// verified against — so "no condition" has to keep evaluating to "raise."
export async function raiseObligationsForPackDefinitions(input: {
  seuId: string;
  ebmId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  fromState: string;
  toState: string;
  context?: Record<string, unknown>;
}): Promise<{ obligations: ObligationRow[]; attentionItems: AttentionItemRow[] }> {
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

  // Owner: "it has to be treated the same way as a policy obligation" — a
  // Policy's own live condition can be re-evaluated fresh every retry (its
  // row can be republished to now pass), so once satisfied it simply stops
  // reporting Blocked; the Obligation is just bookkeeping either way. A Pack
  // Obligation Definition's own condition has no such live signal (frozen
  // into the EBM pool at commissioning, evaluated against an always-empty
  // context) — so the ONLY durable memory of "this exact hop was already
  // satisfied" is a prior Obligation for it having reached a resolved
  // status. Matched on ALL Obligations for this entity, not just still-open
  // ones: a resolved match means this definition's own requirement is
  // satisfied for good, and must neither block again nor spawn a fresh
  // duplicate the way excluding it from the match would.
  const { data: existingForEntity } = await obligationsDB.findByRelatedObject(input.relatedObjectType, input.relatedObjectId);
  const existingForThisTransition = (existingForEntity ?? []).filter(
    (o) => o.blocked_to_state === input.toState && o.blocked_from_state === input.fromState
  );

  const obligations: ObligationRow[] = [];
  const attentionItems: AttentionItemRow[] = [];
  for (const { def, packId } of definitions) {
    const title = def.title || `Obligation "${def.code}" must be resolved before ${input.relatedObjectType} can move ${input.fromState} -> ${input.toState}`;
    const existing = existingForThisTransition.find((o) => o.title === title);
    if (existing && RESOLVED_OBLIGATION_STATUSES.has(existing.status)) continue; // already satisfied — never re-raise, never block

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
      }));
    obligations.push(obligation);

    const { attentionItem } = await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      title: `${input.relatedObjectType} is blocked by Obligation "${def.code}"`,
      description: def.description,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
    });
    attentionItems.push(attentionItem);
  }

  return { obligations, attentionItems };
}

// Migration 252 (owner: "Unless a transition is made explicitly, any number
// of revisions can happen on the record" — the standard Revision-vs-Version
// split, applied here explicitly for the first time on Obligation). A
// Revision never touches status/the version-significant `version` counter
// and publishes no event — those are exactly what makes it a Revision, not a
// Version. Diffs against the current row so revision_history keeps the old
// value of every field actually changed, not the ones left alone (owner:
// "how will I know what the old value was").
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
  actorId?: string;
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

export async function transitionObligation(input: { obligationId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionObligationResult> {
  const { data: obligation } = await obligationsDB.findById(input.obligationId);
  if (!obligation) return { ok: false, reason: "not_found" };

  const fromState = obligation.status;

  // Post-completion fix (Open Design Questions.md #3): Quality Gates used to
  // apply to Deliverable transitions only, even though quality_gates.entity_type
  // was never actually restricted to it — same check transitionDeliverable
  // has always run, now generalised to every SEU-scoped entity type.
  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Obligation",
    entityId: obligation.id,
    seuId: obligation.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

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

  const { data: updated, error } = await obligationsDB.updateStatus(obligation.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update obligation status");

  // Version Feature Plan.md §3 — gate.eventType is the specific, named event
  // this hop produces (e.g. ObligationAssigned), read straight off the
  // resolved transition_definitions row. Chapter 23 §15 names 8 events that
  // don't map 1:1 onto the 7 real state-machine hops; ObligationTransitioned
  // (generic, fromState/toState payload) is not one of them, but the owner
  // asked for it to keep publishing on every hop regardless — so both
  // publish here, never one instead of the other. Nothing follows either
  // publish call (event-publish-is-terminal convention).
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
