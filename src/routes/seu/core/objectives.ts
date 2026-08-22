import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { userDB } from "../../../dblayer/userDB.js";
import { findCandidateTemplates } from "./templates.js";
import { listRealProfilesForTemplate } from "./profiles.js";
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

  // CR-009: only Strategic may be parentless (the root). Operational/Engineering
  // must decompose from some parent — a clear, correctable error, and the DB
  // CHECK (migration 037) is the race-free backstop.
  if (tier !== "Strategic" && !input.parentObjectiveId) {
    throw new Error(`a ${tier} Objective requires a parent Objective (only Strategic may be a root)`);
  }

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

// CR-009: bare Engineering Objectives are no longer allowed — they must
// decompose from a parent. The one-shot "commission from a statement" path
// (commissionFromForm) has no natural parent, so it hangs its Engineering
// Objective under a single, reused Strategic container root (owner decision,
// 2026-08-13). Reused by sentinel statement, not minted per SEU.
export const ONE_SHOT_CONTAINER_STATEMENT = "Uncategorised — directly-commissioned SEUs";

export async function ensureOneShotContainer(requestedBy?: number | null): Promise<ObjectiveRow> {
  const { data: existing } = await objectivesDB.findStrategicByStatement(ONE_SHOT_CONTAINER_STATEMENT);
  if (existing) return existing;
  const { objective } = await createObjective({
    statement: ONE_SHOT_CONTAINER_STATEMENT,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Active",
    requestedBy,
  });
  return objective;
}

export interface ObjectiveListItem {
  id: string;
  statement: string;
  tier: ObjectiveTier;
  status: ObjectiveStatus;
  version: number;
  parentObjectiveId: string | null;
  createdAt: string;
  // CR-009: whether this node has children (drives the tree expand affordance)
  // and whether it is a leaf (no children) — a leaf that is not Strategic is the
  // finest-grained objective an SEU can serve.
  hasChildren: boolean;
  isLeaf: boolean;
  // CR-003/CR-009: whether an SEU is already commissioned against this
  // Objective, and whether it is eligible to commission one now — a non-Strategic
  // leaf, Active, not already assigned (supersedes CR-002's Engineering-only
  // rule). Drives the Objectives "Commission SEU" action.
  commissioned: boolean;
  commissionable: boolean;
  // CR-012: which removal action the node offers. `deletable` — a Proposed leaf
  // with no SEU (hard delete). `retirable` — an Active objective (governed
  // retire of it + its subtree). Mutually exclusive; a node may offer neither.
  deletable: boolean;
  retirable: boolean;
}

function toListItem(o: ObjectiveRow, opts: { commissioned?: boolean; hasChildren?: boolean } = {}): ObjectiveListItem {
  const commissioned = opts.commissioned ?? false;
  const hasChildren = opts.hasChildren ?? false;
  const isLeaf = !hasChildren;
  return {
    id: o.id,
    statement: o.statement,
    tier: o.tier,
    status: o.status,
    version: o.version,
    parentObjectiveId: o.parent_objective_id,
    createdAt: o.created_at,
    hasChildren,
    isLeaf,
    commissioned,
    commissionable: !commissioned && o.tier !== "Strategic" && isLeaf && o.status === "Active",
    deletable: o.status === "Proposed" && isLeaf && !commissioned,
    retirable: o.status === "Active",
  };
}

export async function listObjectives(): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findAll();
  const rows = data ?? [];
  const { data: committedIds } = await seusDB.commissionedObjectiveIds();
  const commissioned = new Set(committedIds ?? []);
  // Leaf detection in-memory: a node has children iff some other row names it as
  // parent. One pass over the full set, no extra query.
  const parentsWithChildren = new Set(rows.map((o) => o.parent_objective_id).filter((p): p is string => !!p));
  return rows.map((o) => toListItem(o, { commissioned: commissioned.has(o.id), hasChildren: parentsWithChildren.has(o.id) }));
}

// Parent-picker and "commission from an existing Objective" both need this —
// only Objectives still capable of being decomposed under / commissioned
// against, not ones already Achieved/Superseded/Retired/Archived.
export async function listSelectableObjectives(): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findByStatuses(["Proposed", "Active"]);
  return (data ?? []).map((o) => toListItem(o));
}

// Ebook Library — Full Demo Walkthrough.md, real finding #3, closed properly
// this time: findOrCreateDefaultProfile's own comment flagged "no UI to
// choose between multiple real Profiles for a Template if that ever
// happens" as a known gap — this is that UI's data. Computed only when the
// Objective is Active (the only state "Commission an SEU" is even offered),
// and only meaningful when a Template actually satisfies every required
// Capability — a null preview means the commission button, if shown at all,
// falls back to the no-choice-available path (0 or 1 real Profile).
export interface CommissioningPreview {
  templateId: string;
  templateCode: string;
  templateName: string;
  candidateProfiles: Array<{ id: string; code: string; name: string; environment: string }>;
}

