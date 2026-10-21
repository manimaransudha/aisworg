import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { transitionEntity } from "../../../domain/engine/entityTransition.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { OBJECTIVE_REJECT_STATE, OBJECTIVE_SUPERSEDED_STATE } from "../../../dblayer/constants.js";
import { findCandidateTemplates } from "./templates.js";
import { listRealProfilesForTemplate } from "./profiles.js";
import { listConceptsForType, resolveLabels } from "./ontology.js";
import type { ObjectiveRow, ObjectiveStatus, ObjectiveTier, RequiredCapability } from "../../../dblayer/seuTypes.js";

const TIER_RANK: Record<ObjectiveTier, number> = { Strategic: 0, Operational: 1, Engineering: 2 };

// The state an Objective is born into comes from its birth Transition Definition, never from a literal.
export async function objectiveInitialState(): Promise<ObjectiveStatus> {
  const { data: birth, error } = await transitionDefinitionsDB.findBirth("Objective");
  if (error) throw error;
  if (!birth) throw new Error("no birth Transition Definition for Objective");
  return birth.to_state as ObjectiveStatus;
}

async function decomposableParentStatuses(): Promise<ObjectiveStatus[]> {
  return [await objectiveInitialState(), "Active"];
}

async function resolveRequiredCapabilities(codes: string[]): Promise<RequiredCapability[]> {
  const uniqueCodes = [...new Set(codes)];
  const concepts = await listConceptsForType("capability-name", { isRoot: false, tenantId: null }, false);
  const byCode = new Map(concepts.map((c) => [c.code, c]));
  const missing = uniqueCodes.filter((code) => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(`unknown capability code(s): ${missing.join(", ")}`);
  }
  return uniqueCodes.map((code) => {
    const concept = byCode.get(code)!;
    return { code, name: concept.default_label, description: concept.description ?? null };
  });
}

// The creation authority of an Objective is the badge of its birth row.
async function resolveBirthAuthor(requestedBy: string): Promise<{ authorId: string; birth: Awaited<ReturnType<typeof transitionEngine.beginBirth>> }> {
  const { data: master } = await participantsMasterDB.findById(requestedBy);
  if (!master) throw new Error(`No superuser provisioned.`);
  const birth = await transitionEngine.beginBirth({ entityType: "Objective", actorId: String(requestedBy) });
  return { authorId: master.id, birth };
}

export async function createObjective(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  tier?: ObjectiveTier;
  parentObjectiveId?: string | null;
  requestedBy: string;
  skipParentValidation?: boolean;
}): Promise<{ objective: ObjectiveRow; requiredCapabilities: RequiredCapability[] }> {
  const tier = input.tier ?? "Engineering";

  if (tier !== "Strategic" && !input.parentObjectiveId) {
    throw new Error(`a ${tier} Objective requires a parent Objective (only Strategic may be a root)`);
  }

  if (input.requestedBy == null) {
    throw new Error("an Objective must be attributed to a real requesting user (requestedBy) — this can never be null");
  }

  if (input.parentObjectiveId) {
    const { data: parent } = await objectivesDB.findById(input.parentObjectiveId);
    if (!parent) throw new Error(`parent Objective not found: ${input.parentObjectiveId}`);
    if (TIER_RANK[tier] < TIER_RANK[parent.tier]) {
      throw new Error(`child Objective tier (${tier}) cannot be more strategic than its parent's tier (${parent.tier})`);
    }

    const decomposable = await decomposableParentStatuses();
    if (!input.skipParentValidation && !decomposable.includes(parent.status)) {
      throw new Error(`parent Objective is not ${decomposable.join(" or ")} (status: ${parent.status}) — adding children is only allowed while it is still ${decomposable.join(" or ")}`);
    }

  }

  const { authorId, birth } = await resolveBirthAuthor(input.requestedBy);

  const { data: objective, error } = await objectivesDB.create({
    statement: input.statement,
    tier,
    status: birth.initialState as ObjectiveStatus,
    parentObjectiveId: input.parentObjectiveId,
    requestedBy: input.requestedBy,
    authorId,
    authorBadge: birth.authorityBadge,
  });
  if (error || !objective) throw error ?? new Error("failed to create objective");

  const requiredCapabilities = await resolveRequiredCapabilities(input.requiredCapabilityCodes);
  if (requiredCapabilities.length > 0) {
    await objectivesDB.addCapabilities(objective.id, requiredCapabilities.map((c) => c.code), authorId, birth.authorityBadge);
  }

  await eventBus.publish({
    eventType: birth.eventType,
    originatingObjectType: "Objective",
    originatingObjectId: objective.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { tier, parentObjectiveId: input.parentObjectiveId ?? null },
    actorId: input.requestedBy,
    authorityBadge: birth.authorityBadge,
    versionEvent: birth.versionEvent,
    tenantId: objective.sponsoring_authority?.tenant ?? null,
  });
  return { objective, requiredCapabilities };
}

