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
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import { getPackView } from "../core/packView.js";
import { redirects } from "../../../middleware/redirects.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";

const PACK_STATES = ["Draft", "Validated", "Published", "Active", "Retired", "Archived"];

router.get("/packs", attachVM("seu/packs/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Packs";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status", "category"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const packs = await listPacksWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    const categories = [...new Set(packs.map((p) => p.pack.category))].sort();
    const activeCategory = typeof req.query.category === "string" && categories.includes(req.query.category) ? req.query.category : "";
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
    req.vm.opt.platformTenantId = await getPlatformTenantId();
    req.vm.opt.tenantNameById = Object.fromEntries(((await tenantsDB.findAll()).data ?? []).map((t) => [t.id, t.name]));
    req.vm.opt.states = PACK_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/packs/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/packs] GET /packs error", err as Error);
    next(err);
  }
});

router.get("/packs/:id", attachVM("seu/packs/view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const viewer = { isRoot: (req.session?.user?.platformBadges ?? []).includes("root"), tenantId: req.session?.user?.tenant_id ?? null };
    const view = await getPackView(String(req.params.id), viewer);
    if (!view) return redirects.seu.packsView.error(req, res, "Pack not found.");
    req.vm.req.title = `Pack: ${view.pack.name}`;
    req.vm.req.pack = view.pack;
    req.vm.req.groups = view.groups;
    req.vm.req.content = view.content;
    req.vm.req.labels = view.labels;
    req.vm.req.refs = view.refs;
    req.vm.req.policies = view.policies;
    req.vm.opt.renderMarkdown = renderMarkdown;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/packs/view", req.vm);
  } catch (err) {
    logger.error("[web/seu/packs] GET /packs/:id error", err as Error);
    next(err);
  }
});

export { router };
