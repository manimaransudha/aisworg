import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { triggerEngine } from "../../../domain/engine/triggerEngine.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { supersessionEngine } from "../../../domain/engine/supersessionEngine.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { findCandidateTemplates } from "./templates.js";
import { listRealProfilesForTemplate } from "./profiles.js";
import { listConceptsForType, resolveLabels } from "./ontology.js";
import type { ObjectiveCommentRow, ObjectiveRow, ObjectiveStatus, ObjectiveTier, RequiredCapability } from "../../../dblayer/seuTypes.js";

const TIER_RANK: Record<ObjectiveTier, number> = { Strategic: 0, Operational: 1, Engineering: 2 };

const DECOMPOSABLE_PARENT_STATUSES: ObjectiveStatus[] = ["Proposed", "Active"];

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

async function resolveCapabilityAuthor(requestedBy: string): Promise<{ authorId: string; authorBadge: string }> {
  const { data: master } = await participantsMasterDB.findById(requestedBy);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(String(requestedBy));
  const authorBadge = isRoot ? "root" : [...badgeTypes][0];
  if (!authorBadge) throw new Error(`participant ${master.id} holds no badge at all — cannot record an author badge`);
  return { authorId: master.id, authorBadge };
}

export async function createObjective(input: {
  statement: string;
  requiredCapabilityCodes: string[];
  tier?: ObjectiveTier;
  status?: ObjectiveStatus;
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

    if (!input.skipParentValidation && !DECOMPOSABLE_PARENT_STATUSES.includes(parent.status)) {
      throw new Error(`parent Objective is not Proposed or Active (status: ${parent.status}) — adding children is only allowed while it is still Proposed or Active`);
    }

    if (await isObjectiveEditLocked(input.parentObjectiveId)) {
      throw new Error(`parent Objective has already been submitted for activation — adding children is locked until the activate badge holder acts on it`);
    }

    if (!input.skipParentValidation) {
      const { isRoot } = await badgeAuthorityEngine.getHeldBadges(input.requestedBy);
      if (!isRoot) {
        const { data: requester } = await participantsMasterDB.findById(input.requestedBy);
        console.log(JSON.stringify(requester))
        const requesterTenantId = requester?.tenant_id ?? null;
        const parentTenantId = parent.sponsoring_authority?.tenant ?? null;
        if (parentTenantId === null || requesterTenantId === null || parentTenantId !== requesterTenantId) {
          throw new Error(`parent Objective not found: ${input.parentObjectiveId}`);
        }
      }
    }
  }

  const { authorId, authorBadge } = await resolveCapabilityAuthor(input.requestedBy!);

  const { data: objective, error } = await objectivesDB.create({
    statement: input.statement,
    tier,
    status: input.status,
    parentObjectiveId: input.parentObjectiveId,
    requestedBy: input.requestedBy,
    authorId,
    authorBadge,
  });
  if (error || !objective) throw error ?? new Error("failed to create objective");

  const requiredCapabilities = await resolveRequiredCapabilities(input.requiredCapabilityCodes);
  if (requiredCapabilities.length > 0) {
    const { authorId, authorBadge } = await resolveCapabilityAuthor(input.requestedBy!);
    await objectivesDB.addCapabilities(objective.id, requiredCapabilities.map((c) => c.code), authorId, authorBadge);
  }
  return { objective, requiredCapabilities };
}

export const ONE_SHOT_CONTAINER_STATEMENT = "Uncategorised — directly-commissioned SEUs";

export async function ensureOneShotContainer(requestedBy:string): Promise<ObjectiveRow> {
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
  editLocked: boolean;
  retirable: boolean;
  submitVerb: string | null;
  alreadySubmitted: boolean;
  nextTransitionVerb: string | null;
  nextTransitionToState: string | null;
  supersedingObjectiveId: string | null;
}

function toListItem(
  o: ObjectiveRow,
  opts: {
    commissionedSeuId?: string | null;
    hasChildren?: boolean;
    submitVerb?: string | null;
    alreadySubmitted?: boolean;
    nextTransitionVerb?: string | null;
    nextTransitionToState?: string | null;
    editLocked?: boolean;
  } = {}
): ObjectiveListItem {
  const commissionedSeuId = opts.commissionedSeuId ?? null;
  const commissioned = commissionedSeuId !== null;
  const hasChildren = opts.hasChildren ?? false;
  const isLeaf = !hasChildren;
  const editLocked = opts.editLocked ?? (opts.alreadySubmitted ?? false);
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
    deletable: o.status === "Proposed" && isLeaf && !commissioned && !editLocked,
    editLocked,
    retirable: o.status === "Active",
    submitVerb: opts.submitVerb ?? null,
    alreadySubmitted: opts.alreadySubmitted ?? false,
    nextTransitionVerb: opts.nextTransitionVerb ?? null,
    nextTransitionToState: opts.nextTransitionToState ?? null,
    supersedingObjectiveId: o.superseding_objective_id,
  };
}