export interface ObjectiveDetailView {
  objective: ObjectiveRow;
  parent: ObjectiveListItem | null;
  children: ObjectiveListItem[];
  // CR-009: a leaf (no children) that is not Strategic is the only thing an SEU
  // can be commissioned against — the detail page gates the action on this.
  isLeaf: boolean;
  // CR-012: same removal-action rule as the tree rows (deletable = Proposed
  // leaf; retirable = Active).
  deletable: boolean;
  retirable: boolean;
  requiredCapabilities: CapabilityRow[];
  possibleNextStates: string[];
  commissioningPreview: CommissioningPreview | null;
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

  const childRows = children ?? [];
  const isLeaf = childRows.length === 0;
  // How many grandchildren each direct child has — so the detail tree can show
  // an expand affordance and each child's own commissionable state.
  const { data: childChildCounts } = await objectivesDB.childCounts(childRows.map((c) => c.id));

  let commissioningPreview: CommissioningPreview | null = null;
  // CR-009: commissionable only if a non-Strategic leaf (and Active).
  if (objective.status === "Active" && objective.tier !== "Strategic" && isLeaf) {
    // Objectives have no tenant_id column of their own, but requested_by
    // (owner, 2026-08-19: "they are tied to a user that is tied to a
    // tenant") resolves one — the requester's own tenant, same as any other
    // acting-user tenant lookup. Falls back to Platform-only (no tenant) for
    // a null/system-created requested_by, same conservative default
    // findCandidateTemplates itself already applies when given none.
    const requester = objective.requested_by != null ? await userDB.findById(objective.requested_by) : null;
    const candidates = await findCandidateTemplates((requiredCapabilities ?? []).map((c) => c.code), requester?.tenant_id ?? null);
    const template = candidates.find((c) => c.satisfies);
    if (template) {
      const realProfiles = await listRealProfilesForTemplate(template.id);
      commissioningPreview = {
        templateId: template.id,
        templateCode: template.code,
        templateName: template.name,
        candidateProfiles: realProfiles.map((p) => ({ id: p.id, code: p.code, name: p.name, environment: p.environment })),
      };
    }
  }

  return {
    objective,
    parent: parent ? toListItem(parent) : null,
    children: childRows.map((c) => toListItem(c, { hasChildren: (childChildCounts?.get(c.id) ?? 0) > 0 })),
    isLeaf,
    // Proposed implies no SEU (commissioning requires Active), so a Proposed leaf
    // is deletable; an Active Objective is retirable (node + subtree).
    deletable: objective.status === "Proposed" && isLeaf,
    retirable: objective.status === "Active",
    requiredCapabilities: requiredCapabilities ?? [],
    possibleNextStates: possibleNextStates ?? [],
    commissioningPreview,
  };
}

export async function updateObjective(id: string, input: { statement?: string; tier?: ObjectiveTier }): Promise<ObjectiveRow> {
  // CR-009: a tier change is allowed only while every tree invariant still holds
  // afterwards. Validate against the node's actual parent and children before
  // writing (the DB CHECK backstops the parent-required rule, not the rank ones).
  if (input.tier) {
    const { data: node } = await objectivesDB.findById(id);
    if (!node) throw new Error(`Objective not found: ${id}`);
    const newTier = input.tier;

    if (newTier !== "Strategic" && !node.parent_objective_id) {
      throw new Error(`cannot change a root Objective to ${newTier}: only Strategic may be parentless (give it a parent first)`);
    }
    if (newTier === "Strategic" && node.parent_objective_id) {
      throw new Error(`a Strategic Objective is a root: detach it from its parent (move it) before making it Strategic`);
    }
    if (node.parent_objective_id) {
      const { data: parent } = await objectivesDB.findById(node.parent_objective_id);
      if (parent && TIER_RANK[newTier] < TIER_RANK[parent.tier]) {
        throw new Error(`cannot change tier to ${newTier}: it would be more strategic than its parent (${parent.tier})`);
      }
    }
    const { data: children } = await objectivesDB.findChildren(id);
    const violating = (children ?? []).find((c) => TIER_RANK[c.tier] < TIER_RANK[newTier]);
    if (violating) {
      throw new Error(`cannot change tier to ${newTier}: child "${violating.statement.slice(0, 40)}" (${violating.tier}) would be more strategic than its parent`);
    }
  }

  const { data, error } = await objectivesDB.update(id, input);
  if (error || !data) throw error ?? new Error("failed to update objective");
  return data;
}

