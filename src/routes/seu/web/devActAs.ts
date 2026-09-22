// CR-001 — Dev-only "Act As" switcher routes (design/Change Requests.md).
//
// Mounted under /aisworg/seu. Every handler is guarded by devActAsAvailable():
// unless the feature is live (dev + not switched off) AND the caller is the
// single god identity, the route 404s — so in production, or for any other
// user, these endpoints do not exist.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { devActAsAvailable, currentActAs, setActingNounVerbBadge, isAssumableBadgeCode } from "../../../dev/actAs.js";

// Gate: the whole router is invisible unless the feature is live for this
// caller. 404 (not 403) so its very existence isn't disclosed otherwise.
router.use("/dev/act-as", (req: Request, res: Response, next: NextFunction) => {
  if (!devActAsAvailable(req)) {
    res.status(404).json({ error: "not found" });
    return;
  }
  next();
});

/** POST /aisworg/seu/dev/act-as — set the acting tenant + badge. */
router.post("/dev/act-as", async (req: Request, res: Response) => {
  const back = (req.headers.referer as string) || "/aisworg";
  try {
    const tenantId = typeof req.body?.tenantId === "string" && req.body.tenantId.trim() !== "" ? req.body.tenantId : null;
    const badgeType = typeof req.body?.badgeType === "string" && req.body.badgeType.trim() !== "" ? req.body.badgeType : "root";

    // Validate the badge type is a real vocabulary entry for the tenant —
    // either a Layer 1/2 badge_types row (root is always valid) or a live
    // noun_verb badge named by a real transition_definitions row.
    if (!(await isAssumableBadgeCode(badgeType, tenantId))) {
      return flashError(req, res, back, `Unknown badge type "${badgeType}" for the selected tenant.`);
    }

    // The previously-simulated badge (if any) — setActingNounVerbBadge below
    // removes exactly this one before adding the new one, so switching badges
    // never leaves a stale one behind on the real user's own row.
    const previous = currentActAs(req);

    (req.session as unknown as { actAs?: { tenantId: string | null; badgeType: string } }).actAs = { tenantId, badgeType };

    const userId = req.session?.user?.id != null ? Number(req.session.user.id) : null;
    if (userId != null && Number.isInteger(userId)) {
      await setActingNounVerbBadge(req, { userId, tenantId, badgeType, previousBadgeType: previous?.badgeType ?? null });
    }

    const label = badgeType === "root" ? "root (full access)" : `badge "${badgeType}"`;
    return flashSuccess(req, res, back, `Now acting as ${label}${tenantId ? "" : " · default tenant"}.`);
  } catch (err) {
    logger.error("[dev/act-as] POST error", err as Error);
    return flashError(req, res, back, (err as Error).message);
  }
});

/** POST /aisworg/seu/dev/act-as/reset — clear the acting context (back to root). */
router.post("/dev/act-as/reset", async (req: Request, res: Response) => {
  const back = (req.headers.referer as string) || "/aisworg";
  const previous = currentActAs(req);
  const userId = req.session?.user?.id != null ? Number(req.session.user.id) : null;
  if (userId != null && Number.isInteger(userId) && previous) {
    await setActingNounVerbBadge(req, { userId, tenantId: previous.tenantId, badgeType: null, previousBadgeType: previous.badgeType });
  }
  delete (req.session as unknown as { actAs?: unknown }).actAs;
  return flashSuccess(req, res, back, "Acting context reset to root (full access).");
});

export { router };
