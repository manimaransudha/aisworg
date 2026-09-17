// Ch.23 Obligation Model — Post-MVP Phase 4. Lifecycle transitions reuse the
// same generic transitionEngine SEU/Deliverable/Objective already use
// (Ch.29 §10), extended to a fourth entity type — Build Plan §2.2's "small
// core" split holds again: nothing here duplicates governance logic.
import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine, RESOLVED_OBLIGATION_STATUSES } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { raiseAttentionItem } from "./attentionItems.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import type { AttentionItemRow, ObligationRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// related_object_type/id are polymorphic (Open Design Questions.md #3) — an
// Obligation can now attach to any governed entity, not just a Deliverable.
// Ownership validation against the given SEU only runs for the one entity
// type this codebase actually has a lookup for today (Deliverable); other
// entity types are trusted as given, same explicit scope cut
// createExternalInteraction already made for its own optional deliverableId.
export async function createObligation(input: {
  seuId: string;
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
}): Promise<ObligationRow> {
  await assertCanonicalCategory("category:obligation", input.category);
  if (input.origin) await assertCanonicalCategory("category:obligation-origin", input.origin);
  if (input.priority) await assertCanonicalCategory("category:obligation-priority", input.priority);
  if (input.relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(input.relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.relatedObjectId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.relatedObjectId} does not belong to SEU ${input.seuId}`);
  }

  const { data: obligation, error } = await obligationsDB.create({
    seuId: input.seuId,
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

// CR-106 Option C — category:policy-condition-severity and
// category:obligation-severity share the same 4 literal values
// (Critical/High/Medium/Low), so a blocking Policy's own condition severity
// carries straight over as this Obligation's severity. category:obligation-
// priority's own vocabulary is a step removed (Very High/High/Medium/Low) —
// this is the one place mapping one onto the other, not a general rule.
const SEVERITY_TO_PRIORITY: Record<string, string> = { Critical: "Very High", High: "High", Medium: "Medium", Low: "Low" };

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
// one possible next state. A condition with none declared still raises
// exactly one, generic, so a block is never silently invisible.
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

  const fallbackTitle = `Policy "${policy.name}" must be satisfied before ${input.relatedObjectType} can move ${input.fromState} -> ${input.toState}`;
  const fallbackDescription = `Blocked by Policy "${policy.name}" (code: ${policy.code}) — its governing condition is not currently satisfied for this transition.`;

  const { data: existingForEntity } = await obligationsDB.findByRelatedObject(input.relatedObjectType, input.relatedObjectId);
  const stillOpenForThisTransition = (existingForEntity ?? []).filter(
    (o) => o.blocked_to_state === input.toState && o.blocked_from_state === input.fromState && !RESOLVED_OBLIGATION_STATUSES.has(o.status)
  );

  // At least one entry always — a condition with nothing declared still
  // raises exactly one generic Obligation, never zero.
  const entriesToRaise = declaredObligations.length > 0 ? declaredObligations : [null];

  const obligations: ObligationRow[] = [];
  const attentionItems: AttentionItemRow[] = [];
  for (const declared of entriesToRaise) {
    const title = declared?.title || fallbackTitle;
    const description = declared?.description || fallbackDescription;
    const existing = stillOpenForThisTransition.find((o) => o.title === title);

    const obligation =
      existing ??
      (await createObligation({
        seuId: input.seuId,
        relatedObjectType: input.relatedObjectType,
        relatedObjectId: input.relatedObjectId,
        category: declared?.category ?? "Compliance",
        title,
        description,
        severity: declared?.severity ?? policy.severity,
        origin: declared?.origin ?? "Policies",
        priority: declared?.priority ?? SEVERITY_TO_PRIORITY[policy.severity] ?? "Medium",
        completionCriteria:
          declared?.completionCriteria ||
          `Policy "${policy.name}"'s condition must evaluate true for this transition, or the Policy must be resolved/waived by an Authority holder.`,
        blockedFromState: input.fromState,
        blockedToState: input.toState,
      }));
    obligations.push(obligation);

    const { attentionItem } = await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      title: `${input.relatedObjectType} is blocked by Policy "${policy.name}"${declared?.title ? ` — ${declared.title}` : ""}`,
      description,
      relatedObjectType: input.relatedObjectType,
      relatedObjectId: input.relatedObjectId,
    });
    attentionItems.push(attentionItem);
  }

  return { obligations, attentionItems };
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

  await eventBus.publish({
    eventType: "ObligationTransitioned",
    originatingObjectType: "Obligation",
    originatingObjectId: obligation.id,
    seuId: obligation.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, obligation: updated, appliedTransition: { fromState, toState: input.targetState } };
}
