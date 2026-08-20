// Profile Registry (owner, 2026-08-19: "Build the template and profile
// registry") — closes Ch.6 §20.12's "no Template/Profile registry page" gap
// for Profile too, and is the UI trigger Profile's own reactivation
// mechanism (Ch.7 §19.2) otherwise has nowhere to run from. Mirrors
// web/packs.ts / web/templateRegistry.ts's own Registry page structure.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listProfilesWithNextStates, copyProfileAsNewDraft } from "../core/profiles.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const PROFILE_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/profiles — every published Version of every Profile. */
router.get("/profiles", attachVM("seu/profiles/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Profiles";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status", "category"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const profiles = await listProfilesWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    // Ch.7 §8 Profile Categories — a real, distinct field (unlike Template's
    // code-as-category shortcut).
    const categories = [...new Set(profiles.map((p) => p.profile.category).filter((c): c is string => !!c))].sort();
    const activeCategory = typeof req.query.category === "string" && categories.includes(req.query.category) ? req.query.category : "";
    const activeStatus = typeof req.query.status === "string" && PROFILE_STATES.includes(req.query.status) ? req.query.status : "";
    let scoped = activeCategory ? profiles.filter((p) => p.profile.category === activeCategory) : profiles;
    if (activeStatus) scoped = scoped.filter((p) => p.profile.status === activeStatus);
    const list = paginateList(scoped, params, {
      searchFields: [(p) => p.profile.name, (p) => p.profile.code, (p) => p.profile.category],
      sortFields: { name: (p) => p.profile.name, version: (p) => p.profile.profile_version, status: (p) => p.profile.status, category: (p) => p.profile.category },
    });
    list.category = activeCategory || undefined;
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/profiles";
    req.vm.opt.categories = categories;
    req.vm.opt.activeCategory = activeCategory;
    req.vm.opt.states = PROFILE_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
    const canCopy = actorId ? (await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "profile_define" })).allowed : false;
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/profiles/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/profileRegistry] GET /profiles error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/profiles/:id/copy — Registry "Copy" action: a new, editable Draft at the next available version. */
router.post("/profiles/:id/copy", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/profiles";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
  if (!actorId) return flashError(req, res, backTo, "Sign in required.");
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "profile_define" });
  if (!auth.allowed) return flashError(req, res, backTo, "You don't hold the profile_define badge.");
  try {
    const result = await copyProfileAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return flashError(req, res, backTo, `Copy failed: ${result.errors.join("; ")}`);
    return flashSuccess(req, res, `/aisworg/seu/sdk/profile-authoring/${result.draftId}`, "Profile copied — a new Draft is ready to edit.");
  } catch (err) {
    logger.error("[web/seu/profileRegistry] POST /profiles/:id/copy error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
