import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, stashFormInput, takeFormInput } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import {
  createObjective,
  deleteObjective,
  getObjectiveChildren,
  getObjectiveDetail,
  getObjectiveRootsPage,
  getRejectedObjectivesPage,
  listReParentCandidates,
  reParentObjective,
  retireObjectiveSubtree,
  searchObjectives,
  objectiveInitialState,
  updateObjective,
} from "../core/objectives.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { nextActionsFor, transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { parseListParams, paginateList, listResult } from "../../../utils/listQuery.js";
import { previewCommissioningValidation } from "../core/commissioning.js";
// Commented out (owner): the old conflict strategies are replaced by the Resolve Conflicts screen.
// import { applyConflictStrategy } from "../core/commissioning.js";
import type { LivenessCheck } from "../core/commissioning.js";
import type { ProfileDetail } from "../core/profiles.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { resolveResultLinks } from "./conflictResultLinks.js";
import { resultCells } from "../../../utils/resultCells.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { listConceptsForType } from "../core/ontology.js";
import { applyConflictPick, blockingEbmConflicts, conflictStatus, summariseConflictTables, type ActionedConflict, type ConflictPick, type EbmConflictTable } from "../../../domain/engine/conflicts/index.js";
import type { ObjectiveStatus, ObjectiveTier, EbmCompositionReport, EbmComposedPack } from "../../../dblayer/seuTypes.js";
import type { UnraveledComposition, CompositionConflict } from "../../../domain/engine/profileCompositionUnravel.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { resolveHeldBadges, requireActorId, resolveActorAndBadge, resolveAuthorBadgeForRequest } from "../../../domain/identity/heldBadges.js";
import { CONFLICT_RESULT_COLUMNS, CONFLICT_RESULT_GROUP_BY, CONFLICT_KINDS_SHOWN_AS_COMPARISON, CONFLICT_TABLES_SHOWN_AS_TABLE, CONFLICT_TABLE_LABELS, getPlatformTenantId, PLATFORM_TENANT_NAME, OBJECTIVE_RETIRED_STATE, SEU_VALIDATED_STATE, SUPERSEDE_OBJECTIVE_ACTION_CODE } from "../../../dblayer/constants.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
 
const CHILD_TIERS: Record<ObjectiveTier, ObjectiveTier[]> = {
  Strategic: ["Operational", "Engineering"],
  Operational: ["Engineering"],
  Engineering: [],
};

async function getObjectiveViewerContext(req: Request): Promise<{ isRoot: boolean; tenantId: string | null; canProposeObjective: boolean; canComment: boolean; hasObjectiveBadge: (verb: string | null) => boolean }> {
  const held = await resolveHeldBadges(req);
  const hasObjectiveBadge = (verb: string | null): boolean => held.hasVerb("Objective", verb);
  return {
    isRoot: (req.session?.user?.platformBadges ?? []).includes("root"),
    tenantId: req.session?.user?.tenant_id ?? null,
    canProposeObjective: held.has("objective_propose"),
    canComment: true,
    hasObjectiveBadge,
  };
}

// The states from which this viewer may retire (a subtree retire is the Retired hop of the transition definitions).
async function retireStatusesFor(req: Request, nodes: Array<{ status: string }>): Promise<string[]> {
  const actorId = requireActorId(req);
  const statuses = [...new Set(nodes.map((n) => n.status))];
  const held = await Promise.all(statuses.map(async (s) => ((await nextActionsFor("Objective", s, actorId)).some((a) => a.toState === OBJECTIVE_RETIRED_STATE) ? s : null)));
  return held.filter((s): s is string => s !== null);
}

router.param(
  "id",
  requireTenantScope.forParam("id", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundMessage: "Objective not found.",
  })
);

router.get("/objectives", attachVM("seu/objectives/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Objectives";
    const _base = "/aisworg/seu/objectives";
    req.vm.opt.listBasePath = _base;
    req.vm.opt.flash = getFlash(req);

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rejectedView = req.query.view === "rejected";
    req.vm.req.mode = rejectedView ? "rejected" : q ? "search" : "browse";

    const { isRoot, tenantId, canProposeObjective, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    req.vm.req.canProposeObjective = canProposeObjective;
    req.vm.req.hasObjectiveBadge = hasObjectiveBadge;

    if (rejectedView) {
      const params = parseListParams(req.query, { sortable: ["created"], defaultSort: "created", defaultDir: "desc" });
      const { items, total } = await getRejectedObjectivesPage({ limit: params.limit, offset: params.offset, tenantId: isRoot ? undefined : tenantId });
      req.vm.req.list = listResult(items, total, params);
    } else if (q) {
      const params = parseListParams(req.query, { sortable: ["statement", "tier", "status"], defaultSort: "statement", defaultDir: "asc" });
      const hits = await searchObjectives(isRoot ? undefined : tenantId);
      req.vm.req.list = paginateList(hits, params, {
        searchFields: [(o) => o.statement],
        sortFields: { statement: (o) => o.statement, tier: (o) => o.tier, status: (o) => o.status },
      });
    } else {
      const params = parseListParams(req.query, { sortable: ["created"], defaultSort: "created", defaultDir: "desc" });
      const { items, total } = await getObjectiveRootsPage({ limit: params.limit, offset: params.offset, tenantId: isRoot ? undefined : tenantId });
      req.vm.req.roots = items;
      req.vm.req.retireStatuses = await retireStatusesFor(req, items);
      req.vm.req.childTiers = CHILD_TIERS;
      req.vm.req.list = listResult(items, total, params);
    }
    return renderView(req, res, "seu/objectives/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives error", err as Error);
    next(err);
  }
});