export const ONE_SHOT_CONTAINER_STATEMENT = "Uncategorised — directly-commissioned SEUs";

export async function ensureOneShotContainer(requestedBy:string): Promise<ObjectiveRow> {
  const { data: existing } = await objectivesDB.findStrategicByStatement(ONE_SHOT_CONTAINER_STATEMENT);
  const objective = existing ?? (await createObjective({
    statement: ONE_SHOT_CONTAINER_STATEMENT,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    requestedBy,
  })).objective;
  if (objective.status === "Active") return objective;
  const moved = await transitionEntity({ entityType: "Objective", entityId: objective.id, targetState: "Active", actorId: requestedBy });
  if (!moved.ok) throw new Error(`ensureOneShotContainer: ${"detail" in moved ? moved.detail : moved.reason}`);
  return moved.row as ObjectiveRow;
}

export interface ObjectiveListItem {
  id: string;
  displayId: string | null;
  statement: string;
  tier: ObjectiveTier;
  status: ObjectiveStatus;
  version: string;
  parentObjectiveId: string | null;
  createdAt: string;
  hasChildren: boolean;
  isLeaf: boolean;
  commissioned: boolean;
  commissionedSeuId: string | null;
  commissionable: boolean;
  deletable: boolean;
  nextTransitionVerb: string | null;
  nextTransitionToState: string | null;
  supersedingObjectiveId: string | null;
}

function toListItem(
  o: ObjectiveRow,
  initialState: string,
  opts: {
    commissionedSeuId?: string | null;
    hasChildren?: boolean;
    nextTransitionVerb?: string | null;
    nextTransitionToState?: string | null;
  } = {}
): ObjectiveListItem {
  const commissionedSeuId = opts.commissionedSeuId ?? null;
  const commissioned = commissionedSeuId !== null;
  const hasChildren = opts.hasChildren ?? false;
  const isLeaf = !hasChildren;
  return {
    id: o.id,
    displayId: o.display_id,
    statement: o.statement,
    tier: o.tier,
    status: o.status,
    version: o.version,
    parentObjectiveId: o.parent_objective_id,
    createdAt: o.created_at,
    hasChildren,
    isLeaf,
    commissioned,
    commissionedSeuId,
    commissionable: !commissioned && o.tier !== "Strategic" && isLeaf && o.status === "Active",
    deletable: o.status === initialState && isLeaf && !commissioned,
    nextTransitionVerb: opts.nextTransitionVerb ?? null,
    nextTransitionToState: opts.nextTransitionToState ?? null,
    supersedingObjectiveId: o.superseding_objective_id,
  };
}

// The quick transition on a list row: the one manual hop out of the initial state.
async function computeNextTransition(rows: ObjectiveRow[], initialState: string): Promise<Map<string, { nextTransitionVerb: string | null; nextTransitionToState: string | null }>> {
  const result = new Map<string, { nextTransitionVerb: string | null; nextTransitionToState: string | null }>();
  if (!rows.some((o) => o.status === initialState)) return result;
  const { data: transitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Objective", initialState);
  const manual = (transitions ?? []).filter((t) => t.trigger === "manual");
  if (manual.length !== 1) return result;
  for (const o of rows) {
    if (o.status === initialState) result.set(o.id, { nextTransitionVerb: manual[0].verb, nextTransitionToState: manual[0].toState });
  }
  return result;
}

async function commissionedSeuIdByObjectiveId(): Promise<Map<string, string>> {
  const { data: pairs } = await seusDB.commissionedObjectiveSeuIds();
  return new Map((pairs ?? []).map((p) => [p.objectiveId, p.seuId]));
}

export async function listObjectives(tenantId?: string | null): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findAll(tenantId);
  const rows = data ?? [];
  const initialState = await objectiveInitialState();
  const commissionedSeuIds = await commissionedSeuIdByObjectiveId();
  const parentsWithChildren = new Set(rows.map((o) => o.parent_objective_id).filter((p): p is string => !!p));
  return rows.map((o) => toListItem(o, initialState, { commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, hasChildren: parentsWithChildren.has(o.id) }));
}

