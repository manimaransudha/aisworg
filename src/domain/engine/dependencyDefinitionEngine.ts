// CR-039 — the unified evaluator over dependency_definitions' canonical
// (entity_type, name?, state) graph. Replaces dependencyEngine.ts's per-edge
// evaluation AND subsumes qualityGateEngine's Deliverable-facing
// no_unresolved_obligations / requires_accepted_evidence_or_approved_decision
// criteria (same fixed per-type cardinality those criteria already use —
// Obligation requires ALL attached instances resolved, Decision/Evidence/
// Knowledge require ANY one qualifying instance — not a new schema column).
//
// CR-043 — rules can be owned by a Template, a Pack, or a Profile, not just
// a Template. Every public method here takes a bare seuId and resolves the
// SEU's own full scope (its Template + every Pack composed into its active
// EBM + its Profile) internally via resolveOwningScope — callers never
// assemble or pass a scope themselves.
import { dependencyDefinitionsDB, type DependencyOwningScope } from "../../dblayer/dependencyDefinitionsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { knowledgeItemsDB } from "../../dblayer/knowledgeItemsDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "./eventBus.js";
import type { DependencyDefinitionEntityType, DependencyDefinitionRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

// The SEU's own full scope — its Template, every Pack actually composed into
// its active EBM (ebms.composed_packs, already real and stored), and its
// Profile. Returns null only if the SEU itself doesn't exist.
async function resolveOwningScope(seuId: string): Promise<DependencyOwningScope | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;
  const { data: ebm } = seu.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
  const packIds = (ebm?.composed_packs ?? []).map((p) => p.packId);
  return { templateId: seu.template_id, profileId: seu.profile_id, packIds };
}

// Same "has this state been reached or passed" BFS dependencyEngine.ts uses
// (ports the Phase-5 exact-equality bug fix forward) — generalised over any
// TransitionEntityType, not just Deliverable, since Decision/Obligation/
// Evidence/Knowledge all have their own real transition_definitions rows too.
async function isReachedOrPassed(entityType: TransitionEntityType, requiredState: string, currentState: string): Promise<boolean> {
  if (requiredState === currentState) return true;
  const visited = new Set<string>([requiredState]);
  let frontier = [requiredState];
  while (frontier.length > 0) {
    const results = await Promise.all(frontier.map((state) => transitionDefinitionsDB.findPossibleNextStates(entityType, state)));
    const nextStates = [...new Set(results.flatMap((r) => r.data ?? []))].filter((state) => !visited.has(state));
    if (nextStates.includes(currentState)) return true;
    for (const state of nextStates) visited.add(state);
    frontier = nextStates;
  }
  return false;
}

// Resolves a named node's own instance id + current state within one SEU.
// Only Deliverable and Capability carry names (CR-039's design: the only
// types with a stable, pre-declared, Template-catalogue identity). name
// matches deliverables.name / services.code directly — no separate code
// column, since Template seeding already sets deliverable.name from the
// catalogue's own seed.name 1:1 and Service.code is already a real unique
// column. This assumes catalogue names are unique per Template in practice
// (nothing enforces it in the schema) — dependency_edges never needed this
// assumption (it links by instance FK, created once at commissioning), so
// it's a genuinely new constraint this redesign introduces.
async function resolveNamedNode(seuId: string, entityType: DependencyDefinitionEntityType, name: string): Promise<{ instanceId: string; currentState: string } | null> {
  if (entityType === "Deliverable") {
    const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);
    const match = deliverables?.find((d) => d.name === name);
    return match ? { instanceId: match.id, currentState: match.lifecycle_state } : null;
  }
  if (entityType === "Capability") {
    const { data: services } = await servicesDB.findAll();
    const service = services?.find((s) => s.code === name);
    if (!service) return null;
    const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
    const match = seuCapabilities?.find((c) => c.capability_id === service.providing_capability_id);
    if (!match) return null;
    // Capability has no transition_definitions state machine — status is a
    // simple Requested/Assigned/Fulfilled enum (dependencyEngine.ts's existing
    // Capability branch), so "state" here is that status verbatim, not a
    // lifecycle state to BFS through.
    return { instanceId: match.id, currentState: match.status };
  }
  return null;
}

