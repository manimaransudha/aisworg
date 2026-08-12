import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { evaluateCompliance, grantWaiver } from "../core/compliance.js";
import { complianceDB } from "../../../dblayer/complianceDB.js";

// Compliance Model — Plan (Phase 15, Ch.27). Read-only compliance read-out for a
// SEU: the rolled-up status, per-requirement results, active waivers, and any
// reported conflicts, with a form to grant a waiver.

/** GET /aisworg/seu/seus/:id/compliance — the SEU's live compliance evaluation. */
router.get("/seus/:id/compliance", attachVM("seu/compliance/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const seuId = String(req.params.id);
    const [evaluation, { data: waivers }] = await Promise.all([
      evaluateCompliance(seuId),
      complianceDB.findActiveWaivers(seuId),
    ]);
    req.vm.req.title = "Compliance";
    req.vm.req.seuId = seuId;
    req.vm.req.evaluation = evaluation;
    req.vm.req.waivers = waivers ?? [];
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/compliance/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/compliance] GET error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/seus/:id/compliance/waivers — grant a waiver against a requirement. */
router.post("/seus/:id/compliance/waivers", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const backTo = `/aisworg/seu/seus/${seuId}/compliance`;
  const { requirementCode, rationale } = req.body ?? {};
  if (typeof requirementCode !== "string" || !requirementCode.trim() || typeof rationale !== "string" || !rationale.trim()) {
    return flashError(req, res, backTo, "Requirement and rationale are required.");
  }
  try {
    await grantWaiver({ seuId, requirementCode, rationale, grantedBy: req.session?.user?.id ?? null });
    return flashSuccess(req, res, backTo, `Waiver granted for "${requirementCode}".`);
  } catch (err) {
    logger.error("[web/seu/compliance] POST waiver error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