router.get("/objectives/:id/children", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const depth = Math.max(0, Math.min(20, parseInt(String(req.query.depth ?? "1"), 10) || 1));
    const nodes = await getObjectiveChildren(String(req.params.id));
    const { canProposeObjective, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    const retireStatuses = await retireStatusesFor(req, nodes);
    return res.render("seu/objectives/_nodes", { nodes, depth, csrfToken: res.locals.csrfToken, childTiers: CHILD_TIERS, retireStatuses, canProposeObjective, hasObjectiveBadge });
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id/children error", err as Error);
    next(err);
  }
});

router.get(
  "/objectives/new",
  requireTenantScope.forField("query", "parent", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundMessage: "Parent Objective not found.",
  }),
  requireTenantScope.forField("query", "supersedes", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundMessage: "Objective to supersede not found.",
  }),
  attachVM("seu/objectives/new"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parentId = typeof req.query.parent === "string" && req.query.parent.trim() ? req.query.parent.trim() : null;
    let parent = null;
    let tier: ObjectiveTier = "Strategic";

    if (parentId) {
      const { data } = await objectivesDB.findById(parentId);
      if (!data) return redirects.seu.objectivesNew.error(req, res, "Parent Objective not found.");
      parent = data;
      const requested = req.query.tier as ObjectiveTier | undefined;
      const allowed = CHILD_TIERS[data.tier];
      if (!requested || !allowed.includes(requested)) {
        return redirects.seu.objectivesNew.error(req, res, `A ${data.tier} Objective can only add: ${allowed.join(", ") || "no"} children.`, `/aisworg/seu/objectives/${parentId}`);
      }
      tier = requested;
    }

    const supersedesId = typeof req.query.supersedes === "string" && req.query.supersedes.trim() ? req.query.supersedes.trim() : null;
    const supersedesObjective = supersedesId ? (await objectivesDB.findById(supersedesId)).data ?? null : null;
    if (supersedesId && !supersedesObjective) {
      return redirects.seu.objectivesNew.error(req, res, "Objective to supersede not found.");
    }

    const { isRoot, tenantId } = await getObjectiveViewerContext(req);
    const capabilities = (await listConceptsForType("capability-name", { isRoot, tenantId }, false))
      .map((c) => ({ code: c.code, name: c.default_label, description: c.description }));
    req.vm.req.title = `New ${tier} Objective`;
    req.vm.req.supersedesObjective = supersedesObjective;
    req.vm.req.capabilities = capabilities;
    req.vm.req.parent = parent;
    req.vm.req.tier = tier;
    req.vm.req.initialState = await objectiveInitialState();
    const prior = takeFormInput(req);
    req.vm.req.statement = typeof prior?.statement === "string" ? prior.statement : "";
    if (prior) {
      req.vm.req.selectedCodes = Array.isArray(prior.requiredCapabilityCodes) ? prior.requiredCapabilityCodes : [];
    } else if (parent) {
      const { data: parentCaps } = await objectivesDB.getRequiredCapabilities(parent.id);
      req.vm.req.selectedCodes = (parentCaps ?? []).map((c) => c.code);
    } else {
      req.vm.req.selectedCodes = [];
    }
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/new error", err as Error);
    next(err);
  }
});

