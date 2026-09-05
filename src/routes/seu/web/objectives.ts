import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess, stashFormInput, takeFormInput } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
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
import { commissionFromExistingObjective } from "../core/commissioning.js";
import { listConceptsForType } from "../core/ontology.js";
import type { ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { resolveHeldBadges } from "../../../domain/identity/heldBadges.js";

// Which child tiers a node of a given tier may contextually add (the buttons the
// tree offers). Strategic is only ever created from the empty/root affordance.
const CHILD_TIERS: Record<ObjectiveTier, ObjectiveTier[]> = {
  Strategic: ["Operational", "Engineering"],
  Operational: ["Engineering"],
  Engineering: [],
};

// requireBadge's own redirectTo for every :id-scoped route on this router —
// back to the Objective's detail page, matching what each route's own
// pre-CR-076 inline check redirected to (backTo) wherever one existed.
const toDetailPage = (req: Request): string => `/aisworg/seu/objectives/${req.params.id}`;
const toEditPage = (req: Request): string => `/aisworg/seu/objectives/${req.params.id}/edit`;

// CR-071 — corrected: session.user.platformBadges structurally can never
// hold a noun_verb badge. getPlatformBadges (domain/identity/badgeBootstrap.ts)
// only keeps a grant whose badge type resolves to scope_kind "None" via the
// badge_types catalog table — which has exactly 3 rows (root, tenant_admin,
// viewer). A noun_verb badge like objective_propose/objective_retire has no
// badge_types row at all, so it resolves to an empty scope_kind, fails that
// check, and is silently dropped — for every user, always, not a bug in this
// file. Confirmed this is the established pattern for a noun_verb badge too:
// web/packs.ts's own "Copy" button (gated on pack_define) already uses a
// live badgeAuthorityEngine-backed check, never platformBadges, for exactly
// this reason.
//
// Fix: one live query per page load — badgeGrantsDB.findActiveForHolder,
// same table badgeAuthorityEngine.authorise itself reads — cached in a Set
// for that single request and checked in-memory for as many rows as needed.
// O(1) per page, not O(n) per button, so it still respects "no live
// per-button check" (owner: "that will be too expensive") while actually
// working for a real noun_verb badge. root still bypasses via
// platformBadges (root genuinely does have a "None"-scope badge_types row,
// so that part of the original mechanism was always correct).
//
// Each governed Objective action needs its own specific noun_verb badge —
// transitionEngine's real convention is `${entityType.toLowerCase()}_${verb}`
// (transitionEngine.ts:74), NOT one flat code. Confirmed directly against
// transition_definitions.verb: Objective's own transitions are
// activate/achieve/retire/supersede/archive — 5 distinct badges, not one.
// Retire specifically needs objective_retire. Delete isn't a governed
// transition at all (deleteObjective itself calls no transitionEngine check —
// CR-071's own "gap today" section) — CR-076 closed the route-level half of
// that gap with a real requireBadge(['objective_propose']) on the route
// itself; deleteObjective's own lack of a core-level check is unchanged.
async function getObjectiveViewerContext(req: Request): Promise<{ isRoot: boolean; tenantId: string | null; canRetireObjective: boolean; canProposeObjective: boolean; canComment: boolean; hasObjectiveBadge: (verb: string | null) => boolean }> {
  // CR-076 — the query/Set/root-check itself is now the one shared primitive
  // (domain/identity/heldBadges.ts); this function only derives the
  // page-specific booleans/closure Objectives pages actually render with.
  const held = await resolveHeldBadges(req);
  const hasObjectiveBadge = (verb: string | null): boolean => held.isRoot || (!!verb && held.badgeTypes.has(`objective_${verb}`));
  return {
    isRoot: held.isRoot,
    tenantId: req.session?.user?.tenant_id ?? null,
    canRetireObjective: hasObjectiveBadge("retire"),
    canProposeObjective: held.has("objective_propose"),
    // CR-073 — comments are general-purpose, gated to "holds at least one
    // objective_* badge" (owner: "Only badge holders"), not open to every
    // authenticated viewer. This is an OR-across-a-family requirement, which
    // doesn't fit requireBadge's AND-only array shape (CR-076) — kept as its
    // own inline check on the comments route rather than forced into it.
    canComment: held.isRoot || [...held.badgeTypes].some((b) => b.startsWith("objective_")),
    hasObjectiveBadge,
  };
}

// Tenant reach gate — a single check covering every /objectives/:id* route on
// this router (view, edit, children, submit, update, move, delete, retire,
// transition, commission). §18.11's own design is "isolation applied once at
// the root"; the list/search routes already filter by tenant, but a direct
// request naming an id bypassed that entirely. A non-root actor whose tenant
// doesn't match the Objective's own sponsoring_authority gets the same
// "Objective not found" response a genuinely missing id gets — never a 403,
// so this never confirms another tenant's Objective even exists. Mirrors
// objectivesDB.findAll/findRootsPage's own "NULL never matches" fail-closed
// rule: a legacy row with no sponsoring_authority yet (predates CR-071) is
// only visible to root, same as it already is in the list/search views.
router.param(
  "id",
  requireTenantScope.forParam("id", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
    notFoundMessage: "Objective not found.",
  })
);

