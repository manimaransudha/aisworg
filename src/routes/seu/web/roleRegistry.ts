import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listRoleRegistry } from "../core/roleRegistry.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";

router.get("/roles", attachVM("seu/roles/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Role Registry";
    const params = parseListParams(req.query, { sortable: ["label", "code", "worktypes", "capabilities"], defaultSort: "label", defaultDir: "asc" });
    const viewer = { isRoot: (req.session?.user?.platformBadges ?? []).includes("root"), tenantId: req.session?.user?.tenant_id ?? null };
    const roleCode = typeof req.query.role === "string" ? req.query.role : "";
    const all = await listRoleRegistry(viewer);
    const entries = roleCode ? all.filter((e) => e.code === roleCode) : all;
    const list = paginateList(entries, params, {
      searchFields: [(r) => r.label, (r) => r.code, (r) => r.workItemTypes.map((w) => `${w.label} ${w.code}`).join(" "), (r) => r.capabilities.map((c) => `${c.label} ${c.code}`).join(" ")],
      sortFields: { label: (r) => r.label, code: (r) => r.code, worktypes: (r) => r.workItemTypes.length, capabilities: (r) => r.capabilities.length },
    });
    req.vm.req.list = list;
    req.vm.opt.roleCode = roleCode;
    req.vm.opt.listBasePath = "/aisworg/seu/roles";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/roles/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/roleRegistry] GET /roles error", err as Error);
    next(err);
  }
});

export { router };
