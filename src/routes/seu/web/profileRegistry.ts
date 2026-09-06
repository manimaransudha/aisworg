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
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const PROFILE_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/profiles — every published Version of every Profile. */
router.get("/profiles", attachVM("seu/profiles/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Profiles";
    const params = parseListParams(req.query, { sortable: ["name", "version", "status"], defaultSort: "name", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const profiles = await listProfilesWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    // CR-091 Part 3 — Registry now groups by base Template's code instead of
    // the now-retired `category` field (owner: "Restricting the profiles to
    // categories should not be present"), labelling each group with
    // whichever Template Version is currently Active for that code (owner:
    // "whatever is active") — not the specific, possibly older version an
    // individual Profile happens to be pinned to (§19.8's frozen-reference
    // design).
    const templateCodeById = new Map<string, string>();
    const activeTemplateNameByCode = new Map<string, string>();
    for (const templateId of new Set(profiles.map((p) => p.profile.base_template_id))) {
      const { data: template } = await templatesDB.findById(templateId);
      if (!template) continue;
      templateCodeById.set(templateId, template.code);
      if (!activeTemplateNameByCode.has(template.code)) {
        const { data: activeTemplate } = await templatesDB.findActiveByCode(template.code, viewerTenantId ?? undefined);
        activeTemplateNameByCode.set(template.code, activeTemplate?.name ?? template.name);
      }
    }
    const templateCodeFor = (p: { profile: { base_template_id: string } }) => templateCodeById.get(p.profile.base_template_id) ?? "";
    const templateCodes = [...new Set(profiles.map(templateCodeFor).filter(Boolean))].sort();
    const activeTemplateCode = typeof req.query.templateCode === "string" && templateCodes.includes(req.query.templateCode) ? req.query.templateCode : "";
    const activeStatus = typeof req.query.status === "string" && PROFILE_STATES.includes(req.query.status) ? req.query.status : "";
    let scoped = activeTemplateCode ? profiles.filter((p) => templateCodeFor(p) === activeTemplateCode) : profiles;
    if (activeStatus) scoped = scoped.filter((p) => p.profile.status === activeStatus);
    const list = paginateList(scoped, params, {
      searchFields: [(p) => p.profile.name, (p) => p.profile.code],
      sortFields: { name: (p) => p.profile.name, version: (p) => p.profile.profile_version, status: (p) => p.profile.status },
    });
    list.templateCode = activeTemplateCode || undefined;
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/profiles";
    req.vm.opt.templateCodes = templateCodes.map((code) => ({ code, label: activeTemplateNameByCode.get(code) ?? code }));
    req.vm.opt.activeTemplateCode = activeTemplateCode;
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
