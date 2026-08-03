import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { CapabilityRow, ObjectiveRow, ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";

// Ch.1 §7: Strategic decomposes into Operational decomposes into Engineering.
// A child's tier must not be "more strategic" than its parent's.
const TIER_RANK: Record<ObjectiveTier, number> = { Strategic: 0, Operational: 1, Engineering: 2 };

export async function createObjective(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  tier?: ObjectiveTier;
  status?: ObjectiveStatus;
  parentObjectiveId?: string | null;
  requestedBy?: number | null;
}): Promise<{ objective: ObjectiveRow; requiredCapabilities: CapabilityRow[] }> {
  const tier = input.tier ?? "Engineering";

  if (input.parentObjectiveId) {
    const { data: parent } = await objectivesDB.findById(input.parentObjectiveId);
    if (!parent) throw new Error(`parent Objective not found: ${input.parentObjectiveId}`);
    if (TIER_RANK[tier] < TIER_RANK[parent.tier]) {
      throw new Error(`child Objective tier (${tier}) cannot be more strategic than its parent's tier (${parent.tier})`);
    }
  }

  const { data: objective, error } = await objectivesDB.create({
    statement: input.statement,
    tier,
    status: input.status,
    parentObjectiveId: input.parentObjectiveId,
    requestedBy: input.requestedBy,
  });
  if (error || !objective) throw error ?? new Error("failed to create objective");

  const { data: capabilities, error: capErr } = await capabilitiesDB.findByCodes(input.requiredCapabilityCodes);
  if (capErr) throw capErr;
  const found = capabilities ?? [];
  const foundCodes = new Set(found.map((c) => c.code));
  const missing = input.requiredCapabilityCodes.filter((code) => !foundCodes.has(code));
  if (missing.length > 0) {
    throw new Error(`unknown capability code(s): ${missing.join(", ")}`);
  }

  await objectivesDB.addCapabilities(objective.id, found.map((c) => c.id));
  return { objective, requiredCapabilities: found };
}

export interface ObjectiveListItem {
  id: string;
  statement: string;
  tier: ObjectiveTier;
  status: ObjectiveStatus;
  version: number;
  parentObjectiveId: string | null;
  createdAt: string;
}

function toListItem(o: ObjectiveRow): ObjectiveListItem {
  return { id: o.id, statement: o.statement, tier: o.tier, status: o.status, version: o.version, parentObjectiveId: o.parent_objective_id, createdAt: o.created_at };
}

export async function listObjectives(): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findAll();
  return (data ?? []).map(toListItem);
}

// Parent-picker and "commission from an existing Objective" both need this —
// only Objectives still capable of being decomposed under / commissioned
// against, not ones already Achieved/Superseded/Retired/Archived.
export async function listSelectableObjectives(): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findByStatuses(["Proposed", "Active"]);
  return (data ?? []).map(toListItem);
}

export interface ObjectiveDetailView {
  objective: ObjectiveRow;
  parent: ObjectiveListItem | null;
  children: ObjectiveListItem[];
  requiredCapabilities: CapabilityRow[];
  possibleNextStates: string[];
}

export async function getObjectiveDetail(id: string): Promise<ObjectiveDetailView | null> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) return null;

  const [{ data: children }, { data: requiredCapabilities }, { data: possibleNextStates }, parent] = await Promise.all([
    objectivesDB.findChildren(id),
    objectivesDB.getRequiredCapabilities(id),
    transitionDefinitionsDB.findPossibleNextStates("Objective", objective.status),
    objective.parent_objective_id ? objectivesDB.findById(objective.parent_objective_id).then((r) => r.data ?? null) : Promise.resolve(null),
  ]);

  return {
    objective,
    parent: parent ? toListItem(parent) : null,
    children: (children ?? []).map(toListItem),
    requiredCapabilities: requiredCapabilities ?? [],
    possibleNextStates: possibleNextStates ?? [],
  };
}

export async function updateObjective(id: string, input: { statement?: string; tier?: ObjectiveTier }): Promise<ObjectiveRow> {
  const { data, error } = await objectivesDB.update(id, input);
  if (error || !data) throw error ?? new Error("failed to update objective");
  return data;
}

export type TransitionObjectiveResult =
  | { ok: true; objective: ObjectiveRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function transitionObjective(input: { objectiveId: string; targetState: ObjectiveStatus; actorRole: string }): Promise<TransitionObjectiveResult> {
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  if (!objective) return { ok: false, reason: "not_found" };

  const fromState = objective.status;
  const gate = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    context: { objective },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Objective ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires role ${gate.requiredRole}, actor has ${gate.actorRole}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await objectivesDB.updateStatus(objective.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update objective status");

  await eventBus.publish({
    eventType: "ObjectiveTransitioned",
    originatingObjectType: "Objective",
    originatingObjectId: objective.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  return { ok: true, objective: updated, appliedTransition: { fromState, toState: input.targetState } };
}

// Stands in for Book 3's undefined "Capability Pack" derivation mechanism
// (Ch.1 §10 references it, Ch.5's own Pack taxonomy never defines it — a real
// spec gap, not an MVP shortcut of a working one; see Build Plan §5 item 1).
// Deliberately simple and transparent: word-overlap against each Capability's
// name/description, not an opaque model call. Suggestions are a starting
// checkbox state, never the sole mechanism — a human still confirms them.
export async function suggestCapabilityCodes(statement: string): Promise<string[]> {
  const { data: capabilities } = await capabilitiesDB.findAll();
  const text = statement.toLowerCase();
  const matches: string[] = [];
  for (const cap of capabilities ?? []) {
    const haystack = [cap.name, cap.description ?? ""].join(" ").toLowerCase();
    const terms = haystack.split(/\W+/).filter((w) => w.length > 3);
    if (terms.some((term) => text.includes(term))) matches.push(cap.code);
  }
  return matches;
}