router.post(
  "/objectives",
  requireTenantScope.forField("body", "parentObjectiveId", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundMessage: "Parent Objective not found.",
  }),
  requireTenantScope.forField("body", "supersedes", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundMessage: "Objective to supersede not found.",
  }),
  async (req: Request, res: Response) => {
  const { statement, tier, parentObjectiveId, requiredCapabilityCodes, supersedes, supersedeComment } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];
  const parentId = parentObjectiveId || null;
  const supersedesId = typeof supersedes === "string" && supersedes.trim() ? supersedes.trim() : null;
  const backToNew = `/aisworg/seu/objectives/new${parentId ? `?parent=${parentId}&tier=${tier}` : ""}${supersedesId ? `${parentId ? "&" : "?"}supersedes=${supersedesId}` : ""}`;

  if (supersedesId && (typeof supersedeComment !== "string" || !supersedeComment.trim())) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return redirects.seu.objectives.error(req, res, "Supersede requires a comment explaining the supersession.", backToNew);
  }

  if (typeof statement !== "string" || !statement.trim() || codes.length === 0) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return redirects.seu.objectives.error(req, res, "Statement and at least one required Capability are required.", backToNew);
  }

  try {
    const { objective } = await createObjective({
      statement,
      requiredCapabilityCodes: codes,
      tier: (tier || undefined) as ObjectiveTier | undefined,
      parentObjectiveId: parentId,
      requestedBy: requireActorId(req),
    });

    if (supersedesId) {
      let blocked: string | null = null;
      try {
        const result = await transitionEntity({
          entityType: "Objective",
          entityId: supersedesId,
          targetState: "Superseded",
          actorId: requireActorId(req),
          context: { comment: supersedeComment, supersedingObjectiveId: objective.id },
        });
        if (!result.ok) blocked = "detail" in result ? result.detail : result.reason;
        else await publishTransition(result);
      } catch (err) {
        blocked = (err as Error).message;
      }
      if (blocked) {
        return redirects.seu.objectives.error(req, res, `Objective created, but superseding the original was blocked: ${blocked}`, `/aisworg/seu/objectives/${objective.id}`);
      }
    }

    return redirects.seu.objectives.success(req, res, `Objective created as ${objective.status}. Activate it before commissioning an SEU against it.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives error", err as Error);
    return redirects.seu.objectives.error(req, res, (err as Error).message, backToNew);
  }
});

router.get("/objectives/:id", attachVM("seu/objectives/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const detail = await getObjectiveDetail(id);
    if (!detail) return redirects.seu.objectivesById.error(req, res, "Objective not found.");
    req.vm.req.title = `Objective ${detail.objective.display_id ?? detail.objective.id.slice(0, 8)}`;
    const { canProposeObjective, canComment } = await getObjectiveViewerContext(req);
    // Every control comes from the transition definitions the viewer holds the badge for. The kind says which input the verb route needs.
    req.vm.req.actions = (await nextActionsFor("Objective", detail.objective.status, requireActorId(req))).map((a) => ({
      toState: a.toState,
      verb: a.verb,
      kind: a.toState === OBJECTIVE_RETIRED_STATE ? "retire" : a.actionCode === SUPERSEDE_OBJECTIVE_ACTION_CODE ? "target" : a.requiresComment ? "comment" : "plain",
    }));
    req.vm.req.detail = detail;
    req.vm.req.childTiers = CHILD_TIERS[detail.objective.tier];
    req.vm.req.reParentOptions = detail.objective.tier === "Strategic" ? [] : await listReParentCandidates(id);
    req.vm.req.canProposeObjective = canProposeObjective;
    req.vm.req.canComment = canComment;
    req.vm.opt.renderMarkdown = renderMarkdown;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id error", err as Error);
    next(err);
  }
});

router.get("/objectives/:id/edit", attachVM("seu/objectives/edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { data: objective } = await objectivesDB.findById(id);
    if (!objective) return redirects.seu.objectivesEdit.error(req, res, "Objective not found.");
    const { isRoot, tenantId, canComment } = await getObjectiveViewerContext(req);

    const capabilities = (await listConceptsForType("capability-name", { isRoot, tenantId }, false))
      .map((c) => ({ code: c.code, name: c.default_label, description: c.description }));
    const { data: requiredCapabilities } = await objectivesDB.getRequiredCapabilities(id);
    req.vm.req.title = `Edit ${objective.display_id ?? objective.id.slice(0, 8)}`;
    req.vm.req.objective = objective;
    req.vm.req.capabilities = capabilities;
    const prior = takeFormInput(req);
    req.vm.req.statement = typeof prior?.statement === "string" ? prior.statement : objective.statement;
    req.vm.req.selectedCodes = prior && Array.isArray(prior.requiredCapabilityCodes)
      ? prior.requiredCapabilityCodes
      : (requiredCapabilities ?? []).map((c) => c.code);
    req.vm.req.childTiers = CHILD_TIERS[objective.tier];
    req.vm.req.reParentOptions = objective.tier === "Strategic" ? [] : await listReParentCandidates(id);
    req.vm.req.comments = objective.comments;
    req.vm.req.initialState = await objectiveInitialState();
    req.vm.req.editable = objective.status === req.vm.req.initialState;
    req.vm.req.canComment = canComment;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/edit", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id/edit error", err as Error);
    next(err);
  }
});

router.post("/objectives/:id/update", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { statement, requiredCapabilityCodes, action } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];
  const bumpVersion = action !== "save_no_version";

  if (codes.length === 0) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return redirects.seu.objectivesUpdate.error(req, res, "At least one required Capability is required.");
  }
  if (typeof statement !== "string" || !statement.trim()) {
    stashFormInput(req, { statement: "", requiredCapabilityCodes: codes });
    return redirects.seu.objectivesUpdate.error(req, res, "Statement is required.");
  }
  try {
    const updated = await updateObjective(objectiveId, {
      statement,
      requiredCapabilityCodes: codes,
      requestedBy: requireActorId(req),
      bumpVersion,
    });
    const msg = bumpVersion ? `Objective updated to v${updated.version}.` : `Objective updated (still v${updated.version}).`;
    return redirects.seu.objectivesUpdate.success(req, res, msg);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/update error", err as Error);
    return redirects.seu.objectivesUpdate.error(req, res, (err as Error).message);
  }
});

router.post("/objectives/:id/move", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { newParentId } = req.body ?? {};

  try {
    await reParentObjective(objectiveId, typeof newParentId === "string" && newParentId.trim() ? newParentId : null);
    return redirects.seu.objectivesMove.success(req, res, `Objective moved.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/move error", err as Error);
    return redirects.seu.objectivesMove.error(req, res, (err as Error).message);
  }
});