async function computeEditLockedIds(): Promise<Set<string>> {
  const { data: proposedRows } = await objectivesDB.findByStatuses(["Proposed"]);
  const proposedIds = (proposedRows ?? []).map((o) => o.id);
  if (proposedIds.length === 0) return new Set();

  const { data: events } = await eventsDB.findByOriginatingObjects("Objective", proposedIds);
  const submittedIds = new Set(
    (events ?? []).filter((e) => e.event_type === "ObjectiveProposed").map((e) => e.originating_object_id)
  );
  if (submittedIds.size === 0) return new Set();

  const locked = new Set(submittedIds);
  const descendantLists = await Promise.all([...submittedIds].map((id) => objectivesDB.findDescendantIds(id)));
  for (const { data: descendantIds } of descendantLists) {
    for (const d of descendantIds ?? []) locked.add(d);
  }
  return locked;
}

async function computeSubmitInfo(
  rows: ObjectiveRow[]
): Promise<Map<string, { submitVerb: string | null; alreadySubmitted: boolean; nextTransitionVerb: string | null; nextTransitionToState: string | null }>> {
  const result = new Map<string, { submitVerb: string | null; alreadySubmitted: boolean; nextTransitionVerb: string | null; nextTransitionToState: string | null }>();
  const distinctStatuses = [...new Set(rows.map((o) => o.status))];
  const statusInfo = new Map<string, { submitVerb: string; nextTransitionVerb: string | null; nextTransitionToState: string }>();
  await Promise.all(
    distinctStatuses.map(async (status) => {
      const { data: transitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Objective", status);
      const withSubmit = (transitions ?? []).find((t) => t.submitVerb);
      if (withSubmit?.submitVerb) statusInfo.set(status, { submitVerb: withSubmit.submitVerb, nextTransitionVerb: withSubmit.verb, nextTransitionToState: withSubmit.toState });
    })
  );

  const idsNeedingSubmitCheck = rows.filter((o) => statusInfo.has(o.status)).map((o) => o.id);
  const { data: events } = idsNeedingSubmitCheck.length > 0 ? await eventsDB.findByOriginatingObjects("Objective", idsNeedingSubmitCheck) : { data: [] };
  const submittedKeys = new Set((events ?? []).map((e) => `${e.originating_object_id}:${e.event_type}`));

  for (const o of rows) {
    const info = statusInfo.get(o.status);
    result.set(o.id, {
      submitVerb: info?.submitVerb ?? null,
      alreadySubmitted: info ? submittedKeys.has(`${o.id}:Objective${o.status}`) : false,
      nextTransitionVerb: info?.nextTransitionVerb ?? null,
      nextTransitionToState: info?.nextTransitionToState ?? null,
    });
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
  const commissionedSeuIds = await commissionedSeuIdByObjectiveId();
  const parentsWithChildren = new Set(rows.map((o) => o.parent_objective_id).filter((p): p is string => !!p));
  return rows.map((o) => toListItem(o, { commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, hasChildren: parentsWithChildren.has(o.id) }));
}

export async function listCommissionableObjectives(tenantId?: string | null): Promise<ObjectiveListItem[]> {
  const all = await listObjectives(tenantId);
  return all.filter((o) => o.commissionable);
}

export async function listSelectableObjectives(): Promise<ObjectiveListItem[]> {
  const { data } = await objectivesDB.findByStatuses(["Proposed", "Active"]);
  return (data ?? []).map((o) => toListItem(o));
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
  retirable: boolean;
  rejectable: boolean;
  supersedable: boolean;
  editLocked: boolean;
  requiredCapabilities: RequiredCapability[];
  comments: ObjectiveCommentRow[];
  possibleNextStates: string[];
  possibleTransitionVerbs: Record<string, string | null>;
  submitVerb: string | null;
  submitToState: string | null;
  alreadySubmitted: boolean;
  commissioningOptions: ObjectiveCommissioningRow[] | null;
  commissionedSeuId: string | null;
  supersedeCandidates: ObjectiveListItem[];
}

export async function getObjectiveDetail(id: string): Promise<ObjectiveDetailView | null> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) return null;

  const [{ data: children }, { data: requiredCapabilities }, { data: possibleTransitions }, { data: comments }, parent] = await Promise.all([
    objectivesDB.findChildren(id),
    objectivesDB.getRequiredCapabilities(id),
    transitionDefinitionsDB.findPossibleNextTransitions("Objective", objective.status),
    objectivesDB.getComments(id),
    objective.parent_objective_id ? objectivesDB.findById(objective.parent_objective_id).then((r) => r.data ?? null) : Promise.resolve(null),
  ]);

  const submitOption = (possibleTransitions ?? []).find((t) => t.submitVerb) ?? null;
  const submitVerb = submitOption?.submitVerb ?? null;
  const submitToState = submitOption?.toState ?? null;
  const alreadySubmitted = submitVerb ? await triggerEngine.hasBeenSubmitted("Objective", id, objective.status) : false;
  const eligibleTransitions = (possibleTransitions ?? []).filter(
    (t) => t.trigger === "manual" && t.toState !== "Reject" && t.toState !== "Superseded" && (!t.submitVerb || alreadySubmitted)
  );
  const canSupersede = (possibleTransitions ?? []).some((t) => t.trigger === "manual" && t.toState === "Superseded" && (!t.submitVerb || alreadySubmitted));

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

  const editLocked = await isObjectiveEditLocked(id);

  let supersedeCandidates: ObjectiveListItem[] = [];
  if (canSupersede) {
    const { data: candidateRows } = await objectivesDB.findByStatuses(["Active"]);
    supersedeCandidates = (candidateRows ?? [])
      .filter((o) => o.id !== id && (o.sponsoring_authority?.tenant ?? null) === tenantId)
      .map((o) => toListItem(o));
  }

  return {
    objective,
    parent: parent ? toListItem(parent) : null,
    children: childRows.map((c) => toListItem(c, { hasChildren: (childChildCounts?.get(c.id) ?? 0) > 0 })),
    isLeaf,
    deletable: objective.status === "Proposed" && isLeaf && !editLocked,
    retirable: objective.status === "Active",
    rejectable: objective.status === "Active",
    supersedable: canSupersede,
    editLocked,
    requiredCapabilities: resolvedRequiredCapabilities,
    comments: comments ?? [],
    possibleNextStates: eligibleTransitions.map((t) => t.toState),
    possibleTransitionVerbs: Object.fromEntries(eligibleTransitions.map((t) => [t.toState, t.verb])),
    submitVerb,
    submitToState,
    alreadySubmitted,
    commissioningOptions,
    commissionedSeuId,
    supersedeCandidates,
  };
}

