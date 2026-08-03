import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { createObjective, getObjectiveDetail, listObjectives, listSelectableObjectives, transitionObjective, updateObjective } from "../core/objectives.js";
import { commissionFromExistingObjective } from "../core/commissioning.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";

/** GET /aisworg/seu/objectives — every Objective, any status/tier. */
router.get("/objectives", attachVM("seu/objectives/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Objectives";
    req.vm.req.objectives = await listObjectives();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/objectives/new — Ch.1: statement, tier, optional parent, suggested Capabilities. */
router.get("/objectives/new", attachVM("seu/objectives/new"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [{ data: capabilities }, parentOptions] = await Promise.all([capabilitiesDB.findAll(), listSelectableObjectives()]);
    req.vm.req.title = "New Objective";
    req.vm.req.capabilities = capabilities ?? [];
    req.vm.req.parentOptions = parentOptions;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/new error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/objectives — creates in 'Proposed'; must be explicitly Activated before it can be commissioned against. */
router.post("/objectives", async (req: Request, res: Response) => {
  const { statement, tier, parentObjectiveId, requiredCapabilityCodes } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];

  if (typeof statement !== "string" || !statement.trim() || codes.length === 0) {
    return flashError(req, res, "/aisworg/seu/objectives/new", "Statement and at least one required Capability are required.");
  }

  try {
    const { objective } = await createObjective({
      statement,
      requiredCapabilityCodes: codes,
      tier: (tier || undefined) as ObjectiveTier | undefined,
      status: "Proposed",
      parentObjectiveId: parentObjectiveId || null,
      requestedBy: req.session?.user?.id ?? null,
    });
    return flashSuccess(req, res, `/aisworg/seu/objectives/${objective.id}`, `Objective created as Proposed. Activate it before commissioning an SEU against it.`);
  } catch (err) {
    logger.error("[web/seu/objectives] POST /objectives error", err as Error);
    return flashError(req, res, "/aisworg/seu/objectives/new", (err as Error).message);
  }
});

/** GET /aisworg/seu/objectives/:id — decomposition tree, required Capabilities, lifecycle actions. */
router.get("/objectives/:id", attachVM("seu/objectives/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getObjectiveDetail(String(req.params.id));
    if (!detail) return flashError(req, res, "/aisworg/seu/objectives", "Objective not found.");
    req.vm.req.title = `Objective ${detail.objective.id.slice(0, 8)}`;
    req.vm.req.detail = detail;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/objectives/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/objectives] GET /objectives/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/objectives/:id/update — edits statement/tier; increments version (Ch.1's Versioned:Yes, made real). */
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

/** POST /aisworg/seu/objectives/:id/transition — Ch.1 lifecycle action. */
router.post("/objectives/:id/transition", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionObjective({ objectiveId, targetState: targetState as ObjectiveStatus, actorRole: req.session?.user?.role ?? "general" });
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

/** POST /aisworg/seu/objectives/:id/commission — commission an SEU directly against this (Active) Objective. */
router.post("/objectives/:id/commission", async (req: Request, res: Response) => {
  const objectiveId = String(req.params.id);
  const backTo = `/aisworg/seu/objectives/${objectiveId}`;

  try {
    const result = await commissionFromExistingObjective({
      objectiveId,
      actorRole: req.session?.user?.role ?? "general",
      requestedBy: req.session?.user?.id ?? null,
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
