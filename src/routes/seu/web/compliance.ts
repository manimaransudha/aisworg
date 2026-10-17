import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { evaluateCompliance, grantWaiver } from "../core/compliance.js";
import { complianceDB } from "../../../dblayer/complianceDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

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

router.post("/seus/:id/compliance/waivers", async (req: Request, res: Response) => {
  const seuId = String(req.params.id);
  const { requirementCode, rationale } = req.body ?? {};
  if (typeof requirementCode !== "string" || !requirementCode.trim() || typeof rationale !== "string" || !rationale.trim()) {
    return redirects.seu.seusComplianceWaivers.error(req, res, "Requirement and rationale are required.");
  }
  try {
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
    if (!actorId) return redirects.seu.seusComplianceWaivers.error(req, res, "Authentication required.");
    const { data: master } = await participantsMasterDB.findById(actorId);
    if (!master) return redirects.seu.seusComplianceWaivers.error(req, res, "No superuser provisioned.");
    const { isRoot, badgeTypes } = await badgeAuthorityEngine.getHeldBadges(actorId);
    const authorBadge = isRoot ? "root" : [...badgeTypes][0] ?? "general";
    await grantWaiver({ seuId, requirementCode, rationale, grantedBy: master.id, authorBadge });
    return redirects.seu.seusComplianceWaivers.success(req, res, `Waiver granted for "${requirementCode}".`);
  } catch (err) {
    logger.error("[web/seu/compliance] POST waiver error", err as Error);
    return redirects.seu.seusComplianceWaivers.error(req, res, (err as Error).message);
  }
});

export { router };
