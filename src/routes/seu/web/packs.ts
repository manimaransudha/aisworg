import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listPacksWithNextStates, copyPackAsNewDraft } from "../core/packs.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const PACK_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/packs — Ch.38 §10 Pack Registry: every published Version of every Pack. */
// Pack ownership visibility (owner: "Platform packs will be available to all
// users of the platform. Tenant packs are visible only to the tenant
// users."): root still sees the whole Registry (every tenant); everyone else
// sees Platform-owned Packs plus their own tenant's.
// Registry category tabs (owner, 2026-08-19: "Page registry also should
// change to be a tabbed one") — every category actually present among the
// Packs this viewer can see, plus an "All" tab; ?category= scopes the list
// before pagination, same as `q` already does.
router.get("/packs", attachVM("seu/packs/index"), async (req: Request, res: Response, next: NextFunction) => {
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
    // Registry "Copy" action (owner: "Add a Copy button and enable it for
    // users that have *_define badge") — View-only otherwise (owner: "Do not
    // include the transition button here"); this page no longer offers any
    // transition control, root bypasses the badge check the same way every
    // other noun_verb authorisation does.
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
    const canCopy = actorId ? (await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "pack_define" })).allowed : false;
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/packs/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/packs] GET /packs error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/packs/:id/copy — Registry "Copy" action: a new, editable Draft at the next available version. */
router.post("/packs/:id/copy", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/packs";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
  if (!actorId) return flashError(req, res, backTo, "Sign in required.");
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "pack_define" });
  if (!auth.allowed) return flashError(req, res, backTo, "You don't hold the pack_define badge.");
  try {
    const result = await copyPackAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return flashError(req, res, backTo, `Copy failed: ${result.errors.join("; ")}`);
    return flashSuccess(req, res, `/aisworg/seu/sdk/pack-authoring/${result.draftId}`, "Pack copied — a new Draft is ready to edit.");
  } catch (err) {
    logger.error("[web/seu/packs] POST /packs/:id/copy error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