export async function listCommissionableObjectives(tenantId?: string | null): Promise<ObjectiveListItem[]> {
  const all = await listObjectives(tenantId);
  return all.filter((o) => o.commissionable);
}

export async function listSelectableObjectives(): Promise<ObjectiveListItem[]> {
  const initialState = await objectiveInitialState();
  const { data } = await objectivesDB.findByStatuses([initialState, "Active"]);
  return (data ?? []).map((o) => toListItem(o, initialState));
}

export interface ObjectiveCommissioningCapabilityRef {
  code: string;
  label: string;
}
export interface ObjectiveCommissioningRow {
  templateId: string;
  templateCode: string;
  templateName: string;
  profile: { id: string; code: string; name: string; environment: string } | null;
  capabilities: ObjectiveCommissioningCapabilityRef[];
}

export interface ObjectiveDetailView {
  objective: ObjectiveRow;
  parent: ObjectiveListItem | null;
  children: ObjectiveListItem[];
  isLeaf: boolean;
  deletable: boolean;
  requiredCapabilities: RequiredCapability[];
  comments: ObjectiveRow["comments"];
  possibleNextStates: string[];
  possibleTransitionVerbs: Record<string, string | null>;
  commissioningOptions: ObjectiveCommissioningRow[] | null;
  commissionedSeuId: string | null;
  supersedeCandidates: ObjectiveListItem[];
}

export async function getObjectiveDetail(id: string): Promise<ObjectiveDetailView | null> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) return null;
  const initialState = await objectiveInitialState();

  const [{ data: children }, { data: requiredCapabilities }, { data: possibleTransitions }, parent] = await Promise.all([
    objectivesDB.findChildren(id),
    objectivesDB.getRequiredCapabilities(id),
    transitionDefinitionsDB.findPossibleNextTransitions("Objective", objective.status),
    objective.parent_objective_id ? objectivesDB.findById(objective.parent_objective_id).then((r) => r.data ?? null) : Promise.resolve(null),
  ]);

  const eligibleTransitions = (possibleTransitions ?? []).filter((t) => t.trigger === "manual" && t.toState !== OBJECTIVE_REJECT_STATE && t.toState !== OBJECTIVE_SUPERSEDED_STATE);
  const canSupersede = (possibleTransitions ?? []).some((t) => t.trigger === "manual" && t.toState === OBJECTIVE_SUPERSEDED_STATE);

  const childRows = children ?? [];
  const isLeaf = childRows.length === 0;
  const { data: childChildCounts } = await objectivesDB.childCounts(childRows.map((c) => c.id));

  const { data: requester } = objective.requested_by != null ? await participantsMasterDB.findById(objective.requested_by) : { data: null };
  const tenantId = requester?.tenant_id ?? null;
  const capabilityCodes = (requiredCapabilities ?? []).map((c) => c.code);
  const capabilityLabels = await resolveLabels(tenantId, "capability-name");
  const resolvedRequiredCapabilities: RequiredCapability[] = capabilityCodes.map((code) => ({
    code,
    name: capabilityLabels[code] ?? code,
    description: null,
  }));

  const { data: existingSeu } = await seusDB.findByObjectiveId(id);
  const commissionedSeuId = existingSeu?.id ?? null;

  let commissioningOptions: ObjectiveCommissioningRow[] | null = null;
  if (objective.status === "Active" && objective.tier !== "Strategic" && isLeaf && !commissionedSeuId) {
    const candidates = await findCandidateTemplates(capabilityCodes, tenantId);
    const coveredCapabilities = (c: (typeof candidates)[number]): ObjectiveCommissioningCapabilityRef[] =>
      capabilityCodes.filter((code) => !c.missingCapabilities.includes(code)).map((code) => ({ code, label: capabilityLabels[code] ?? code }));

    const relevant = capabilityCodes.length > 0 ? candidates.filter((c) => coveredCapabilities(c).length > 0) : candidates;

    const profilesByTemplateId = new Map<string, Array<{ id: string; code: string; name: string; environment: string }>>();
    await Promise.all(
      relevant.map(async (c) => {
        const realProfiles = await listRealProfilesForTemplate(c.id);
        profilesByTemplateId.set(
          c.id,
          realProfiles.map((p) => ({ id: p.id, code: p.code, name: p.name, environment: p.environment }))
        );
      })
    );

    commissioningOptions = relevant.flatMap((c): ObjectiveCommissioningRow[] => {
      const capabilities = coveredCapabilities(c);
      const profiles = profilesByTemplateId.get(c.id) ?? [];
      const base = { templateId: c.id, templateCode: c.code, templateName: c.name, capabilities };
      return profiles.map((profile) => ({ ...base, profile }));
    });
  }

  let supersedeCandidates: ObjectiveListItem[] = [];
  if (canSupersede) {
    const { data: candidateRows } = await objectivesDB.findByStatuses(["Active"]);
    supersedeCandidates = (candidateRows ?? [])
      .filter((o) => o.id !== id && (o.sponsoring_authority?.tenant ?? null) === tenantId)
      .map((o) => toListItem(o, initialState));
  }

  return {
    objective,
    parent: parent ? toListItem(parent, initialState) : null,
    children: childRows.map((c) => toListItem(c, initialState, { hasChildren: (childChildCounts?.get(c.id) ?? 0) > 0 })),
    isLeaf,
    deletable: objective.status === initialState && isLeaf,
    requiredCapabilities: resolvedRequiredCapabilities,
    comments: objective.comments,
    possibleNextStates: eligibleTransitions.map((t) => t.toState),
    possibleTransitionVerbs: Object.fromEntries(eligibleTransitions.map((t) => [t.toState, t.verb])),
    commissioningOptions,
    commissionedSeuId,
    supersedeCandidates,
  };
}

