import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listPacksWithNextStates } from "../core/packs.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { requireBadge } from "../../../middleware/requireBadge.js";

// CR-080 — Deprecated dropped from Pack's own lifecycle (never actually
// distinguished from Retired at runtime; migration 137).
const PACK_STATES = ["Draft", "Validated", "Published", "Active", "Retired", "Archived"];

/** GET /aisworg/seu/packs — Ch.38 §10 Pack Registry: every published Version of every Pack. */
// Pack ownership visibility (owner: "Platform packs will be available to all
// users of the platform. Tenant packs are visible only to the tenant
// users."): root still sees the whole Registry (every tenant); everyone else
// sees Platform-owned Packs plus their own tenant's.
// Registry category tabs (owner, 2026-08-19: "Page registry also should
// change to be a tabbed one") — every category actually present among the
// Packs this viewer can see, plus an "All" tab; ?category= scopes the list
// before pagination, same as `q` already does.
router.get("/packs", requireBadge(["None"]), attachVM("seu/packs/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Packs";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status", "category"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const packs = await listPacksWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    const categories = [...new Set(packs.map((p) => p.pack.category))].sort();
    const activeCategory = typeof req.query.category === "string" && categories.includes(req.query.category) ? req.query.category : "";
    // Registry state filter (owner: "Include filters to filter by state:
    // Active, Deprecated etc.") — composes with the category tab above.
    const activeStatus = typeof req.query.status === "string" && PACK_STATES.includes(req.query.status) ? req.query.status : "";
    let scoped = activeCategory ? packs.filter((p) => p.pack.category === activeCategory) : packs;
    if (activeStatus) scoped = scoped.filter((p) => p.pack.status === activeStatus);
    const list = paginateList(scoped, params, {
      searchFields: [(p) => p.pack.name, (p) => p.pack.code, (p) => p.pack.category],
      sortFields: { name: (p) => p.pack.name, version: (p) => p.pack.pack_version, status: (p) => p.pack.status, category: (p) => p.pack.category },
    });
    list.category = activeCategory || undefined;
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/packs";
    req.vm.opt.categories = categories;
    req.vm.opt.activeCategory = activeCategory;
    req.vm.opt.states = PACK_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/packs/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/packs] GET /packs error", err as Error);
    next(err);
  }
});

export { router };