/**
 * GET /aisworg/seu/objectives — CR-009 tree. Browse mode (no ?q) paginates the
 * Strategic roots, each expandable to lazy-load its children. Search mode (?q)
 * returns a flat, paginated hit list, each with its breadcrumb to root.
 */
router.get("/objectives", requireBadge(["None"]), attachVM("seu/objectives/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Objectives";
    const _base = "/aisworg/seu/objectives";
    req.vm.opt.listBasePath = _base;
    req.vm.opt.flash = getFlash(req);

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    // CR-073 — the proposer's "was rejected" filter/section (owner: "not a
    // standalone page") — a third mode on this same route/view, not a new page.
    const rejectedView = req.query.view === "rejected";
    req.vm.req.mode = rejectedView ? "rejected" : q ? "search" : "browse";

    // CR-071 — Sponsoring Authority tenant scoping: root sees every tenant
    // (isRoot -> tenantId filter omitted entirely); everyone else sees only
    // their own tenant's Objectives.
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

/**
 * GET /aisworg/seu/objectives/:id/children — CR-009 lazy expand. Returns just
 * the node-row fragment for the direct children, at the given depth, so the
 * tree can grow one level at a time without shipping the whole forest.
 */
router.get("/objectives/:id/children", requireBadge(["None"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const depth = Math.max(0, Math.min(20, parseInt(String(req.query.depth ?? "1"), 10) || 1));
    const nodes = await getObjectiveChildren(String(req.params.id));
    const { canRetireObjective, canProposeObjective, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    // Rendered directly (a partial fragment, not a registered ViewModel view).
    return res.render("seu/objectives/_nodes", { nodes, depth, csrfToken: res.locals.csrfToken, childTiers: CHILD_TIERS, canRetireObjective, canProposeObjective, hasObjectiveBadge });
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id/children error", err as Error);
    next(err);
  }
});

/**
 * GET /aisworg/seu/objectives/new — CR-009 contextual create. The parent (if
 * any) and the child's tier are fixed by the affordance that led here (?parent,
 * ?tier); no free tier picker. No parent → a Strategic root.
 */
router.get(
  "/objectives/new",
  requireBadge(["objective_propose"], { redirectTo: "/aisworg/seu/objectives", denyMessage: "You don't hold the badge required to add Objectives." }),
  requireTenantScope.forField("query", "parent", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
    notFoundMessage: "Parent Objective not found.",
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

    // CR-086 step 2 — the picker lists capability-name Ontology concepts
    // (code/name/description), not rows from the Pack-instance-scoped
    // `capabilities` table.
    const { isRoot, tenantId } = await getObjectiveViewerContext(req);
    const capabilities = (await listConceptsForType("capability-name", { isRoot, tenantId }, false))
      .map((c) => ({ code: c.code, name: c.default_label, description: c.description }));
    req.vm.req.title = `New ${tier} Objective`;
    req.vm.req.capabilities = capabilities;
    req.vm.req.parent = parent;
    req.vm.req.tier = tier;
    // Which Capabilities start checked, in precedence order:
    //   1. a bounce-back from a failed submit — show exactly what the user had;
    //   2. a child of a parent — CR-009: inherit the parent's required
    //      Capabilities as the default (a child decomposes its parent), which
    //      the user can still adjust before saving;
    //   3. a fresh Strategic root — nothing pre-selected.
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

/** POST /aisworg/seu/objectives — creates in 'Proposed'; tier + parent are fixed by the create context. */
router.post(
  "/objectives",
  requireBadge(["objective_propose"], { redirectTo: "/aisworg/seu/objectives", denyMessage: "You don't hold the badge required to add Objectives." }),
  requireTenantScope.forField("body", "parentObjectiveId", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, {
    notFoundRedirect: "/aisworg/seu/objectives",
    notFoundMessage: "Parent Objective not found.",
  }),
  async (req: Request, res: Response) => {
  const { statement, tier, parentObjectiveId, requiredCapabilityCodes } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];
  const parentId = parentObjectiveId || null;
  const backToNew = `/aisworg/seu/objectives/new${parentId ? `?parent=${parentId}&tier=${tier}` : ""}`;

  if (typeof statement !== "string" || !statement.trim() || codes.length === 0) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return flashError(req, res, backToNew, "Statement and at least one required Capability are required.");
  }

  try {
    const { objective } = await createObjective({
      statement,
      requiredCapabilityCodes: codes,
      tier: (tier || undefined) as ObjectiveTier | undefined,
      status: "Proposed",
      parentObjectiveId: parentId,
      requestedBy: req.session?.user?.id ?? null,
    });
    // CR-075 (owner: "The create strategic objective is not taking me to the
    // list page") — same principle as Edit's Save: the list, not the
    // detail/view page, applied uniformly whether this created a Strategic
    // root or a child (via "Add child" on the parent's Edit page).
    return flashSuccess(req, res, "/aisworg/seu/objectives", `Objective created as Proposed. Activate it before commissioning an SEU against it.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives error", err as Error);
    return flashError(req, res, backToNew, (err as Error).message);
  }
});

/** GET /aisworg/seu/objectives/:id — decomposition, required Capabilities, lifecycle + move actions. */
router.get("/objectives/:id", requireBadge(["None"]), attachVM("seu/objectives/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const detail = await getObjectiveDetail(id);
    if (!detail) return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
    // CR-068: the browser tab title has no HTML/pill rendering, so it gets the
    // plain display id; a legacy row predating this CR (null display_id) falls
    // back to the old UUID-prefix behaviour.
    req.vm.req.title = `Objective ${detail.objective.display_id ?? detail.objective.id.slice(0, 8)}`;
    // CR-071 — filter to only the options this viewer actually holds the
    // specific noun_verb badge for (transitionEngine's own per-verb
    // convention, not one flat code) before the view ever sees them, so
    // detail.ejs's existing possibleNextStates.length check stays correct
    // without needing its own badge-awareness.
    const { canRetireObjective, canProposeObjective, canComment, hasObjectiveBadge } = await getObjectiveViewerContext(req);
    detail.possibleNextStates = detail.possibleNextStates.filter((s) => hasObjectiveBadge(detail.possibleTransitionVerbs[s]));
    req.vm.req.detail = detail;
    req.vm.req.childTiers = CHILD_TIERS[detail.objective.tier];
    // Move parent-picker options — only offered for a non-Strategic node.
    req.vm.req.reParentOptions = detail.objective.tier === "Strategic" ? [] : await listReParentCandidates(id);
    req.vm.req.canRetireObjective = canRetireObjective;
    req.vm.req.canProposeObjective = canProposeObjective;
    // (owner: "The verb for Active->Reject is reject, not activate. ... A
    // verb cannot denote two different transitions") — Reject has its own
    // distinct objective_reject badge (authorityVocabulary.json), not a
    // reuse of Activate's; this is a real transitionEngine authority check
    // (transitionEngine.ts's own verb-derived requiredBadge), so reusing
    // "activate" here would have let anyone who can only Activate a proposal
    // also Reject an unrelated Active Objective.
    req.vm.req.canRejectObjective = hasObjectiveBadge("reject");
    req.vm.req.canComment = canComment;
    // CR-072 — whether this viewer holds the badge for the Submit step
    // defined on the current status (if any) — detail.submitVerb/
    // .alreadySubmitted (getObjectiveDetail) say what's structurally
    // possible; this says whether this specific viewer can act on it.
    req.vm.req.canSubmitObjective = hasObjectiveBadge(detail.submitVerb);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id error", err as Error);
    next(err);
  }
});

/**
 * GET /aisworg/seu/objectives/:id/edit — Edit is not a transition: same
 * objective_propose badge as Delete/Move/Update, now a real requireBadge gate
 * on every one of those routes (CR-076 — update/move/delete previously had no
 * server-side badge check at all, relying only on the list hiding the link).
 * Once locked (submitted for activation), the list simply doesn't show this
 * link (that's the lock's own gate, a separate concern from the badge); this
 * page doesn't separately re-check or hide anything for that — if reached
 * directly anyway, the actual mutations (updateObjective/reParentObjective/
 * createObjective) still refuse for real, with their own clear error.
 * Statement and required Capabilities only; tier is fixed at creation (owner:
 * "Edit should not change the tier. This will cause utter confusion to the
 * hierarchy").
 */
router.get("/objectives/:id/edit", requireBadge(["objective_propose"], { redirectTo: toDetailPage, denyMessage: "You don't hold the badge required to edit Objectives." }), attachVM("seu/objectives/edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { data: objective } = await objectivesDB.findById(id);
    if (!objective) return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
    const { isRoot, tenantId, canComment } = await getObjectiveViewerContext(req);

    // CR-086 step 2 — same Ontology-backed picker as /objectives/new.
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
    // CR-075 — Add child / Move now live here, not on the view page.
    req.vm.req.childTiers = CHILD_TIERS[objective.tier];
    req.vm.req.reParentOptions = objective.tier === "Strategic" ? [] : await listReParentCandidates(id);
    // CR-075 — the comment thread + Post form also moved here, off the view
    // page.
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

/** POST /aisworg/seu/objectives/:id/submit — CR-072: queues a manual transition's from_state without performing it. */
router.post("/objectives/:id/submit", requireBadge(["objective_propose"], { redirectTo: toDetailPage }), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  try {
    await submitObjective(objectiveId, req.session?.user?.id ?? null);
    return flashSuccess(req, res, backTo, "Submitted — awaiting the next transition.");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/submit error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/**
 * POST /aisworg/seu/objectives/:id/update — edits statement + required Capabilities only
 * (tier is not editable). Two submit buttons share this action: `save` bumps the version's
 * patch segment as usual; `save_no_version` (owner: "add a save without versioning. in
 * which case the current version carries over") leaves version untouched.
 */
router.post("/objectives/:id/update", requireBadge(["objective_propose"], { redirectTo: toEditPage }), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}/edit`;
  const { statement, requiredCapabilityCodes, action } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];
  const bumpVersion = action !== "save_no_version";

  if (codes.length === 0) {
    stashFormInput(req, { statement: typeof statement === "string" ? statement : "", requiredCapabilityCodes: codes });
    return flashError(req, res, backTo, "At least one required Capability is required.");
  }

  try {
    const updated = await updateObjective(objectiveId, {
      statement: typeof statement === "string" && statement.trim() ? statement : undefined,
      requiredCapabilityCodes: codes,
      requestedBy: req.session?.user?.id ?? null,
      bumpVersion,
    });
    const msg = bumpVersion ? `Objective updated to v${updated.version}.` : `Objective updated (still v${updated.version}).`;
    // CR-075 (owner: "The Save should take me to the list page") — the list,
    // not the detail/view page; View and Edit are both reachable straight
    // from each list row now, so there's no need to route through the view.
    return flashSuccess(req, res, "/aisworg/seu/objectives", msg);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/update error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/objectives/:id/move — CR-009 re-parent (subtree moves with it). */
router.post("/objectives/:id/move", requireBadge(["objective_propose"], { redirectTo: toEditPage }), async (req: Request, res: Response) => {
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

// CR-076 — closes a gap CR-071 explicitly flagged and left open: Delete was
// gated only by the list hiding its button (objective_propose, "UI-only
// convention, not a new server-side check"); deleteObjective itself never
// called badgeAuthorityEngine. requireBadge is that real server-side check
// now, mandatory the same as every other route on this router.
/** POST /aisworg/seu/objectives/:id/delete — CR-012 hard delete (Proposed leaf only). */
router.post("/objectives/:id/delete", requireBadge(["objective_propose"], { redirectTo: toDetailPage }), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  try {
    // Redirect to the parent (if any) after removal, since the node itself is gone.
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

/** POST /aisworg/seu/objectives/:id/retire — CR-012 governed retire of the node + its Active subtree. */
router.post("/objectives/:id/retire", requireBadge(["objective_retire"], { redirectTo: toDetailPage }), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  try {
    const { retired, skipped } = await retireObjectiveSubtree({
      objectiveId,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
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

// CR-076 (owner: "One function cannot do multiple things requiring different
// badges. They have to be split") — this used to be one route dispatching on
// a body-supplied targetState across 4 different objective_<verb> badges
// (Supersede/Retire/Archive from the generic dropdown, Reject from its own
// mandatory-comment form). Now one route per target, each with its own fixed
// target and its own single requireBadge; postObjectiveTransition is just the
// shared mechanics (call transitionObjective, translate the result to a
// flash) — it doesn't decide authorization, each route's own middleware
// already did that before this ever runs.
function postObjectiveTransition(targetState: ObjectiveStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    const objectiveId = String(req.params.id);
    const backTo = `/aisworg/seu/objectives/${objectiveId}`;
    const { comment } = req.body ?? {};
    try {
      const result = await transitionObjective({
        objectiveId,
        targetState,
        actorRole: req.session?.user?.role ?? "general",
        actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
        comment: typeof comment === "string" ? comment : undefined,
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

/** The direct action a Queue/Submit button unlocks (CR-072) — today only Proposed -> Active (verb "activate"); _nodes.ejs's tree-row button and detail.ejs's dropdown-derived button both post here once alreadySubmitted. */
router.post("/objectives/:id/transition/activate", requireBadge(["objective_activate"], { redirectTo: toDetailPage }), postObjectiveTransition("Active"));
router.post("/objectives/:id/transition/supersede", requireBadge(["objective_supersede"], { redirectTo: toDetailPage }), postObjectiveTransition("Superseded"));
router.post("/objectives/:id/transition/retire", requireBadge(["objective_retire"], { redirectTo: toDetailPage }), postObjectiveTransition("Retired"));
router.post("/objectives/:id/transition/archive", requireBadge(["objective_archive"], { redirectTo: toDetailPage }), postObjectiveTransition("Archived"));
/** Reject requires a genuinely new, non-empty comment every time — enforced in transitionObjective itself, not here. */
router.post("/objectives/:id/transition/reject", requireBadge(["objective_reject"], { redirectTo: toDetailPage }), postObjectiveTransition("Reject"));

/** POST /aisworg/seu/objectives/:id/commission — commission an SEU directly against this (Active, non-Strategic leaf) Objective. Same badge SEU's own Pending -> Commissioned transition requires (transitionEngine.evaluate, called inside commissionFromExistingObjective). */
router.post("/objectives/:id/commission", requireBadge(["seu_commission"], { redirectTo: toDetailPage }), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  const { profileId } = req.body ?? {};

  try {
    const result = await commissionFromExistingObjective({
      objectiveId,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
      requestedBy: req.session?.user?.id ?? null,
      profileId: typeof profileId === "string" && profileId.trim() ? profileId : undefined,
      tenantId: req.session?.user?.tenant_id ?? null,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, `Commissioning failed at "${result.stage}": ${result.reason}`);
    }
    return flashSuccess(req, res, `/aisworg/seu/seus/${result.seu.id}`, `SEU commissioned — lifecycle state: ${result.seu.lifecycle_state}.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/commission error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/**
 * POST /aisworg/seu/objectives/:id/comments — CR-073 general-purpose comment
 * thread (owner: "Only badge holders"), badge-gated server-side, not just a
 * hidden form — any objective_* badge holder (or root) may post at any time,
 * independent of the Objective's current status or any transition.
 *
 * CR-076 — the real requirement is "holds at least one objective_* badge,"
 * an OR across a whole family, which doesn't fit requireBadge's AND-only
 * array shape (settled design). requireBadge(['None']) here is an honest
 * declaration that every authenticated actor reaches the handler; the real,
 * finer check stays the existing inline canComment (unchanged), not
 * papered over as if no check exists.
 */
router.post("/objectives/:id/comments", requireBadge(["None"]), async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  // CR-075 — the Post form now lives on Edit, not the view page.
  const backTo = `/aisworg/seu/objectives/${objectiveId}/edit`;
  const { comment } = req.body ?? {};

  try {
    const { canComment } = await getObjectiveViewerContext(req);
    if (!canComment) return flashError(req, res, backTo, "You don't hold a badge for this Objective.");
    if (typeof comment !== "string" || !comment.trim()) return flashError(req, res, backTo, "Comment text is required.");

    const { error } = await objectivesDB.addComment(objectiveId, req.session?.user?.id ?? null, comment.trim());
    if (error) throw error;
    return flashSuccess(req, res, backTo, "Comment added.");
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/comments error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
