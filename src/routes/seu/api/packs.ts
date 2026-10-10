import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { listPacksWithNextStates, transitionPack } from "../core/packs.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import type { PackStatus } from "../../../dblayer/seuTypes.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 

router.get("/packs", requireTenant(), async (req: Request, res: Response) => {
  try {
    const { isRoot, tenantId } = req.tenantScope!;
    const packs = await listPacksWithNextStates(tenantId ? { isRoot, tenantId } : null);
    res.status(200).json({ packs });
  } catch (err) {
    logger.error("[api/seu/packs] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.param(
  "id",
  requireTenantScope.forParam("id", packsDB.findById, (p) => p.tenant_id, {
    mode: "api",
    notFoundMessage: "Pack not found",
    platformTenantId: (await getPlatformTenantId()),
  })
);

function postPackTransition(targetState: PackStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { comment } = req.body ?? {};
      const actorRole = req.session?.user?.role ?? "general";
      if (req.session?.user?.id == null) { res.status(401).json({ error: "not authenticated" }); return; }
      const actorId = String(req.session.user.id);
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

router.post("/packs/:id/transition/validate", postPackTransition("Validated"));
router.post("/packs/:id/transition/publish", postPackTransition("Published"));
router.post("/packs/:id/transition/reject", postPackTransition("Draft"));
router.post("/packs/:id/transition/activate", postPackTransition("Active"));
router.post("/packs/:id/transition/retire", postPackTransition("Retired"));
router.post("/packs/:id/transition/archive", postPackTransition("Archived"));

export { router };
