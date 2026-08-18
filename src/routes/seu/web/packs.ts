import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listPacksWithNextStates, transitionPack } from "../core/packs.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";

/** GET /aisworg/seu/packs — Ch.38 §10 Pack Registry: every published Version of every Pack. */
// Pack ownership visibility (owner: "Platform packs will be available to all
// users of the platform. Tenant packs are visible only to the tenant
// users."): root still sees the whole Registry (every tenant); everyone else
// sees Platform-owned Packs plus their own tenant's.
router.get("/packs", attachVM("seu/packs/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Packs";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status", "category"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const packs = await listPacksWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    req.vm.req.list = paginateList(packs, params, {
      searchFields: [(p) => p.pack.name, (p) => p.pack.code, (p) => p.pack.category],
      sortFields: { name: (p) => p.pack.name, version: (p) => p.pack.pack_version, status: (p) => p.pack.status, category: (p) => p.pack.category },
    });
    req.vm.opt.listBasePath = "/aisworg/seu/packs";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/packs/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/packs] GET /packs error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/packs/:id/transition — Ch.5 §11 / Ch.38 §9 lifecycle. */
router.post("/packs/:id/transition", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/packs";
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo, "Target state is required.");
  }

  try {
    const result = await transitionPack({
      packId: String(req.params.id),
      targetState,
      actorRole: req.session?.user?.role ?? "general",
      actorId: req.session?.user?.id != null ? String(req.session.user.id) : undefined,
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return flashError(req, res, backTo, `Pack transition blocked: ${reason}`);
    }
    return flashSuccess(req, res, backTo, `Pack "${result.pack.code}" (v${result.pack.pack_version}) moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/packs] POST /packs/:id/transition error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