export async function submitObjective(id: string, actorId: string): Promise<void> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) throw new Error(`Objective not found: ${id}`);
  const { data: transitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Objective", objective.status);
  const submitVerb = (transitions ?? []).find((t) => t.submitVerb)?.submitVerb ?? null;
  if (!submitVerb) throw new Error(`no Submit step is defined for Objective status "${objective.status}"`);

  const alreadySubmitted = await triggerEngine.hasBeenSubmitted("Objective", id, objective.status);
  if (alreadySubmitted) throw new Error(`Objective ${id} has already been submitted from status "${objective.status}"`);

  const requiredBadge = `objective_${submitVerb}`;
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge });
  if (!auth.allowed) throw new Error(`requires badge ${requiredBadge}`);
  const submitBadge = auth.via === "root" ? "root" : (auth.matchedBadge ?? requiredBadge);

  await triggerEngine.submit({ entityType: "Objective", entityId: id, fromState: objective.status, actorId, authorityBadge: submitBadge });
}

async function isProposedAndSubmitted(o: ObjectiveRow): Promise<boolean> {
  return o.status === "Proposed" && (await triggerEngine.hasBeenSubmitted("Objective", o.id, "Proposed"));
}

export async function isObjectiveEditLocked(id: string): Promise<boolean> {
  const { data: objective } = await objectivesDB.findById(id);
  if (!objective) return false;
  if (await isProposedAndSubmitted(objective)) return true;

  const { data: ancestors } = await objectivesDB.findAncestorPath(id);
  for (const ancestor of ancestors ?? []) {
    if (await isProposedAndSubmitted(ancestor)) return true;
  }
  return false;
}

