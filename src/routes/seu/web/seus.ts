import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listSeus, getSeuDetailView } from "../core/seus.js";
import { commissionFromForm } from "../core/commissioning.js";
import { fulfilCapability } from "../core/capabilities.js";
import { transitionDeliverable } from "../core/deliverables.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { ParticipantType } from "../../../dblayer/seuTypes.js";

/** GET /aisworg/seu/seus — SEU Runtime: every commissioned SEU. */
router.get("/seus", attachVM("seu/seus/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "SEUs";
    req.vm.req.seus = await listSeus();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/seus/new — commissioning form (Objective statement + required Capabilities). */
router.get("/seus/new", attachVM("seu/seus/new"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: capabilities } = await capabilitiesDB.findAll();
    req.vm.req.title = "Commission a new SEU";
    req.vm.req.capabilities = capabilities ?? [];
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/new error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus — runs the full Ch.8 pipeline (Objective → Template → Profile → commission) from one form submit. */
router.post("/seus", async (req: Request, res: Response) => {
  const { statement, requiredCapabilityCodes } = req.body ?? {};
  const codes = Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : requiredCapabilityCodes ? [requiredCapabilityCodes] : [];

  if (typeof statement !== "string" || !statement.trim() || codes.length === 0) {
    return flashError(req, res, "/aisworg/seu/seus/new", "Statement and at least one required Capability are required.");
  }

  try {
    const result = await commissionFromForm({
      statement,
      requiredCapabilityCodes: codes,
      actorRole: req.session?.user?.role ?? "general",
      requestedBy: req.session?.user?.id ?? null,
    });

    if (!result.ok) {
      return flashError(req, res, "/aisworg/seu/seus/new", `Commissioning failed at "${result.stage}": ${result.reason}`);
    }
    return flashSuccess(req, res, `/aisworg/seu/seus/${result.seu.id}`, `SEU commissioned — lifecycle state: ${result.seu.lifecycle_state}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus error", err as Error);
    return flashError(req, res, "/aisworg/seu/seus/new", (err as Error).message);
  }
});

/** GET /aisworg/seu/seus/:id — full SEU detail: EBM, Capabilities (with Fulfil form), Deliverables (with Transition form), Events. */
router.get("/seus/:id", attachVM("seu/seus/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getSeuDetailView(String(req.params.id));
    if (!detail) {
      return flashError(req, res, "/aisworg/seu/seus", "SEU not found.");
    }
    req.vm.req.title = `SEU ${detail.seu.id.slice(0, 8)}`;
    req.vm.req.detail = detail;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/seus/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/seus] GET /seus/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus/:id/capabilities/:capabilityId/fulfil — Ch.12 direct assignment. */
router.post("/seus/:id/capabilities/:capabilityId/fulfil", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { participantType, displayName } = req.body ?? {};

  if (!participantType || typeof displayName !== "string" || !displayName.trim()) {
    return flashError(req, res, backTo, "Participant type and display name are required.");
  }

  try {
    const result = await fulfilCapability({
      seuId,
      capabilityId: String(req.params.capabilityId),
      participantType: participantType as ParticipantType,
      displayName,
    });
    return flashSuccess(req, res, backTo, `Capability "${result.capabilityCode}" fulfilled by ${displayName}.`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/capabilities/:capabilityId/fulfil error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/seus/:id/deliverables/:deliverableId/transition — Ch.15/Ch.29 gated transition. */
router.post("/seus/:id/deliverables/:deliverableId/transition", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}`;
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionDeliverable({
      deliverableId: String(req.params.deliverableId),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      requestedBy: req.session?.user?.id ?? null,
    });
    if (!result.ok) {
      const reason = result.reason === "dependency_not_satisfied" ? "one or more dependencies aren't Satisfied yet" : "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Deliverable moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/seus] POST /seus/:id/deliverables/:deliverableId/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
