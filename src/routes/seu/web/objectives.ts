import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess, stashFormInput, takeFormInput } from "../../../utils/flash.js";
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
  submitObjective,
  transitionObjective,
  updateObjective,
} from "../core/objectives.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { parseListParams, paginateList, listResult } from "../../../utils/listQuery.js";
import { commissionFromExistingObjective, previewCommissioningValidation, applyConflictStrategy } from "../core/commissioning.js";
import type { LivenessCheck } from "../core/commissioning.js";
import type { ProfileDetail } from "../core/profiles.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { listConceptsForType } from "../core/ontology.js";
import type { ObjectiveStatus, ObjectiveTier, EbmCompositionReport, EbmComposedPack } from "../../../dblayer/seuTypes.js";
import type { UnraveledComposition, CompositionConflict } from "../../../domain/engine/profileCompositionUnravel.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { resolveHeldBadges, resolveAuthorBadge } from "../../../domain/identity/heldBadges.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { getPlatformTenantId, PLATFORM_TENANT_NAME } from "../../../dblayer/constants.js";
 
const CHILD_TIERS: Record<ObjectiveTier, ObjectiveTier[]> = {
  Strategic: ["Operational", "Engineering"],
  Operational: ["Engineering"],
  Engineering: [],
};

async function getObjectiveViewerContext(req: Request): Promise<{ isRoot: boolean; tenantId: string | null; canRetireObjective: boolean; canProposeObjective: boolean; canComment: boolean; hasObjectiveBadge: (verb: string | null) => boolean }> {
  const held = await resolveHeldBadges(req);
  const hasObjectiveBadge = (verb: string | null): boolean => held.isRoot || (!!verb && held.badgeTypes.has(`objective_${verb}`));
  return {
    isRoot: held.isRoot,
    tenantId: req.session?.user?.tenant_id ?? null,
    canRetireObjective: hasObjectiveBadge("retire"),
    canProposeObjective: held.has("objective_propose"),
    canComment: held.isRoot || [...held.badgeTypes].some((b) => b.startsWith("objective_")),
    hasObjectiveBadge,
  };
}