// CR-009 re-parenting — move a node (and, implicitly, its whole subtree, which
// already points at it) under a new parent. Guards: no cycles (can't move under
// self or a descendant), the rank rule (new parent not more strategic than the
// moved node), and parent-required for non-Strategic tiers.
export async function reParentObjective(id: string, newParentId: string | null): Promise<ObjectiveRow> {
  const { data: node } = await objectivesDB.findById(id);
  if (!node) throw new Error(`Objective not found: ${id}`);

  if (node.tier !== "Strategic" && !newParentId) {
    throw new Error(`a ${node.tier} Objective requires a parent (only Strategic may be a root)`);
  }
  if (node.tier === "Strategic" && newParentId) {
    throw new Error(`a Strategic Objective is a root and cannot be given a parent`);
  }

  if (newParentId) {
    if (newParentId === id) throw new Error("an Objective cannot be its own parent");
    const { data: parent } = await objectivesDB.findById(newParentId);
    if (!parent) throw new Error(`parent Objective not found: ${newParentId}`);
    if (TIER_RANK[node.tier] < TIER_RANK[parent.tier]) {
      throw new Error(`Objective tier (${node.tier}) cannot be more strategic than its new parent's tier (${parent.tier})`);
    }
    const { data: descendantIds } = await objectivesDB.findDescendantIds(id);
    if ((descendantIds ?? []).includes(newParentId)) {
      throw new Error("cannot move an Objective under one of its own descendants (would create a cycle)");
    }
  }

  const { data, error } = await objectivesDB.updateParent(id, newParentId ?? null);
  if (error || !data) throw error ?? new Error("failed to move objective");
  return data;
}

// CR-012 — hard delete, allowed only for a **Proposed leaf**. A parent (has
// children) is never deletable; an Active/terminal Objective is retired, not
// deleted. A Proposed Objective structurally has no SEU (commissioning needs
// Active), but we assert it anyway. Removes the row + its Capability links only.
export async function deleteObjective(id: string): Promise<void> {
  const { data: node } = await objectivesDB.findById(id);
  if (!node) throw new Error(`Objective not found: ${id}`);
  if (node.status !== "Proposed") {
    throw new Error(`only a Proposed Objective can be deleted (status: ${node.status}) — retire it instead`);
  }
  const { data: children } = await objectivesDB.findChildren(id);
  if ((children ?? []).length > 0) {
    throw new Error(`cannot delete an Objective that has children — delete its children first`);
  }
  const { data: existingSeu } = await seusDB.findByObjectiveId(id);
  if (existingSeu) {
    throw new Error(`cannot delete an Objective with a commissioned SEU (${existingSeu.id})`);
  }
  const { error } = await objectivesDB.delete(id);
  if (error) throw error;
}

// CR-012 — governed retire of an Active Objective **and its subtree**. Each
// currently-Active node (the target + every Active descendant) transitions
// Active→Retired via transitionObjective (the `objective_retire` badge; history
// + SEUs preserved). Descendants that are not Active have no →Retired edge and
// are skipped and reported, not force-changed. A denial on the target itself
// (e.g. missing badge) is thrown so the caller can surface it.
export async function retireObjectiveSubtree(input: { objectiveId: string; actorRole: string; actorId?: string }): Promise<{ retired: string[]; skipped: Array<{ id: string; status: ObjectiveStatus }> }> {
  const { data: node } = await objectivesDB.findById(input.objectiveId);
  if (!node) throw new Error(`Objective not found: ${input.objectiveId}`);
  if (node.status !== "Active") {
    throw new Error(`only an Active Objective can be retired (status: ${node.status})`);
  }

  const rootResult = await transitionObjective({ objectiveId: node.id, targetState: "Retired", actorRole: input.actorRole, actorId: input.actorId });
  if (!rootResult.ok) {
    const detail = "detail" in rootResult ? rootResult.detail : rootResult.reason;
    throw new Error(`retire blocked: ${detail}`);
  }

  const retired: string[] = [node.id];
  const skipped: Array<{ id: string; status: ObjectiveStatus }> = [];
  const { data: descendantIds } = await objectivesDB.findDescendantIds(input.objectiveId);
  for (const descId of descendantIds ?? []) {
    const { data: desc } = await objectivesDB.findById(descId);
    if (!desc) continue;
    if (desc.status !== "Active") {
      skipped.push({ id: descId, status: desc.status });
      continue;
    }
    const res = await transitionObjective({ objectiveId: descId, targetState: "Retired", actorRole: input.actorRole, actorId: input.actorId });
    if (res.ok) retired.push(descId);
    else skipped.push({ id: descId, status: desc.status });
  }
  return { retired, skipped };
}

