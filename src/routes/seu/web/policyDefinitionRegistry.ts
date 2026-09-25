// Policy Definition Registry (CR-089) — mirrors
// web/serviceDefinitionRegistry.ts's own Registry page structure exactly.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listPolicyDefinitionsWithNextStates, copyPolicyDefinitionAsNewDraft } from "../core/policyDefinitions.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";

const POLICY_DEFINITION_STATES = ["Draft", "Validated", "Published", "Active", "Deprecated", "Retired", "Archived"];

/** GET /aisworg/seu/policy-definitions — every published Version of every Policy Definition. */
router.get("/policy-definitions", attachVM("seu/policy-definitions/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Policy Definitions";
    const params = parseListParams(req.query, { sortable: ["code", "version", "status"], defaultSort: "code", defaultDir: "asc" });
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const rows = await listPolicyDefinitionsWithNextStates(viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null);
    const activeStatus = typeof req.query.status === "string" && POLICY_DEFINITION_STATES.includes(req.query.status) ? req.query.status : "";
    const scoped = activeStatus ? rows.filter((r) => r.policyDefinition.status === activeStatus) : rows;
    const list = paginateList(scoped, params, {
      searchFields: [(r) => r.policyDefinition.code, (r) => r.policyDefinition.name],
      sortFields: { code: (r) => r.policyDefinition.code, version: (r) => r.policyDefinition.version, status: (r) => r.policyDefinition.status },
    });
    list.status = activeStatus || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/policy-definitions";
    req.vm.opt.states = POLICY_DEFINITION_STATES;
    req.vm.opt.activeStatus = activeStatus;
    req.vm.opt.platformTenantId = PLATFORM_TENANT_ID;
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
    const canCopy = actorId ? (await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "policy_define" })).allowed : false;
    req.vm.opt.canCopy = canCopy;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/policy-definitions/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/policyDefinitionRegistry] GET /policy-definitions error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/policy-definitions/:id/copy — Registry "Copy" action: a new, editable Definition at the same version, ready to re-author. */
router.post("/policy-definitions/:id/copy", async (req: Request, res: Response) => {
  const backTo = "/aisworg/seu/policy-definitions";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : "";
  if (!actorId) return flashError(req, res, backTo, "Sign in required.");
  const auth = await badgeAuthorityEngine.authorise({ actorId, requiredBadge: "policy_define" });
  if (!auth.allowed) return flashError(req, res, backTo, "You don't hold the policy_define badge.");
  try {
    const result = await copyPolicyDefinitionAsNewDraft(String(req.params.id), actorId);
    if (!result.ok) return flashError(req, res, backTo, `Copy failed: ${result.errors.join("; ")}`);
    return flashSuccess(req, res, `/aisworg/seu/sdk/policy-authoring/${result.draftId}`, "Policy Definition copied — a new Draft is ready to edit.");
  } catch (err) {
    logger.error("[web/seu/policyDefinitionRegistry] POST /policy-definitions/:id/copy error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