// Unnamed-node (Decision/Obligation/Evidence/Knowledge) satisfaction: "any
// instance of this type attached to the gated (to_*) instance, currently
// having reached-or-passed fromState" — except Obligation, which is ALL
// (mirrors qualityGateEngine's no_unresolved_obligations: one unresolved
// Obligation blocks, it isn't enough for some other Obligation to resolve).
async function isUnnamedNodeSatisfied(fromEntityType: DependencyDefinitionEntityType, fromState: string, gatedEntityType: TransitionEntityType, gatedInstanceId: string): Promise<boolean> {
  if (fromEntityType === "Obligation") {
    const { data: obligations } = await obligationsDB.findByRelatedObject(gatedEntityType, gatedInstanceId);
    if (!obligations || obligations.length === 0) return true;
    const results = await Promise.all(obligations.map((o) => isReachedOrPassed("Obligation", fromState, o.status)));
    return results.every(Boolean);
  }
  if (fromEntityType === "Decision") {
    const { data: decisions } = await decisionsDB.findByRelatedObject(gatedEntityType, gatedInstanceId);
    if (!decisions || decisions.length === 0) return false;
    const results = await Promise.all(decisions.map((d) => isReachedOrPassed("Decision", fromState, d.status)));
    return results.some(Boolean);
  }
  if (fromEntityType === "Evidence") {
    const { data: evidence } = await evidenceDB.findByRelatedObject(gatedEntityType, gatedInstanceId);
    if (!evidence || evidence.length === 0) return false;
    const results = await Promise.all(evidence.map((e) => isReachedOrPassed("Evidence", fromState, e.status)));
    return results.some(Boolean);
  }
  if (fromEntityType === "Knowledge") {
    // knowledge_items is deliverable_id-keyed, not the polymorphic
    // related_object_type/id pair Obligation/Evidence/Decision share — only
    // meaningful when the gated (to_*) type is itself Deliverable.
    if (gatedEntityType !== "Deliverable") return false;
    const { data: items } = await knowledgeItemsDB.findByDeliverableId(gatedInstanceId);
    if (!items || items.length === 0) return false;
    const results = await Promise.all(items.map((k) => isReachedOrPassed("Knowledge", fromState, k.status)));
    return results.some(Boolean);
  }
  // Unrecognised/unbuilt unnamed type (e.g. ExternalInteraction) fails
  // closed, same discipline transitionEngine/qualityGateEngine already use
  // for anything they don't recognise.
  return false;
}

async function isRowSatisfied(seuId: string, row: DependencyDefinitionRow): Promise<boolean> {
  if (row.from_name) {
    const from = await resolveNamedNode(seuId, row.from_entity_type, row.from_name);
    if (!from) return false;
    if (row.from_entity_type === "Capability") return from.currentState === row.from_state;
    return isReachedOrPassed(row.from_entity_type as TransitionEntityType, row.from_state, from.currentState);
  }
  // Unnamed FROM side always qualifies against the resolved TO instance
  // (the gated Deliverable) — resolve it first.
  const to = await resolveNamedNode(seuId, row.to_entity_type, row.to_name);
  if (!to) return false;
  return isUnnamedNodeSatisfied(row.from_entity_type, row.from_state, row.to_entity_type as TransitionEntityType, to.instanceId);
}

export const dependencyDefinitionEngine = {
  // Pull/gating check — "is (toEntityType, toName) ready to reach toState?" —
  // the direct generalisation of dependencyEngine.isDeliverableReady, called
  // before a governed transition is allowed to proceed. Gathers rules from
  // every scope relevant to this SEU (CR-043) — not just its Template.
  async isTargetReady(
    seuId: string,
    toEntityType: DependencyDefinitionEntityType,
    toName: string,
    toState: string
  ): Promise<{ ready: boolean; rows: DependencyDefinitionRow[] }> {
    const scope = await resolveOwningScope(seuId);
    if (!scope) return { ready: true, rows: [] };
    const { data: rows } = await dependencyDefinitionsDB.findByTarget(scope, toEntityType, toName, toState);
    if (!rows || rows.length === 0) return { ready: true, rows: [] };
    const results = await Promise.all(rows.map((row) => this.isRowSatisfied(seuId, row)));
    return { ready: results.every(Boolean), rows };
  },

  // Per-row satisfaction, exposed for display surfaces (the SEU detail page
  // shows each dependency's own status, not just the aggregate) — the same
  // check isTargetReady runs internally, one row at a time.
  isRowSatisfied,

  // Push evaluation — "this (entityType, name?, state) was just reached —
  // what does it unlock?" Called after any governed entity's transition
  // lands. Re-evaluates every canonical target this could feed, and
  // publishes DeliverableReady (Ch.9's aggregate name — CR-042 renamed this
  // from DependencySatisfied, which read as per-row when the logic below is
  // always aggregate-only) for whichever ones are now fully ready.
  async evaluateAndPublishFromTransition(input: {
    seuId: string;
    entityType: DependencyDefinitionEntityType;
    name: string | null;
    newState: string;
    correlationId?: string;
  }): Promise<void> {
    const scope = await resolveOwningScope(input.seuId);
    if (!scope) return;
    const { data: sourceRows } = await dependencyDefinitionsDB.findBySource(scope, input.entityType, input.name, input.newState);
    const targets = new Map<string, { toEntityType: DependencyDefinitionEntityType; toName: string; toState: string }>();
    for (const row of sourceRows ?? []) {
      targets.set(`${row.to_entity_type} ${row.to_name} ${row.to_state}`, { toEntityType: row.to_entity_type, toName: row.to_name, toState: row.to_state });
    }

    for (const target of targets.values()) {
      const { ready } = await this.isTargetReady(input.seuId, target.toEntityType, target.toName, target.toState);
      if (!ready) continue;
      const to = await resolveNamedNode(input.seuId, target.toEntityType, target.toName);
      if (!to) continue;
      await eventBus.publish({
        eventType: "DeliverableReady",
        originatingObjectType: target.toEntityType as TransitionEntityType,
        originatingObjectId: to.instanceId,
        correlationId: input.correlationId ?? eventBus.newCorrelationId(),
        causationId: input.correlationId ?? null,
        payload: { seuId: input.seuId, toEntityType: target.toEntityType, toName: target.toName, toState: target.toState },
      });
    }
  },
};