export async function updateObjective(
  id: string,
  input: { statement: string; requiredCapabilityCodes?: string[]; requestedBy: string; bumpVersion?: boolean }
): Promise<ObjectiveRow> {
  const { data: current } = await objectivesDB.findById(id);
  if (!current) throw new Error(`Objective not found: ${id}`);
  const initialState = await objectiveInitialState();
  if (current.status !== initialState) {
    throw new Error(`Objective is not ${initialState} (status: ${current.status}) — only Comments can be added once it has left ${initialState}`);
  }

  if (input.requiredCapabilityCodes) {
    const requiredCapabilities = await resolveRequiredCapabilities(input.requiredCapabilityCodes);
    const { authorId, birth } = await resolveBirthAuthor(input.requestedBy);
    const { error: setErr } = await objectivesDB.setRequiredCapabilities(id, requiredCapabilities.map((c) => c.code), authorId, birth.authorityBadge);
    if (setErr) throw setErr;
  }

  const { data, error } = await objectivesDB.update(id, {
    statement: input.statement,
    requestedBy: input.requestedBy,
    bumpVersion: input.bumpVersion,
  });
  if (error || !data) throw error ?? new Error("failed to update objective");
  return data;
}

export async function reParentObjective(id: string, newParentId: string | null): Promise<ObjectiveRow> {
  const { data: node } = await objectivesDB.findById(id);
  if (!node) throw new Error(`Objective not found: ${id}`);

  const initialState = await objectiveInitialState();
  if (node.status !== initialState) {
    throw new Error(`Objective is not ${initialState} (status: ${node.status}) — only Comments can be added once it has left ${initialState}`);
  }

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

    const decomposable = await decomposableParentStatuses();
    if (!decomposable.includes(parent.status)) {
      throw new Error(`new parent Objective is not ${decomposable.join(" or ")} (status: ${parent.status}) — adding children is only allowed while it is still ${decomposable.join(" or ")}`);
    }

    const nodeTenantId = node.sponsoring_authority?.tenant ?? null;
    const newParentTenantId = parent.sponsoring_authority?.tenant ?? null;
    if (nodeTenantId === null || newParentTenantId === null || nodeTenantId !== newParentTenantId) {
      throw new Error(`cannot move: the new parent belongs to a different tenant`);
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

export async function deleteObjective(id: string): Promise<void> {
  const { data: node } = await objectivesDB.findById(id);
  if (!node) throw new Error(`Objective not found: ${id}`);
  const initialState = await objectiveInitialState();
  if (node.status !== initialState) {
    throw new Error(`only a ${initialState} Objective can be deleted (status: ${node.status}) — retire it instead`);
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

export async function retireObjectiveSubtree(input: { objectiveId: string; actorId: string }): Promise<{ retired: string[]; skipped: Array<{ id: string; status: ObjectiveStatus }> }> {
  const { data: node } = await objectivesDB.findById(input.objectiveId);
  if (!node) throw new Error(`Objective not found: ${input.objectiveId}`);
  if (node.status !== "Active") {
    throw new Error(`only an Active Objective can be retired (status: ${node.status})`);
  }

  const rootResult = await transitionEntity({ entityType: "Objective", entityId: node.id, targetState: "Retired", actorId: input.actorId });
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
    const res = await transitionEntity({ entityType: "Objective", entityId: descId, targetState: "Retired", actorId: input.actorId });
    if (res.ok) retired.push(descId);
    else skipped.push({ id: descId, status: desc.status });
  }
  return { retired, skipped };
}

export async function listReParentCandidates(movingId: string): Promise<ObjectiveListItem[]> {
  const { data: node } = await objectivesDB.findById(movingId);
  if (!node) return [];
  if (node.tier === "Strategic") return [];
  const initialState = await objectiveInitialState();
  const [{ data: selectable }, { data: descendantIds }] = await Promise.all([
    objectivesDB.findByStatuses(await decomposableParentStatuses()),
    objectivesDB.findDescendantIds(movingId),
  ]);
  const blocked = new Set([movingId, ...(descendantIds ?? [])]);
  const nodeTenantId = node.sponsoring_authority?.tenant ?? null;
  return (selectable ?? [])
    .filter(
      (o) =>
        !blocked.has(o.id) &&
        TIER_RANK[node.tier] >= TIER_RANK[o.tier] &&
        nodeTenantId !== null &&
        (o.sponsoring_authority?.tenant ?? null) === nodeTenantId
    )
    .map((o) => toListItem(o, initialState));
}

export async function getObjectiveRootsPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<{ items: ObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRootsPage(opts);
  const rows = data?.items ?? [];
  const initialState = await objectiveInitialState();
  const [{ data: counts }, commissionedSeuIds, nextTransitions] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    commissionedSeuIdByObjectiveId(),
    computeNextTransition(rows, initialState),
  ]);
  return {
    items: rows.map((o) =>
      toListItem(o, initialState, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, ...nextTransitions.get(o.id) })
    ),
    total: data?.total ?? 0,
  };
}