export async function updateObjective(
  id: string,
  input: { statement?: string; requiredCapabilityCodes?: string[]; requestedBy: string; bumpVersion?: boolean }
): Promise<ObjectiveRow> {
  const { data: current } = await objectivesDB.findById(id);
  if (!current) throw new Error(`Objective not found: ${id}`);
  if (current.status !== "Proposed") {
    throw new Error(`Objective is not Proposed (status: ${current.status}) — only Comments can be added once it has left Proposed`);
  }
  if (await isObjectiveEditLocked(id)) {
    throw new Error("this Objective has already been submitted for activation — editing is locked until the activate badge holder acts on it");
  }

  if (input.requiredCapabilityCodes) {
    const requiredCapabilities = await resolveRequiredCapabilities(input.requiredCapabilityCodes);
    let authorId: string | undefined;
    let authorBadge: string | undefined;
    if (requiredCapabilities.length > 0) {
      if (input.requestedBy == null) throw new Error("no acting user to record as this Objective's capability author — log in first");
      ({ authorId, authorBadge } = await resolveCapabilityAuthor(input.requestedBy));
    }
    const { error: setErr } = await objectivesDB.setRequiredCapabilities(id, requiredCapabilities.map((c) => c.code), authorId, authorBadge);
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

  if (node.status !== "Proposed") {
    throw new Error(`Objective is not Proposed (status: ${node.status}) — only Comments can be added once it has left Proposed`);
  }
  if (await isObjectiveEditLocked(id)) {
    throw new Error("this Objective has already been submitted for activation — editing is locked until the activate badge holder acts on it");
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

    if (!DECOMPOSABLE_PARENT_STATUSES.includes(parent.status)) {
      throw new Error(`new parent Objective is not Proposed or Active (status: ${parent.status}) — adding children is only allowed while it is still Proposed or Active`);
    }
    if (await isObjectiveEditLocked(newParentId)) {
      throw new Error(`new parent Objective has already been submitted for activation — adding children is locked until the activate badge holder acts on it`);
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
  if (node.status !== "Proposed") {
    throw new Error(`only a Proposed Objective can be deleted (status: ${node.status}) — retire it instead`);
  }
  if (await isObjectiveEditLocked(id)) {
    throw new Error("this Objective has already been submitted for activation — deletion is locked until the activate badge holder acts on it");
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

export async function retireObjectiveSubtree(input: { objectiveId: string; actorRole: string; actorId: string }): Promise<{ retired: string[]; skipped: Array<{ id: string; status: ObjectiveStatus }> }> {
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

export async function listReParentCandidates(movingId: string): Promise<ObjectiveListItem[]> {
  const { data: node } = await objectivesDB.findById(movingId);
  if (!node) return [];
  if (node.tier === "Strategic") return [];
  const [{ data: selectable }, { data: descendantIds }] = await Promise.all([
    objectivesDB.findByStatuses(DECOMPOSABLE_PARENT_STATUSES),
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
    .map((o) => toListItem(o));
}

export async function getObjectiveRootsPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<{ items: ObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRootsPage(opts);
  const rows = data?.items ?? [];
  const [{ data: counts }, commissionedSeuIds, submitInfo, lockedIds] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    commissionedSeuIdByObjectiveId(),
    computeSubmitInfo(rows),
    computeEditLockedIds(),
  ]);
  return {
    items: rows.map((o) =>
      toListItem(o, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, editLocked: lockedIds.has(o.id), ...submitInfo.get(o.id) })
    ),
    total: data?.total ?? 0,
  };
}

export interface RejectedObjectiveListItem extends ObjectiveListItem {
  lastComment: ObjectiveCommentRow | null;
}

export async function getRejectedObjectivesPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<{ items: RejectedObjectiveListItem[]; total: number }> {
  const { data } = await objectivesDB.findRejectedPage(opts);
  const rows = data?.items ?? [];
  const [comments, lockedIds] = await Promise.all([
    Promise.all(rows.map((o) => objectivesDB.getComments(o.id))),
    computeEditLockedIds(),
  ]);
  return {
    items: rows.map((o, i) => {
      const objComments = comments[i]?.data ?? [];
      return { ...toListItem(o, { editLocked: lockedIds.has(o.id) }), lastComment: objComments[objComments.length - 1] ?? null };
    }),
    total: data?.total ?? 0,
  };
}

export async function getObjectiveChildren(parentId: string): Promise<ObjectiveListItem[]> {
  const { data: children } = await objectivesDB.findChildren(parentId);
  const rows = children ?? [];
  const [{ data: counts }, commissionedSeuIds, submitInfo, lockedIds] = await Promise.all([
    objectivesDB.childCounts(rows.map((o) => o.id)),
    commissionedSeuIdByObjectiveId(),
    computeSubmitInfo(rows),
    computeEditLockedIds(),
  ]);
  return rows.map((o) =>
    toListItem(o, { hasChildren: (counts?.get(o.id) ?? 0) > 0, commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, editLocked: lockedIds.has(o.id), ...submitInfo.get(o.id) })
  );
}

export interface ObjectiveSearchHit extends ObjectiveListItem {
  path: Array<{ id: string; displayId: string | null; statement: string; tier: ObjectiveTier }>;
}

export async function searchObjectives(tenantId?: string | null): Promise<ObjectiveSearchHit[]> {
  const { data } = await objectivesDB.findAll(tenantId);
  const rows = data ?? [];
  const [commissionedSeuIds, lockedIds] = await Promise.all([commissionedSeuIdByObjectiveId(), computeEditLockedIds()]);
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
      ...toListItem(o, { commissionedSeuId: commissionedSeuIds.get(o.id) ?? null, hasChildren: parentsWithChildren.has(o.id), editLocked: lockedIds.has(o.id) }),
      path,
    };
  });
}

export type TransitionObjectiveResult =
  | { ok: true; objective: ObjectiveRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "comment_required"; detail: string }
  | { ok: false; reason: "superseding_target_required" | "superseding_target_not_found"; detail: string }
  | { ok: false; reason: "superseding_target_wrong_tenant"; detail: string };

export async function transitionObjective(input: { objectiveId: string; targetState: ObjectiveStatus; actorRole: string; actorId: string; comment?: string; supersedingObjectiveId?: string }): Promise<TransitionObjectiveResult> {
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
    entityId: objective.id,
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Objective ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const trimmedComment = input.comment?.trim() ?? "";
  if (fromState === "Active" && input.targetState === "Reject") {
    if (!trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Rejecting requires feedback — provide a comment explaining what needs to change." };
    }
    const { data: existingComments } = await objectivesDB.getComments(objective.id);
    const mostRecent = existingComments?.[existingComments.length - 1];
    if (mostRecent && mostRecent.comment_text.trim() === trimmedComment) {
      return { ok: false, reason: "comment_required", detail: "Provide new feedback — this matches the most recent comment already on record." };
    }
  }

  let supersedingObjectiveId: string | undefined;
  if (input.targetState === "Superseded") {
    const check = await supersessionEngine.check({
      supersededId: objective.id,
      supersedingId: input.supersedingObjectiveId,
      comment: input.comment,
      actorId: input.actorId,
      authorityBadge: gate.authorityBadge ?? "root",
      findCandidate: async (candidateId) => (await objectivesDB.findById(candidateId)).data ?? null,
    });
    if (!check.ok) return { ok: false, reason: check.reason, detail: check.detail };
    const { data: supersedingObjective } = await objectivesDB.findById(check.supersedingId);
    const supersededTenantId = objective.sponsoring_authority?.tenant ?? null;
    const supersedingTenantId = supersedingObjective?.sponsoring_authority?.tenant ?? null;
    if (supersededTenantId === null || supersedingTenantId === null || supersededTenantId !== supersedingTenantId) {
      return { ok: false, reason: "superseding_target_wrong_tenant", detail: "the superseding Objective belongs to a different tenant" };
    }
    supersedingObjectiveId = check.supersedingId;
  }

  const { data: updated, error } = await objectivesDB.updateStatus(objective.id, input.targetState, supersedingObjectiveId);
  if (error || !updated) throw error ?? new Error("failed to update objective status");

  if (trimmedComment) {
    await objectivesDB.addComment(objective.id, input.actorId, trimmedComment);
  }

  await eventBus.publish({
    eventType: gate.eventType ?? "ObjectiveTransitioned",
    originatingObjectType: "Objective",
    originatingObjectId: objective.id,
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge ?? "root",
    versionEvent: gate.versionEvent,
    fromState,
    toState: input.targetState,
    tenantId: objective.sponsoring_authority?.tenant ?? null,
  });

  return { ok: true, objective: updated, appliedTransition: { fromState, toState: input.targetState } };
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