router.param(
  "id",
  requireTenantScope.forParam("id", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
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

    const { isRoot, tenantId, canRetireObjective, canProposeObjective, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    req.vm.req.canRetireObjective = canRetireObjective;
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
    const { canRetireObjective, canProposeObjective, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    return res.render("seu/objectives/_nodes", { nodes, depth, csrfToken: res.locals.csrfToken, childTiers: CHILD_TIERS, canRetireObjective, canProposeObjective, hasObjectiveBadge });
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id/children error", err as Error);
    next(err);
  }
});

router.get(
  "/objectives/new",
  requireTenantScope.forField("query", "parent", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
    notFoundMessage: "Parent Objective not found.",
  }),
  requireTenantScope.forField("query", "supersedes", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
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
      if (!data) return flashError(req, res, "/aisworg/seu/objectives", "Parent Objective not found.");
      parent = data;
      const requested = req.query.tier as ObjectiveTier | undefined;
      const allowed = CHILD_TIERS[data.tier];
      if (!requested || !allowed.includes(requested)) {
        return flashError(req, res, `/aisworg/seu/objectives/${parentId}`, `A ${data.tier} Objective can only add: ${allowed.join(", ") || "no"} children.`);
      }
      tier = requested;
    }

    const supersedesId = typeof req.query.supersedes === "string" && req.query.supersedes.trim() ? req.query.supersedes.trim() : null;
    const supersedesObjective = supersedesId ? (await objectivesDB.findById(supersedesId)).data ?? null : null;
    if (supersedesId && !supersedesObjective) {
      return flashError(req, res, "/aisworg/seu/objectives", "Objective to supersede not found.");
    }

    const { isRoot, tenantId } = await getObjectiveViewerContext(req);
    const capabilities = (await listConceptsForType("capability-name", { isRoot, tenantId }, false))
      .map((c) => ({ code: c.code, name: c.default_label, description: c.description }));
    req.vm.req.title = `New ${tier} Objective`;
    req.vm.req.supersedesObjective = supersedesObjective;
    req.vm.req.capabilities = capabilities;
    req.vm.req.parent = parent;
    req.vm.req.tier = tier;
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
    notFoundRedirect: "/aisworg/seu/objectives",
    notFoundMessage: "Parent Objective not found.",
  }),
  requireTenantScope.forField("body", "supersedes", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
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
    return flashError(req, res, backToNew, "Supersede requires a comment explaining the supersession.");
  }

  if (typeof statement !== "string" || !statement.trim() || codes.length === 0) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return flashError(req, res, backToNew, "Statement and at least one required Capability are required.");
  }

  if (req.session?.user?.id == null) {
    return flashError(req, res, backToNew, "You must be logged in to create an Objective.");
  }

  try {
    const { objective } = await createObjective({
      statement,
      requiredCapabilityCodes: codes,
      tier: (tier || undefined) as ObjectiveTier | undefined,
      status: "Proposed",
      parentObjectiveId: parentId,
      requestedBy: String(req.session.user.id),
    });

    if (supersedesId) {
      const result = await transitionObjective({
        objectiveId: supersedesId,
        targetState: "Superseded",
        actorRole: req.session?.user?.role ?? "general",
        actorId: String(req.session.user.id),
        comment: supersedeComment,
        supersedingObjectiveId: objective.id,
      });
      if (!result.ok) {
        const detail = "detail" in result ? result.detail : result.reason;
        return flashError(req, res, `/aisworg/seu/objectives/${objective.id}`, `Objective created, but superseding the original was blocked: ${detail}`);
      }
    }

    return flashSuccess(req, res, "/aisworg/seu/objectives", `Objective created as Proposed. Activate it before commissioning an SEU against it.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives error", err as Error);
    return flashError(req, res, backToNew, (err as Error).message);
  }
});

router.get("/objectives/:id", attachVM("seu/objectives/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const detail = await getObjectiveDetail(id);
    if (!detail) return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
    req.vm.req.title = `Objective ${detail.objective.display_id ?? detail.objective.id.slice(0, 8)}`;
    const { canRetireObjective, canProposeObjective, canComment, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    detail.possibleNextStates = detail.possibleNextStates.filter((s) => hasObjectiveBadge(detail.possibleTransitionVerbs[s]));
    req.vm.req.detail = detail;
    req.vm.req.childTiers = CHILD_TIERS[detail.objective.tier];
    req.vm.req.reParentOptions = detail.objective.tier === "Strategic" ? [] : await listReParentCandidates(id);
    req.vm.req.canRetireObjective = canRetireObjective;
    req.vm.req.canProposeObjective = canProposeObjective;
    req.vm.req.canRejectObjective = hasObjectiveBadge("reject");
    req.vm.req.canSupersedeObjective = hasObjectiveBadge("supersede");
    req.vm.req.canComment = canComment;
    req.vm.req.canSubmitObjective = hasObjectiveBadge(detail.submitVerb);
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
    if (!objective) return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
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
    const { data: comments } = await objectivesDB.getComments(id);
    req.vm.req.comments = comments ?? [];
    req.vm.req.canComment = canComment;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/edit", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id/edit error", err as Error);
    next(err);
  }
});

router.post("/objectives/:id/submit", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  try {
    if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }

    await submitObjective(objectiveId, String(req.session.user.id));
    return flashSuccess(req, res, backTo, "Submitted — awaiting the next transition.");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/submit error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/objectives/:id/update", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}/edit`;
  const { statement, requiredCapabilityCodes, action } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];
  const bumpVersion = action !== "save_no_version";

  if (codes.length === 0) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return flashError(req, res, backTo, "At least one required Capability is required.");
  }
  if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }
  try {
    const updated = await updateObjective(objectiveId, {
      statement: typeof statement === "string" && statement.trim() ? statement : undefined,
      requiredCapabilityCodes: codes,
      requestedBy: String(req.session.user.id),
      bumpVersion,
    });
    const msg = bumpVersion ? `Objective updated to v${updated.version}.` : `Objective updated (still v${updated.version}).`;
    return flashSuccess(req, res, "/aisworg/seu/objectives", msg);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/update error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/objectives/:id/move", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  const { newParentId } = req.body ?? {};

  try {
    await reParentObjective(objectiveId, typeof newParentId === "string" && newParentId.trim() ? newParentId : null);
    return flashSuccess(req, res, backTo, `Objective moved.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/move error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/objectives/:id/delete", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  try {
    const detail = await getObjectiveDetail(objectiveId);
    const parentId = detail?.parent?.id ?? null;
    await deleteObjective(objectiveId);
    const backTo = parentId ? `/aisworg/seu/objectives/${parentId}` : "/aisworg/seu/objectives";
    return flashSuccess(req, res, backTo, "Objective deleted.");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/delete error", err as Error);
    return flashError(req, res, `/aisworg/seu/objectives/${objectiveId}`, (err as Error).message);
  }
});

router.post("/objectives/:id/retire", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }

  try {
    const { retired, skipped } = await retireObjectiveSubtree({
      objectiveId,
      actorRole: req.session?.user?.role ?? "general",
      actorId: String(req.session.user.id),
    });
    const msg = skipped.length
      ? `Retired ${retired.length} Objective(s); skipped ${skipped.length} (not Active).`
      : `Retired ${retired.length} Objective(s).`;
    return flashSuccess(req, res, backTo, msg);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/retire error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

function postObjectiveTransition(targetState: ObjectiveStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    const objectiveId = String(req.params.id);
    const backTo = `/aisworg/seu/objectives/${objectiveId}`;
    const { comment, supersedingObjectiveId } = req.body ?? {};
    if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }

    try {
      const result = await transitionObjective({
        objectiveId,
        targetState,
        actorRole: req.session?.user?.role ?? "general",
        actorId: String(req.session.user.id),
        comment: typeof comment === "string" ? comment : undefined,
        supersedingObjectiveId: typeof supersedingObjectiveId === "string" && supersedingObjectiveId ? supersedingObjectiveId : undefined,
      });
      if (!result.ok) {
        const detail = "detail" in result ? result.detail : result.reason;
        flashError(req, res, backTo, `Transition blocked: ${detail}`);
        return;
      }
      flashSuccess(req, res, backTo, `Objective moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
    } catch (err) {
      logger.error(`[web/seu/objectives] POST /objectives/:id/transition/${targetState} error`, err as Error);
      flashError(req, res, backTo, (err as Error).message);
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

router.post("/objectives/:id/validate-commission", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/new?objectiveId=${objectiveId}`;
  const selections = parseTemplateProfileSelections(req.body ?? {});
  const resolvedParameterOverrides = parseResolvedParameterOverrides(req.body ?? {});

  if (selections.length === 0) {
    return flashError(req, res, backTo, "Choose at least one Template/Profile to validate.");
  }
  if (selections.length > 1) {
    return flashError(req, res, backTo, "Only one Profile may be selected.");
  }

  try {
    const viewerTenantId = req.session?.user?.tenant_id ?? (await getPlatformTenantId());

    const selection = selections[0];
    const { data: objective } = await objectivesDB.findById(objectiveId);
    if (!objective) return flashError(req, res, backTo, "Objective not found.");
    const { data: existingSeu } = await seusDB.findByObjectiveId(objectiveId);
    if (existingSeu) {
      return res.redirect("/aisworg/seu/seus");
    }
    if (!selection.profileId) {
      return flashError(req, res, backTo, "No Profile chosen — a real Profile must be selected before commissioning.");
    }
    const profileId = selection.profileId;
    let seuTenantId = objective.sponsoring_authority?.tenant ?? null;
    if (!seuTenantId) {
      const { data: defaultTenant } = await tenantsDB.findDefault();
      seuTenantId = defaultTenant?.id ?? null;
    }
    if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }
    const { data: newSeu, error: seuErr } = await seusDB.create({
      objectiveId,
      templateId: selection.templateId,
      profileId,
      requestedBy: String(req.session.user.id),
      tenantId: seuTenantId,
    });
    if (seuErr || !newSeu) return flashError(req, res, backTo, (seuErr ?? new Error("failed to create SEU")).message);
    await eventBus.publish({
      eventType: "CommissionRequested",
      originatingObjectType: "SEU",
      originatingObjectId: newSeu.id,
      seuId: newSeu.id,
      correlationId: eventBus.newCorrelationId(),
      payload: { seuId: newSeu.id },
      actorId: String(req.session.user.id),
      authorityBadge: "seu_commission",
    });
    req.session.flash = { type: "success", message: "Commissioning queued — validating…" };
    return res.redirect("/aisworg/seu/seus");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/validate-commission error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/objectives/:id/compose-ebm", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}/compose-ebm`;
  const selections = parseTemplateProfileSelections(req.body ?? {});
  const resolvedParameterOverrides = parseResolvedParameterOverrides(req.body ?? {});
  if (selections.length === 0) return flashError(req, res, backTo, "Nothing to re-validate.");

  try {
    const viewerTenantId = req.session?.user?.tenant_id ?? (await getPlatformTenantId());
    const { data: existingSeu } = await seusDB.findByObjectiveId(objectiveId);
    if (!existingSeu) return flashError(req, res, backTo, "No SEU found for this Objective.");

    const previouslyResolved = parsePreviouslyResolvedCompositionConflicts(req.body ?? {});
    const newStrategyChoices = parseCompositionStrategyChoices(req.body ?? {});

    let resolvedCompositionConflicts = previouslyResolved;
    let strategyError: string | undefined;
    const strategyNotes: string[] = [];
    if (Object.keys(newStrategyChoices).length > 0) {
      const firstPass = await previewCommissioningValidation({ selections, resolvedParameterOverrides, resolvedCompositionConflicts: previouslyResolved, viewerTenantId });
      const sourceSelections = parseCompositionSourceSelections(req.body ?? {});
      const newlyResolved: Record<string, unknown> = {};
      for (const [propertyName, strategy] of Object.entries(newStrategyChoices)) {
        const conflict = firstPass.compositionConflicts.find((c) => c.propertyName === propertyName);
        if (!conflict) continue;
        const applied = applyConflictStrategy(conflict, strategy, {
          checkedSourceIds: sourceSelections.checked[propertyName] ?? [],
          baseSourceId: sourceSelections.base[propertyName],
        });
        if (applied.ok) {
          if (applied.value !== undefined) newlyResolved[propertyName] = applied.value;
          if (applied.note) strategyNotes.push(`${propertyName}: ${applied.note}`);
        } else {
          strategyError = applied.error;
        }
      }
      resolvedCompositionConflicts = { ...previouslyResolved, ...newlyResolved };
    }

    const { compositionReport, composedPacks, profileDetails, unraveled, compositionConflicts } = await previewCommissioningValidation({ selections, resolvedParameterOverrides, resolvedCompositionConflicts, viewerTenantId });
    await seusDB.setCompositionReport(existingSeu.id, { selections, compositionReport, composedPacks, profileDetails, resolvedParameterOverrides, unraveled, compositionConflicts, resolvedCompositionConflicts });
    if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }

    if (compositionConflicts.length === 0) {
      const actorId = String(req.session.user.id);
      if (!actorId) return flashError(req, res, backTo, "no acting user to record as this EBM's author — log in first");
      const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
      const held = await resolveHeldBadges(req);
      const authorBadge = resolveAuthorBadge(authRow, held);
      if (!authorBadge) return flashError(req, res, backTo, "no held badge authorises this action — cannot record an author badge");
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
    if (strategyError) {
      req.session.flash = { type: "error", message: strategyError };
    } else if (strategyNotes.length) {
      req.session.flash = { type: "success", message: strategyNotes.join(" · ") };
    }
    return res.redirect(`/aisworg/seu/objectives/${objectiveId}/compose-ebm`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/compose-ebm error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.get("/objectives/:id/validate-commission", attachVM("seu/seus/validate"), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const { data: seu } = await seusDB.findByObjectiveId(objectiveId);
  if (!seu) {
    return flashError(req, res, `/aisworg/seu/seus/new?objectiveId=${objectiveId}`, "Nothing to validate — choose a Template/Profile selection first.");
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
    return flashError(req, res, `/aisworg/seu/seus/new?objectiveId=${objectiveId}`, "Nothing to compose — choose a Template/Profile selection first.");
  }
  const stashed = seu.composition_report as {
    selections: Array<{ templateId: string; profileId?: string }>;
    compositionReport: EbmCompositionReport;
    composedPacks?: EbmComposedPack[];
    profileDetails?: ProfileDetail[];
    resolvedParameterOverrides?: Record<string, string>;
    unraveled?: UnraveledComposition;
    compositionConflicts?: CompositionConflict[];
    resolvedCompositionConflicts?: Record<string, unknown>;
  } | null;

  if (seu.active_ebm_id) {
    return res.redirect(`/aisworg/seu/seus/${seu.id}`);
  }

  req.vm.req.title = "Compose EBM";
  req.vm.req.objectiveId = objectiveId;
  req.vm.req.seuId = seu.id;
  req.vm.req.ebmComposed = false;
  req.vm.req.pending = seu.lifecycle_state === "Pending" && !stashed;
  req.vm.req.selections = stashed?.selections ?? [{ templateId: seu.template_id, profileId: seu.profile_id }];
  req.vm.req.compositionReport = stashed?.compositionReport ?? { warnings: [], conflicts: [], parameterConflicts: [], resolutions: [] };
  req.vm.req.composedPacks = stashed?.composedPacks ?? [];
  req.vm.req.profileDetails = stashed?.profileDetails ?? [];
  req.vm.req.resolvedParameterOverrides = stashed?.resolvedParameterOverrides ?? {};
  req.vm.req.unraveled = stashed?.unraveled ?? { pool: [] };
  req.vm.req.compositionConflicts = stashed?.compositionConflicts ?? [];
  req.vm.req.resolvedCompositionConflicts = stashed?.resolvedCompositionConflicts ?? {};
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/seus/compose", req.vm);
});

router.post("/objectives/:id/commission", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/new?objectiveId=${objectiveId}`;
  const selections = parseTemplateProfileSelections(req.body ?? {});
  const resolvedParameterOverrides = parseResolvedParameterOverrides(req.body ?? {});

  if (selections.length === 0) {
    return flashError(req, res, backTo, "Choose at least one Template/Profile to commission against.");
  }
  if (selections.length > 1) {
    return flashError(req, res, backTo, "Only one Profile may be selected.");
  }

  try {
    const resolvedCompositionConflicts = parsePreviouslyResolvedCompositionConflicts(req.body ?? {});
    if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }

    const result = await commissionFromExistingObjective({
      objectiveId,
      selections,
      resolvedParameterOverrides,
      resolvedCompositionConflicts,
      actorRole: "general",
      actorId: String(req.session.user.id),
      requestedBy:String(req.session.user.id),
    });
    if (!result.ok) {
      return flashError(req, res, backTo, `Commissioning failed at "${result.stage}": ${result.reason}`);
    }
    return flashSuccess(req, res, `/aisworg/seu/seus/${result.seu.id}`, `Commissioning request validated — composing the Engineering Behavior Model. Check back on this SEU to validate and activate it once composed.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/commission error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

router.post("/objectives/:id/comments", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}/edit`;
  const { comment } = req.body ?? {};
  if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }
  try {
    const { canComment } = await getObjectiveViewerContext(req);
    if (!canComment) return flashError(req, res, backTo, "You don't hold a badge for this Objective.");
    if (typeof comment !== "string" || !comment.trim()) return flashError(req, res, backTo, "Comment text is required.");

    const { error } = await objectivesDB.addComment(objectiveId, String(req.session.user.id), comment.trim());
    if (error) throw error;
    return flashSuccess(req, res, backTo, "Comment added.");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/comments error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
