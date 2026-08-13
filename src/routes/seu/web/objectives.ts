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
  listReParentCandidates,
  reParentObjective,
  retireObjectiveSubtree,
  searchObjectives,
  transitionObjective,
  updateObjective,
} from "../core/objectives.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { parseListParams, paginateList, listResult } from "../../../utils/listQuery.js";
import { commissionFromExistingObjective } from "../core/commissioning.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";

// Which child tiers a node of a given tier may contextually add (the buttons the
// tree offers). Strategic is only ever created from the empty/root affordance.
const CHILD_TIERS: Record<ObjectiveTier, ObjectiveTier[]> = {
  Strategic: ["Operational", "Engineering"],
  Operational: ["Engineering"],
  Engineering: [],
};

/**
 * GET /aisworg/seu/objectives — CR-009 tree. Browse mode (no ?q) paginates the
 * Strategic roots, each expandable to lazy-load its children. Search mode (?q)
 * returns a flat, paginated hit list, each with its breadcrumb to root.
 */
router.get("/objectives", attachVM("seu/objectives/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Objectives";
    const _base = "/aisworg/seu/objectives";
    req.vm.opt.listBasePath = _base;
    req.vm.opt.flash = getFlash(req);

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    req.vm.req.mode = q ? "search" : "browse";

    if (q) {
      const params = parseListParams(req.query, { sortable: ["statement", "tier", "status"], defaultSort: "statement", defaultDir: "asc" });
      const hits = await searchObjectives();
      req.vm.req.list = paginateList(hits, params, {
        searchFields: [(o) => o.statement],
        sortFields: { statement: (o) => o.statement, tier: (o) => o.tier, status: (o) => o.status },
      });
    } else {
      const params = parseListParams(req.query, { sortable: ["created"], defaultSort: "created", defaultDir: "desc" });
      const { items, total } = await getObjectiveRootsPage({ limit: params.limit, offset: params.offset });
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
router.get("/objectives/:id/children", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const depth = Math.max(0, Math.min(20, parseInt(String(req.query.depth ?? "1"), 10) || 1));
    const nodes = await getObjectiveChildren(String(req.params.id));
    // Rendered directly (a partial fragment, not a registered ViewModel view).
    return res.render("seu/objectives/_nodes", { nodes, depth, csrfToken: res.locals.csrfToken, childTiers: CHILD_TIERS });
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
router.get("/objectives/new", attachVM("seu/objectives/new"), async (req: Request, res: Response, next: NextFunction) => {
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

    const { data: capabilities } = await capabilitiesDB.findAll();
    req.vm.req.title = `New ${tier} Objective`;
    req.vm.req.capabilities = capabilities ?? [];
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
router.post("/objectives", async (req: Request, res: Response) => {
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
    return flashSuccess(req, res, `/aisworg/seu/objectives/${objective.id}`, `Objective created as Proposed. Activate it before commissioning an SEU against it.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives error", err as Error);
    return flashError(req, res, backToNew, (err as Error).message);
  }
});

/** GET /aisworg/seu/objectives/:id — decomposition, required Capabilities, lifecycle + move actions. */
router.get("/objectives/:id", attachVM("seu/objectives/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const detail = await getObjectiveDetail(id);
    if (!detail) return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
    req.vm.req.title = `Objective ${detail.objective.id.slice(0, 8)}`;
    req.vm.req.detail = detail;
    req.vm.req.childTiers = CHILD_TIERS[detail.objective.tier];
    // Move parent-picker options — only offered for a non-Strategic node.
    req.vm.req.reParentOptions = detail.objective.tier === "Strategic" ? [] : await listReParentCandidates(id);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/objectives/:id/update — edits statement/tier (tier change guarded for tree integrity). */
router.post("/objectives/:id/update", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  const { statement, tier } = req.body ?? {};

  try {
    const updated = await updateObjective(objectiveId, {
      statement: typeof statement === "string" && statement.trim() ? statement : undefined,
      tier: (tier || undefined) as ObjectiveTier | undefined,
    });
    return flashSuccess(req, res, backTo, `Objective updated to v${updated.version}.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/update error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/objectives/:id/move — CR-009 re-parent (subtree moves with it). */
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

/** POST /aisworg/seu/objectives/:id/delete — CR-012 hard delete (Proposed leaf only). */
router.post("/objectives/:id/delete", async (req: Request, res: Response) => {
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
router.post("/objectives/:id/retire", async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/objectives/:id/transition — Ch.1 lifecycle action. */
router.post("/objectives/:id/transition", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionObjective({ objectiveId, targetState: targetState as ObjectiveStatus, actorRole: req.session?.user?.role ?? "general", actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined });
    if (!result.ok) {
      const detail = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Transition blocked: ${detail}`);
    }
    return flashSuccess(req, res, backTo, `Objective moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives/:id/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/objectives/:id/commission — commission an SEU directly against this (Active, non-Strategic leaf) Objective. */
router.post("/objectives/:id/commission", async (req: Request, res: Response) => {
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

export { router };