export interface RejectedObjectiveListItem extends ObjectiveListItem {
  lastComment: ObjectiveRow["comments"][number] | null;
}

export async function getRejectedObjectivesPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<{ items: RejectedObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRejectedPage(opts);
  const rows = data?.items ?? [];
  const initialState = await objectiveInitialState();
  return {
    items: rows.map((o) => ({ ...toListItem(o, initialState), lastComment: o.comments[o.comments.length - 1] ?? null })),
    total: data?.total ?? 0,
  };
}

export async function getObjectiveChildren(parentId: string): Promise<ObjectiveListItem[]> {
  const { data: children } = await objectivesDB.findChildren(parentId);
  const rows = children ?? [];
  const initialState = await objectiveInitialState();
  const [{ data: counts }, commissionedSeuIds, nextTransitions] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    commissionedSeuIdByObjectiveId(),
    computeNextTransition(rows, initialState),
  ]);
  return rows.map((o) =>
    toListItem(o, initialState, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, ...nextTransitions.get(o.id) })
  );
}

export interface ObjectiveSearchHit extends ObjectiveListItem {
  path: Array<{ id: string; displayId: string | null; statement: string; tier: ObjectiveTier }>;
}

export async function searchObjectives(tenantId?: string | null): Promise<ObjectiveSearchHit[]> {
  const { data } = await objectivesDB.findAll(tenantId);
  const rows = data ?? [];
  const initialState = await objectiveInitialState();
  const commissionedSeuIds = await commissionedSeuIdByObjectiveId();
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
      path.unshift({ id: p.id, displayId: p.display_id, statement: p.statement, tier: p.tier });
      cursor = p.parent_objective_id;
    }
    return {
      ...toListItem(o, initialState, { commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, hasChildren: parentsWithChildren.has(o.id) }),
      path,
    };
  });
}

export async function suggestCapabilityCodes(statement: string): Promise<string[]> {
  const concepts = await listConceptsForType("capability-name", { isRoot: false, tenantId: null }, false);
  const text = statement.toLowerCase();
  const matches: string[] = [];
  for (const concept of concepts) {
    const haystack = [concept.default_label, concept.description ?? ""].join(" ").toLowerCase();
    const terms = haystack.split(/\W+/).filter((w) => w.length > 3);
    if (terms.some((term) => text.includes(term))) matches.push(concept.code);
  }
  return matches;
}