router.post("/objectives/:id/delete", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  try {
    const detail = await getObjectiveDetail(objectiveId);
    const parentId = detail?.parent?.id ?? null;
    await deleteObjective(objectiveId);
    const backTo = parentId ? `/aisworg/seu/objectives/${parentId}` : "/aisworg/seu/objectives";
    return redirects.seu.objectivesDelete.success(req, res, "Objective deleted.", backTo);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/delete error", err as Error);
    return redirects.seu.objectivesDelete.error(req, res, (err as Error).message);
  }
});

router.post("/objectives/:id/retire", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  try {
    const { retired, skipped } = await retireObjectiveSubtree({
      objectiveId,
      actorId: requireActorId(req),
    });
    const msg = skipped.length
      ? `Retired ${retired.length} Objective(s); skipped ${skipped.length} (not Active).`
      : `Retired ${retired.length} Objective(s).`;
    return redirects.seu.objectivesRetire.success(req, res, msg);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/retire error", err as Error);
    return redirects.seu.objectivesRetire.error(req, res, (err as Error).message);
  }
});

function postObjectiveTransition(targetState: ObjectiveStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    const objectiveId = String(req.params.id);
    const { comment, supersedingObjectiveId } = req.body ?? {};
    try {
      const result = await transitionEntity({
        entityType: "Objective",
        entityId: objectiveId,
        targetState,
        actorId: requireActorId(req),
        context: {
          comment: typeof comment === "string" ? comment : undefined,
          supersedingObjectiveId: typeof supersedingObjectiveId === "string" && supersedingObjectiveId ? supersedingObjectiveId : undefined,
        },
      });
      if (!result.ok) {
        const detail = "detail" in result ? result.detail : result.reason;
        redirects.seu.objectivesRetire.error(req, res, `Transition blocked: ${detail}`);
        return;
      }
      await publishTransition(result);
      redirects.seu.objectivesRetire.success(req, res, `Objective moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
    } catch (err) {
      logger.error(`[web/seu/objectives] POST /objectives/:id/transition/${targetState} error`, err as Error);
      redirects.seu.objectivesRetire.error(req, res, (err as Error).message);
    }
  };
}

router.post("/objectives/:id/transition/activate", postObjectiveTransition("Active"));
router.post("/objectives/:id/transition/supersede", postObjectiveTransition("Superseded"));
router.post("/objectives/:id/transition/retire", postObjectiveTransition("Retired"));
router.post("/objectives/:id/transition/archive", postObjectiveTransition("Archived"));
router.post("/objectives/:id/transition/reject", postObjectiveTransition("Reject"));

function parseTemplateProfileSelections(body: Record<string, unknown>): Array<{ templateId: string; profileId?: string }> {
  const raw = body.templateProfile;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values
    .filter((v): v is string => typeof v === "string" && v.includes("|"))
    .map((v) => {
      const [templateId, rawProfileId] = v.split("|");
      return { templateId, profileId: rawProfileId && rawProfileId.trim() ? rawProfileId : undefined };
    })
    .filter((s) => s.templateId);
}

function parseResolvedParameterOverrides(body: Record<string, unknown>): Record<string, string> | undefined {
  const raw = body.resolution;
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parsePreviouslyResolvedCompositionConflicts(body: Record<string, unknown>): Record<string, unknown> {
  const raw = body.compositionResolution;
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

// One pick on the Resolve Conflicts screen: the conflict's key and the options picked (by position) or the include or exclude decision.
function parseEbmConflictPick(body: Record<string, unknown>): { key: string; pick: ConflictPick } | null {
  const key = body.ebmPickKey;
  if (typeof key !== "string" || !key) return null;
  const options = ([] as unknown[]).concat(body.ebmPickOption ?? []).map((v) => Number(v)).filter((n) => Number.isInteger(n));
  return { key, pick: { optionIndexes: options, decision: typeof body.ebmPickDecision === "string" ? body.ebmPickDecision : undefined } };
}

// The picks of a table shown as rows: each row posts its conflict's key (ebmBulkKey) and its decision (ebmBulkDecision_<row position>). A row with no decision is left as it was.
function parseEbmBulkPicks(body: Record<string, unknown>): Array<{ key: string; pick: ConflictPick }> {
  const picks: Array<{ key: string; pick: ConflictPick }> = [];
  ([] as unknown[]).concat(body.ebmBulkKey ?? []).forEach((key, i) => {
    const decision = body[`ebmBulkDecision_${i}`];
    if (typeof key === "string" && key && typeof decision === "string") picks.push({ key, pick: { decision } });
  });
  return picks;
}

// The page a pick on the Resolve Conflicts screen returns to, on the tab it was made on.
function resolveConflictsUrl(objectiveId: string, body: Record<string, unknown>): string {
  const category = typeof body.category === "string" && body.category ? `?category=${encodeURIComponent(body.category)}` : "";
  return `/aisworg/seu/objectives/${objectiveId}/resolve-conflicts${category}`;
}

function parseCompositionStrategyChoices(body: Record<string, unknown>): Record<string, string> {
  const raw = body.compositionStrategy;
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value) result[key] = value;
  }
  return result;
}

function parseCompositionSourceSelections(body: Record<string, unknown>): { checked: Record<string, string[]>; base: Record<string, string> } {
  const checked: Record<string, string[]> = {};
  const rawChecked = body.compositionSourceChecked;
  if (rawChecked && typeof rawChecked === "object") {
    for (const [key, value] of Object.entries(rawChecked as Record<string, unknown>)) {
      checked[key] = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : typeof value === "string" ? [value] : [];
    }
  }
  const base: Record<string, string> = {};
  const rawBase = body.compositionSourceBase;
  if (rawBase && typeof rawBase === "object") {
    for (const [key, value] of Object.entries(rawBase as Record<string, unknown>)) {
      if (typeof value === "string" && value) base[key] = value;
    }
  }
  return { checked, base };
}

router.post("/objectives/:id/compose-ebm", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  let selections = parseTemplateProfileSelections(req.body ?? {});
  const resolvedParameterOverrides = parseResolvedParameterOverrides(req.body ?? {});

  try {
    const viewerTenantId = req.session?.user?.tenant_id ?? (await getPlatformTenantId());
    const { data: existingSeu } = await seusDB.findByObjectiveId(objectiveId);
    if (!existingSeu) return redirects.seu.objectivesComposeEbm.error(req, res, "No SEU found for this Objective.");
    // The Compose button on the All SEUs page posts no selection, so the SEU's own Template and Profile are composed.
    if (selections.length === 0) selections = [{ templateId: existingSeu.template_id, profileId: existingSeu.profile_id }];

    // A Compose or a pick carries no earlier picks in its form, so they are read from what the last Compose stored.
    const storedPicks = (existingSeu.composition_report as { resolvedCompositionConflicts?: Record<string, unknown> } | null)?.resolvedCompositionConflicts ?? {};
    const previouslyResolved = { ...storedPicks, ...parsePreviouslyResolvedCompositionConflicts(req.body ?? {}) };
    // Commented out (owner): the old conflict strategies are replaced by the Resolve Conflicts screen.
    // const newStrategyChoices = parseCompositionStrategyChoices(req.body ?? {});

    let resolvedCompositionConflicts = previouslyResolved;
    // let strategyError: string | undefined;
    // const strategyNotes: string[] = [];
    // if (Object.keys(newStrategyChoices).length > 0) {
    //   const firstPass = await previewCommissioningValidation({ selections, resolvedParameterOverrides, resolvedCompositionConflicts: previouslyResolved, viewerTenantId });
    //   const sourceSelections = parseCompositionSourceSelections(req.body ?? {});
    //   const newlyResolved: Record<string, unknown> = {};
    //   for (const [propertyName, strategy] of Object.entries(newStrategyChoices)) {
    //     const conflict = firstPass.compositionConflicts.find((c) => c.propertyName === propertyName);
    //     if (!conflict) continue;
    //     const applied = applyConflictStrategy(conflict, strategy, {
    //       checkedSourceIds: sourceSelections.checked[propertyName] ?? [],
    //       baseSourceId: sourceSelections.base[propertyName],
    //     });
    //     if (applied.ok) {
    //       if (applied.value !== undefined) newlyResolved[propertyName] = applied.value;
    //       if (applied.note) strategyNotes.push(`${propertyName}: ${applied.note}`);
    //     } else {
    //       strategyError = applied.error;
    //     }
    //   }
    //   resolvedCompositionConflicts = { ...previouslyResolved, ...newlyResolved };
    // }

    // A pick on the Resolve Conflicts screen is checked against the open conflict it is for, then stored under that conflict's key.
    const newPick = parseEbmConflictPick(req.body ?? {});
    if (newPick) {
      const beforePick = await previewCommissioningValidation({ selections, resolvedParameterOverrides, resolvedCompositionConflicts, viewerTenantId });
      const applied = applyConflictPick(beforePick.ebmConflicts, newPick.key, newPick.pick);
      if (!applied.ok) return redirects.seu.objectivesComposeEbm.error(req, res, applied.error, resolveConflictsUrl(objectiveId, req.body ?? {}));
      resolvedCompositionConflicts = { ...resolvedCompositionConflicts, [applied.key]: applied.value };
    }

    // The picks of a table shown as rows are checked one by one against the conflicts they are for, then stored together.
    if (req.body?.ebmBulkKey !== undefined) {
      const bulkPicks = parseEbmBulkPicks(req.body ?? {});
      if (bulkPicks.length === 0) return redirects.seu.objectivesComposeEbm.error(req, res, "Choose Include or Exclude for at least one row.", resolveConflictsUrl(objectiveId, req.body ?? {}));
      const beforeBulk = await previewCommissioningValidation({ selections, resolvedParameterOverrides, resolvedCompositionConflicts, viewerTenantId });
      for (const bulk of bulkPicks) {
        const applied = applyConflictPick(beforeBulk.ebmConflicts, bulk.key, bulk.pick);
        if (!applied.ok) return redirects.seu.objectivesComposeEbm.error(req, res, applied.error, resolveConflictsUrl(objectiveId, req.body ?? {}));
        resolvedCompositionConflicts = { ...resolvedCompositionConflicts, [applied.key]: applied.value };
      }
    }

    const { compositionReport, composedPacks, profileDetails, ebmConflicts, recordedConflicts, settled } = await previewCommissioningValidation({ selections, resolvedParameterOverrides, resolvedCompositionConflicts, viewerTenantId });
    await seusDB.setCompositionReport(existingSeu.id, { selections, compositionReport, composedPacks, profileDetails, resolvedParameterOverrides, ebmConflicts, recordedConflicts, settled, resolvedCompositionConflicts });
    if (blockingEbmConflicts(ebmConflicts).length === 0) {
      const actorId = requireActorId(req);
      const authorBadge = await resolveAuthorBadgeForRequest(req);
      await eventBus.publish({
        eventType: "CompositionCompleted",
        originatingObjectType: "SEU",
        originatingObjectId: existingSeu.id,
        seuId: existingSeu.id,
        correlationId: eventBus.newCorrelationId(),
        payload: { seuId: existingSeu.id, authorBadge },
        actorId,
        authorityBadge: authorBadge,
      });
    }
    // Commented out (owner): the old conflict strategies are replaced by the Resolve Conflicts screen.
    // if (strategyError) return redirects.seu.objectivesComposeEbm.error(req, res, strategyError);
    // if (strategyNotes.length) return redirects.seu.objectivesComposeEbm.success(req, res, strategyNotes.join(" · "));
    // A composition with no open conflict is complete. The EBM page carries the next transitions of the EBM.
    if (blockingEbmConflicts(ebmConflicts).length === 0) return redirects.seu.objectivesComposeEbm.success(req, res, "No conflict is open. The EBM is being composed. Wait for the page to refresh.", `/aisworg/seu/seus/${existingSeu.id}/ebm?composing=1`);
    if (req.body?.returnTo === "resolve-conflicts") return res.redirect(resolveConflictsUrl(objectiveId, req.body ?? {}));
    return res.redirect(`/aisworg/seu/objectives/${objectiveId}/compose-ebm`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/compose-ebm error", err as Error);
    return redirects.seu.objectivesComposeEbm.error(req, res, (err as Error).message);
  }
});

router.get("/objectives/:id/validate-commission", attachVM("seu/seus/validate"), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { data: seu } = await seusDB.findByObjectiveId(objectiveId);
  if (!seu) {
    return redirects.seu.objectivesValidateCommission.error(req, res, "Nothing to validate — choose a Template/Profile selection first.");
  }

  const { data: events } = await eventsDB.findByOriginatingObject("SEU", seu.id);
  const validatedEvent = (events ?? []).filter((e) => e.event_type === "CommissionValidated").sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).pop();
  const failedEvent = (events ?? []).filter((e) => e.event_type === "CommissionFailed").sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).pop();
  const failedPayload = failedEvent?.payload as { stage?: string; reason?: string; references?: string[]; checks?: LivenessCheck[] } | undefined;
  const validatedPayload = validatedEvent?.payload as { checks?: LivenessCheck[] } | undefined;
  const failed = failedPayload?.stage === "validate_request";
  const failureReason = failed ? (failedPayload!.references?.length ? `${failedPayload!.reason ?? "validation failed"}: ${failedPayload!.references!.join("; ")}` : (failedPayload!.reason ?? "validation failed")) : null;
  const passed = !!validatedEvent && !failed;
  const checks: LivenessCheck[] = (failed ? failedPayload?.checks : validatedPayload?.checks) ?? [];

  req.vm.req.title = "Commission Validation";
  req.vm.req.objectiveId = objectiveId;
  req.vm.req.seu = seu;
  req.vm.req.pending = !passed && !failed;
  req.vm.req.failed = failed;
  req.vm.req.failureReason = failureReason;
  req.vm.req.passed = passed;
  req.vm.req.checks = checks;
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/seus/validate", req.vm);
});

router.get("/objectives/:id/compose-ebm", attachVM("seu/seus/compose"), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { data: seu } = await seusDB.findByObjectiveId(objectiveId);
  if (!seu) {
    return redirects.seu.objectivesComposeEbm.error(req, res, "Nothing to compose — choose a Template/Profile selection first.", `/aisworg/seu/seus/new?objectiveId=${objectiveId}`);
  }
  const stashed = seu.composition_report as {
    selections: Array<{ templateId: string; profileId?: string }>;
    compositionReport: EbmCompositionReport;
    composedPacks?: EbmComposedPack[];
    profileDetails?: ProfileDetail[];
    resolvedParameterOverrides?: Record<string, string>;
    // Commented out (owner): the old composition is gone.
    // unraveled?: UnraveledComposition;
    // Commented out (owner): the old conflicts are replaced by ebmConflicts.
    // compositionConflicts?: CompositionConflict[];
    ebmConflicts?: Record<EbmConflictTable, ActionedConflict[]>;
    resolvedCompositionConflicts?: Record<string, unknown>;
  } | null;

  if (seu.active_ebm_id) {
    return res.redirect(`/aisworg/seu/seus/${seu.id}`);
  }

  req.vm.req.title = "Compose EBM";
  req.vm.req.objectiveId = objectiveId;
  req.vm.req.seuId = seu.id;
  req.vm.req.ebmComposed = false;
  req.vm.req.pending = seu.lifecycle_state === SEU_VALIDATED_STATE && !stashed;
  req.vm.req.selections = stashed?.selections ?? [{ templateId: seu.template_id, profileId: seu.profile_id }];
  req.vm.req.compositionReport = stashed?.compositionReport ?? { warnings: [], conflicts: [], parameterConflicts: [], resolutions: [] };
  req.vm.req.composedPacks = stashed?.composedPacks ?? [];
  req.vm.req.profileDetails = stashed?.profileDetails ?? [];
  req.vm.req.resolvedParameterOverrides = stashed?.resolvedParameterOverrides ?? {};
  // Commented out (owner): the old composition is gone.
  // req.vm.req.unraveled = stashed?.unraveled ?? { pool: [] };
  // Commented out (owner): the old conflicts are replaced by the Resolve Conflicts screen.
  // req.vm.req.compositionConflicts = stashed?.compositionConflicts ?? [];
  req.vm.req.ebmConflicts = stashed?.ebmConflicts ?? {};
  req.vm.req.resolvedCompositionConflicts = stashed?.resolvedCompositionConflicts ?? {};
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/seus/compose", req.vm);
});

router.get("/objectives/:id/resolve-conflicts", attachVM("seu/seus/resolve-conflicts"), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { data: seu } = await seusDB.findByObjectiveId(objectiveId);
  if (!seu) return redirects.seu.objectivesResolveConflicts.error(req, res, "Nothing to resolve — compose this SEU first.", `/aisworg/seu/objectives/${objectiveId}/compose-ebm`);
  if (seu.active_ebm_id) return res.redirect(`/aisworg/seu/seus/${seu.id}`);
  const stashed = seu.composition_report as { selections?: Array<{ templateId: string; profileId?: string }>; ebmConflicts?: Partial<Record<EbmConflictTable, ActionedConflict[]>>; settled?: Record<string, { result?: unknown[]; leftOut?: unknown[] }>; resolvedCompositionConflicts?: Record<string, unknown> } | null;
  if (!stashed?.ebmConflicts) return redirects.seu.objectivesResolveConflicts.error(req, res, "Nothing to resolve — compose this SEU first.", `/aisworg/seu/objectives/${objectiveId}/compose-ebm`);

  const tabs = summariseConflictTables(stashed.ebmConflicts).map((t) => ({ ...t, label: CONFLICT_TABLE_LABELS[t.table] ?? t.table }));
  const requested = typeof req.query.category === "string" ? req.query.category : "";
  const selectedTable = (tabs.find((t) => t.table === requested) ?? tabs.find((t) => t.open > 0) ?? tabs[0]).table;
  // A table of rows is sorted by key so a row keeps its place after it is decided. The cards are sorted by status, open first.
  const params = parseListParams(req.query, { sortable: ["status", "key", "kind", "pack"], defaultSort: CONFLICT_TABLES_SHOWN_AS_TABLE.includes(selectedTable) ? "pack" : "status", defaultDir: "asc" });
  const statusOrder: Record<string, number> = { open: 0, notice: 1, resolved: 2 };
  const paginated = paginateList(stashed.ebmConflicts[selectedTable as EbmConflictTable] ?? [], params, {
    searchFields: [(c) => c.message, (c) => c.key, (c) => c.kind],
    sortFields: { status: (c) => statusOrder[conflictStatus(c)], key: (c) => c.key, kind: (c) => c.kind, pack: (c) => `${c.options[0]?.sourceLabel ?? ""}\u0000${c.key}` },
  });

  req.vm.req.title = "Resolve Conflicts";
  req.vm.req.objectiveId = objectiveId;
  req.vm.req.selections = stashed.selections ?? [{ templateId: seu.template_id, profileId: seu.profile_id }];
  req.vm.req.tabs = tabs;
  req.vm.req.settledResult = stashed.settled?.[selectedTable]?.result ?? [];
  req.vm.req.leftOut = stashed.settled?.[selectedTable]?.leftOut ?? [];

  req.vm.req.selectedTable = selectedTable;
  req.vm.req.list = { ...paginated, category: selectedTable };
  // The Capabilities named in the options of the listed conflicts, so the page shows each one's name and opens its definition.
  const capabilityCodes = new Set<string>();
  for (const c of paginated.items) for (const o of c.options) { const code = (o.value as { capabilityCode?: unknown } | null)?.capabilityCode; if (typeof code === "string") capabilityCodes.add(code); }
  const capabilityViewerTenantId = req.session?.user?.tenant_id ?? (await getPlatformTenantId());
  const capabilityInfo: Record<string, { id: string; name: string; description: string; category: string; version: string }> = {};
  for (const code of capabilityCodes) {
    const { data: definition } = await capabilityDefinitionsDB.findActiveByCodeVisibleTo(code, capabilityViewerTenantId);
    if (definition) capabilityInfo[code] = { id: definition.id, name: definition.default_label, description: definition.description ?? "", category: definition.category, version: definition.version };
  }
  req.vm.opt.capabilityInfo = capabilityInfo;
  // The version of each Pack named in the listed conflicts, so the rows can be grouped under their Pack and its version.
  const packVersions: Record<string, string> = {};
  for (const c of paginated.items) {
    for (const o of c.options) {
      if (o.sourceKind !== "pack" || !o.sourceId || packVersions[o.sourceId]) continue;
      const { data: pack } = await packsDB.findById(o.sourceId);
      if (pack) packVersions[o.sourceId] = pack.pack_version;
    }
  }
  req.vm.opt.packVersions = packVersions;
  req.vm.opt.resultLinks = await resolveResultLinks(selectedTable, (stashed.settled?.[selectedTable]?.result ?? []) as Array<Record<string, unknown>>, capabilityViewerTenantId);
  req.vm.opt.cells = resultCells;
  req.vm.opt.comparedKinds = CONFLICT_KINDS_SHOWN_AS_COMPARISON;
  req.vm.opt.asTable = CONFLICT_TABLES_SHOWN_AS_TABLE.includes(selectedTable);
  req.vm.opt.resultColumns = CONFLICT_RESULT_COLUMNS[selectedTable] ?? [];
  req.vm.opt.resultGroupBy = CONFLICT_RESULT_GROUP_BY[selectedTable] ?? [];
  req.vm.opt.listBasePath = `/aisworg/seu/objectives/${objectiveId}/resolve-conflicts`;
  req.vm.opt.seuId = seu.id;
  req.vm.opt.allResolved = tabs.every((t) => t.open === 0);
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/seus/resolve-conflicts", req.vm);
});

// Commented out (owner): dead code, no view posts to it. Kept for reference.
// router.post("/objectives/:id/commission", async (req: Request, res: Response) => {
//   const objectiveId = String(req.params.id);
//   const selections = parseTemplateProfileSelections(req.body ?? {});
//   const resolvedParameterOverrides = parseResolvedParameterOverrides(req.body ?? {});
//
//   if (selections.length === 0) {
//     return redirects.seu.objectivesCommission.error(req, res, "Choose at least one Template/Profile to commission against.");
//   }
//   if (selections.length > 1) {
//     return redirects.seu.objectivesCommission.error(req, res, "Only one Profile may be selected.");
//   }
//
//   try {
//     const resolvedCompositionConflicts = parsePreviouslyResolvedCompositionConflicts(req.body ?? {});
//     const result = await commissionFromExistingObjective({
//       objectiveId,
//       selections,
//       resolvedParameterOverrides,
//       resolvedCompositionConflicts,
//       actorId: requireActorId(req),
//       requestedBy:requireActorId(req),
//     });
//     if (!result.ok) {
//       return redirects.seu.objectivesCommission.error(req, res, `Commissioning failed at "${result.stage}": ${result.reason}`);
//     }
//     return redirects.seu.objectivesCommission.success(req, res, `Commissioning request validated — composing the Engineering Behavior Model. Check back on this SEU to validate and activate it once composed.`, `/aisworg/seu/seus/${result.seu.id}`);
//   } catch (err) {
//     logger.error("[web/seu/objectives] POST /objectives/:id/commission error", err as Error);
//     return redirects.seu.objectivesCommission.error(req, res, (err as Error).message);
//   }
// });

router.post("/objectives/:id/comments", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { comment } = req.body ?? {};
  try {
    if (typeof comment !== "string" || !comment.trim()) return redirects.seu.objectivesComments.error(req, res, "Comment text is required.");

    const { actorId, authorBadge } = await resolveActorAndBadge(req);
    const { error } = await objectivesDB.addComment(objectiveId, { text: comment.trim(), actorId, authorityBadge: authorBadge });
    if (error) throw error;
    return redirects.seu.objectivesComments.success(req, res, "Comment added.");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/comments error", err as Error);
    return redirects.seu.objectivesComments.error(req, res, (err as Error).message);
  }
});

export { router };
