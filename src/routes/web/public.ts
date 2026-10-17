import type { Request, Response, NextFunction } from "express";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { attachVM } from "../../middleware/attachVM.js";
import { renderView } from "../../utils/viewModel.js";
import { getFlash } from "../../utils/flash.js";
import { logger } from "../../utils/logger.js";
import {parseListParams, paginateList} from "../../utils/listQuery.js";
import { getArchitectureLayers, getDashboardCounts } from "../seu/core/dashboard.js";
import { getSeuQuickview } from "../seu/core/seus.js";
import { getParticipantHomeView, completeMyWorkItem, raiseMyObligation } from "../seu/core/participantHome.js";
import { flashError, flashSuccess } from "../../utils/flash.js";
import type { WorkItemOutcome } from "../seu/core/workItems.js";
import { listConceptsForType } from "../seu/core/ontology.js";
import { resolveHeldRoles } from "../../domain/identity/heldRoles.js";

function sessionUserOf(req: Request) {
  const user = req.session.user;
  if (!user) throw new Error(`[web/public] ${req.method} ${req.path} reached without a session user`);
  return user;
}

router.get("/", attachVM("seu/dashboard"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [layers, counts] = await Promise.all([getArchitectureLayers(), getDashboardCounts()]);
    req.vm.req.title = "SEU Platform";
    req.vm.req.layers = layers;
    req.vm.req.counts = counts;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/dashboard", req.vm);
  } catch (err) {
    logger.error("[Home] GET / error:", err);
    next(err);
  }
});

router.get("/quickview", attachVM("quickview/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const held = req.session?.user ? await resolveHeldRoles(String(sessionUserOf(req).id)) : null;
    if (held && !held.isSuperuser && held.roles.has("general")) {
      req.vm.req.title = "My Work";
      req.vm.req.participantHome = await getParticipantHomeView(sessionUserOf(req).id);
      const isRoot = (sessionUserOf(req).platformBadges ?? []).includes("root");
      const tenantId = sessionUserOf(req).tenant_id ?? null;
      const [obligationCategories, obligationSeverities] = await Promise.all([
        listConceptsForType("category:obligation", { isRoot, tenantId }, false),
        listConceptsForType("category:obligation-severity", { isRoot, tenantId }, false),
      ]);
      req.vm.req.obligationCategoryOptions = [...new Set(obligationCategories.map((c) => c.code))].sort();
      req.vm.req.obligationSeverityOptions = [...new Set(obligationSeverities.map((c) => c.code))].sort();
      req.vm.opt.flash = getFlash(req);
      return renderView(req, res, "quickview/participant", req.vm);
    }

    req.vm.req.title = "Commissioned SEUs";
    const seus = await getSeuQuickview();
    const params = parseListParams(req.query, { sortable: ["objective", "state", "created"], defaultSort: "created", defaultDir: "desc" });
    req.vm.req.list = paginateList(seus, params, {
      searchFields: [(s) => s.objectiveStatement, (s) => s.lifecycleState],
      sortFields: { objective: (s) => s.objectiveStatement, state: (s) => s.lifecycleState, created: (s) => s.createdAt },
    });
    req.vm.opt.listBasePath = "/aisworg/quickview";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "quickview/index", req.vm);
  } catch (err) {
    logger.error("[QuickView] GET error:", err);
    next(err);
  }
});

router.post("/quickview/work-items/:workItemId/complete", async (req: Request, res: Response) => {
  const backTo = "/aisworg/quickview";
  const { outcome, reference } = req.body ?? {};
  if (typeof outcome !== "string" || !["done", "failed", "blocked"].includes(outcome)) {
    return flashError(req, res, backTo, "Outcome must be done, failed or blocked.");
  }
  try {
    const result = await completeMyWorkItem({
      userId: sessionUserOf(req).id,
      workItemId: String(req.params.workItemId),
      outcome: outcome as WorkItemOutcome,
      reference: typeof reference === "string" && reference.trim() !== "" ? reference : null,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, `Could not record result: ${result.detail}`);
    }
    if (result.outcome === "done") {
      return flashSuccess(req, res, backTo, `Result recorded for Deliverable "${result.deliverable.name}".`);
    }
    return flashSuccess(req, res, backTo, `Reported "${result.outcome}" — the transition was not applied and an Attention Item was raised.`);
  } catch (err) {
    logger.error("[QuickView] POST work-item complete error:", err);
    return flashError(req, res, backTo, err instanceof Error ? err.message : String(err));
  }
});

router.post("/quickview/seus/:seuId/obligations", async (req: Request, res: Response) => {
  const backTo = "/aisworg/quickview";
  const { deliverableId, category, title, description, severity, completionCriteria } = req.body ?? {};
  if (typeof deliverableId !== "string" || !deliverableId.trim() || typeof category !== "string" || !category.trim() || typeof title !== "string" || !title.trim()) {
    return flashError(req, res, backTo, "Deliverable, category and title are required.");
  }
  try {
    const result = await raiseMyObligation({
      userId: sessionUserOf(req).id,
      seuId: String(req.params.seuId),
      deliverableId,
      category,
      title,
      description,
      severity,
      completionCriteria,
    });
    if (!result.ok) {
      return flashError(req, res, backTo, result.detail);
    }
    return flashSuccess(req, res, backTo, `Obligation "${result.obligation.title}" created (${result.obligation.category}, ${result.obligation.severity}).`);
  } catch (err) {
    logger.error("[QuickView] POST obligations error:", err);
    return flashError(req, res, backTo, err instanceof Error ? err.message : String(err));
  }
});

export { router };