// CR-009 re-parenting — valid new parents for `movingId`: any Objective that
// is not the node itself, not a descendant, and not more strategic than it
// (Proposed/Active only). Feeds the move parent-picker.
export async function listReParentCandidates(movingId: string): Promise<ObjectiveListItem[]> {
  const { data: node } = await objectivesDB.findById(movingId);
  if (!node) return [];
  if (node.tier === "Strategic") return []; // a root has no parent to pick
  const [{ data: selectable }, { data: descendantIds }] = await Promise.all([
    objectivesDB.findByStatuses(["Proposed", "Active"]),
    objectivesDB.findDescendantIds(movingId),
  ]);
  const blocked = new Set([movingId, ...(descendantIds ?? [])]);
  return (selectable ?? [])
    .filter((o) => !blocked.has(o.id) && TIER_RANK[node.tier] >= TIER_RANK[o.tier])
    .map((o) => toListItem(o));
}

// CR-009 tree — one server-side page of Strategic roots, each annotated with
// whether it has children (the expand affordance) and its commissioned state.
export async function getObjectiveRootsPage(opts: { limit: number; offset: number }): Promise<{ items: ObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRootsPage(opts);
  const rows = data?.items ?? [];
  const [{ data: counts }, { data: committedIds }] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    seusDB.commissionedObjectiveIds(),
  ]);
  const commissioned = new Set(committedIds ?? []);
  return {
    items: rows.map((o) => toListItem(o, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissioned: commissioned.has(o.id) })),
    total: data?.total ?? 0,
  };
}

// CR-009 tree — the direct children of a node (lazy-loaded on expand), each
// annotated the same way so the row renders its own expand/commission state.
export async function getObjectiveChildren(parentId: string): Promise<ObjectiveListItem[]> {
  const { data: children } = await objectivesDB.findChildren(parentId);
  const rows = children ?? [];
  const [{ data: counts }, { data: committedIds }] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    seusDB.commissionedObjectiveIds(),
  ]);
  const commissioned = new Set(committedIds ?? []);
  return rows.map((o) => toListItem(o, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissioned: commissioned.has(o.id) }));
}

export interface ObjectiveSearchHit extends ObjectiveListItem {
  // root→node breadcrumb (statements), so a flat hit is legible in the tree's
  // absence. Empty for a root.
  path: Array<{ id: string; statement: string; tier: ObjectiveTier }>;
}

// CR-009 search mode — flat statement search across all tiers, each hit carrying
// its ancestor path for context. Filtered/sorted/paged in-memory by the caller.
export async function searchObjectives(): Promise<ObjectiveSearchHit[]> {
  const { data } = await objectivesDB.findAll();
  const rows = data ?? [];
  const { data: committedIds } = await seusDB.commissionedObjectiveIds();
  const commissioned = new Set(committedIds ?? []);
  const parentsWithChildren = new Set(rows.map((o) => o.parent_objective_id).filter((p): p is string => !!p));
  const byId = new Map(rows.map((o) => [o.id, o]));
  return rows.map((o) => {
    const path: ObjectiveSearchHit["path"] = [];
    let cursor = o.parent_objective_id;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const p = byId.get(cursor);
      if (!p) break;
      path.unshift({ id: p.id, statement: p.statement, tier: p.tier });
      cursor = p.parent_objective_id;
    }
    return {
      ...toListItem(o, { commissioned: commissioned.has(o.id), hasChildren: parentsWithChildren.has(o.id) }),
      path,
    };
  });
}

export type TransitionObjectiveResult =
  | { ok: true; objective: ObjectiveRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  // Structurally unreachable today (Objective has no seu_id — see the doc
  // comment below), but transitionEngine.evaluate's return type now includes
  // this reason unconditionally (SDK UI Layer Plan), so it's handled here
  // for type-correctness even though nothing can currently produce it.
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

// Post-completion fix (Open Design Questions.md #3): every other SEU-scoped
// entity type now runs its transition through qualityGateEngine.evaluate
// first, same as transitionDeliverable always has. Objective deliberately
// does not — it has no seu_id (an Objective can precede, or outlive, any
// number of SEUs commissioned against it), and quality_gate_evaluations.seu_id
// is NOT NULL, so there is nowhere to record an evaluation against. Logged
// as a real, structural limitation, not silently skipped.
export async function transitionObjective(input: { objectiveId: string; targetState: ObjectiveStatus; actorRole: string; actorId?: string }): Promise<TransitionObjectiveResult> {
  const { data: objective } = await objectivesDB.findById(input.objectiveId);
  if (!objective) return { ok: false, reason: "not_found" };

  const fromState = objective.status;
  const gate = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    context: { objective },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Objective ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await objectivesDB.updateStatus(objective.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update objective status");

  await eventBus.publish({
    eventType: "ObjectiveTransitioned",
    originatingObjectType: "Objective",
    originatingObjectId: objective.id,
    seuId: null, // an Objective has no single owning SEU (zero-or-many, not stored on ObjectiveRow)
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
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
