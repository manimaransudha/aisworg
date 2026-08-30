import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { listPacksWithNextStates, transitionPack } from "../core/packs.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import type { PackStatus } from "../../../dblayer/seuTypes.js";

// CR-076 follow-up (Pack) — same two gap shapes already found and fixed on
// api/objectives.ts: an unfiltered list route, and a single multi-target
// transition route with no route-level badge check at all.

/**
 * GET /packs — Ch.38 §10 Pack Registry: every published Version of every
 * Pack, newest first within each code. No POST create endpoint — SDK-001
 * ("Every production Pack shall be created using the SDK") means Packs are
 * created via `pnpm pack:publish`, not a web/API form.
 */
// CR-076 follow-up — was calling listPacksWithNextStates() with no viewer at
// all, returning every Pack across every tenant unfiltered (the exact same
// gap "GET /objectives should have a requireTenant" closed there).
router.get("/packs", requireBadge(["None"], { mode: "api" }), requireTenant(), async (req: Request, res: Response) => {
  try {
    const { isRoot, tenantId } = req.tenantScope!;
    const packs = await listPacksWithNextStates(tenantId ? { isRoot, tenantId } : null);
    res.status(200).json({ packs });
  } catch (err) {
    logger.error("[api/seu/packs] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// CR-076 follow-up — tenant reach on the route's own :id, same check and
// reasoning as web/packs.ts's own router.param("id", ...): badge_grants
// carries no tenant_id, so holding a pack_<verb> badge alone never stopped a
// tenant actor reaching a DIFFERENT tenant's (or Platform's) Pack by id.
// platformTenantId: a Platform-owned Pack stays reachable by every tenant
// (web/packs.ts's own "Platform packs will be available to all users"),
// unlike Objective, which has no such universally-shared row.
router.param(
  "id",
  requireTenantScope.forParam("id", packsDB.findById, (p) => p.tenant_id, {
    mode: "api",
    notFoundMessage: "Pack not found",
    platformTenantId: PLATFORM_TENANT_ID,
  })
);

// CR-076 follow-up — was one route dispatching on a body-supplied
// targetState across all 6 Pack badges, with NO route-level badge check at
// all (relied entirely on transitionPack's own internal
// transitionEngine.evaluate). Per CR-076's settled rule ("a route needing
// different badges per request is split, not accommodated"), split into one
// route per verb, mirroring api/objectives.ts's own transition split
// exactly. comment is only actually required by transitionPack itself for
// Validated -> Draft (Reject); harmless to accept unused on every other
// route.
function postPackTransition(targetState: PackStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { comment } = req.body ?? {};
      const actorRole = req.session?.user?.role ?? "general";
      const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
      const result = await transitionPack({ packId: String(req.params.id), targetState, actorRole, actorId, comment: typeof comment === "string" ? comment : undefined });
      if (!result.ok) {
        if (result.reason === "not_found") { res.status(404).json({ error: "Pack not found" }); return; }
        res.status(409).json({ reason: result.reason, detail: "detail" in result ? result.detail : undefined });
        return;
      }
      res.status(200).json({ pack: result.pack, appliedTransition: result.appliedTransition });
    } catch (err) {
      logger.error(`[api/seu/packs] POST /:id/transition/${targetState} error`, err as Error);
      res.status(400).json({ error: (err as Error).message });
    }
  };
}

router.post("/packs/:id/transition/validate", requireBadge(["pack_validate"], { mode: "api" }), postPackTransition("Validated"));
router.post("/packs/:id/transition/publish", requireBadge(["pack_publish"], { mode: "api" }), postPackTransition("Published"));
/** Reject requires a genuinely new, non-empty comment every time — enforced in transitionPack itself, not here. */
router.post("/packs/:id/transition/reject", requireBadge(["pack_reject"], { mode: "api" }), postPackTransition("Draft"));
router.post("/packs/:id/transition/activate", requireBadge(["pack_activate"], { mode: "api" }), postPackTransition("Active"));
router.post("/packs/:id/transition/retire", requireBadge(["pack_retire"], { mode: "api" }), postPackTransition("Retired"));
router.post("/packs/:id/transition/archive", requireBadge(["pack_archive"], { mode: "api" }), postPackTransition("Archived"));

export { router };
