import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { devActAsAvailable, currentActAs, setActingNounVerbBadge, isAssumableBadgeCode } from "../../../dev/actAs.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";

router.use("/dev/act-as", (req: Request, res: Response, next: NextFunction) => {
  if (!devActAsAvailable(req)) {
    res.status(404).json({ error: "not found" });
    return;
  }
  next();
});

router.post("/dev/act-as", async (req: Request, res: Response) => {
  const back = (req.headers.referer as string) || "/aisworg";
  try {
    const tenantId = typeof req.body?.tenantId === "string" && req.body.tenantId.trim() !== "" ? req.body.tenantId : null;
    const badgeType = typeof req.body?.badgeType === "string" && req.body.badgeType.trim() !== "" ? req.body.badgeType : "root";

    if (!(await isAssumableBadgeCode(badgeType, tenantId))) {
      return redirects.seu.devActAs.error(req, res, `Unknown badge type "${badgeType}" for the selected tenant.`, back);
    }

    const previous = currentActAs(req);

    (req.session as unknown as { actAs?: { tenantId: string | null; badgeType: string } }).actAs = { tenantId, badgeType };

    const userId = requireActorId(req);
    await setActingNounVerbBadge(req, { userId, tenantId, badgeType, previousBadgeType: previous?.badgeType ?? null });

    const label = badgeType === "root" ? "root (full access)" : `badge "${badgeType}"`;
    return redirects.seu.devActAs.success(req, res, `Now acting as ${label}${tenantId ? "" : " · default tenant"}.`, back);
  } catch (err) {
    logger.error("[dev/act-as] POST error", err as Error);
    return redirects.seu.devActAs.error(req, res, (err as Error).message, back);
  }
});

router.post("/dev/act-as/reset", async (req: Request, res: Response) => {
  const back = (req.headers.referer as string) || "/aisworg";
  const previous = currentActAs(req);
  const userId = requireActorId(req);
  if (previous) {
    await setActingNounVerbBadge(req, { userId, tenantId: previous.tenantId, badgeType: null, previousBadgeType: previous.badgeType });
  }
  delete (req.session as unknown as { actAs?: unknown }).actAs;
  return redirects.seu.devActAs.success(req, res, "Acting context reset to root (full access).", back);
});

export { router };
