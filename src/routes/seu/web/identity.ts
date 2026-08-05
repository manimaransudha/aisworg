import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requirePlatformBadge } from "../../../middleware/requirePlatformBadge.js";
import { logger } from "../../../utils/logger.js";
import {
  createOrRenameTenantBadge,
  createPlatformUser,
  createTenantWithFirstAdmin,
  getIdentityDashboardView,
  issueBadgeGrant,
  revokeBadgeGrant,
} from "../core/identity.js";
import type { BadgeScopeKind, TransitionEntityType } from "../../../dblayer/seuTypes.js";

const backTo = "/aisworg/seu/identity";

/** GET /aisworg/seu/identity — design doc §7/§8.2: everything badge/tenant admin goes through here. Root badge only, this pass. */
router.get("/identity", requirePlatformBadge("root"), attachVM("seu/identity/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Identity Management";
    req.vm.req.tenants = view.tenants;
    req.vm.req.badgeTypes = view.badgeTypes;
    req.vm.req.grants = view.grants;
    req.vm.req.users = view.users;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/identity/tenants — §8.2/§9: root creates a Tenant and grants its first Tenant Admin badge, bundled. */
router.post("/identity/tenants", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { code, name, adminEmail } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim() || typeof adminEmail !== "string" || !adminEmail.trim()) {
    return flashError(req, res, backTo, "Tenant code, name, and the first Tenant Admin's email are all required.");
  }
  try {
    const result = await createTenantWithFirstAdmin({ code: code.trim(), name: name.trim(), adminEmail: adminEmail.trim() });
    if (!result.ok) return flashError(req, res, backTo, `Could not create Tenant: ${result.detail}`);
    return flashSuccess(req, res, backTo, `Tenant "${result.tenant.name}" created — ${adminEmail} granted Tenant Admin.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/tenants error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/badge-types — §8.1: rename an inherited badge, or add a new one derived from a Platform-recommended badge. */
router.post("/identity/badge-types", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { tenantId, code, name, scopeKind, derivedFrom } = req.body ?? {};
  if (typeof tenantId !== "string" || !tenantId.trim() || typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim() || typeof scopeKind !== "string") {
    return flashError(req, res, backTo, "Tenant, code, name, and scope kind are all required.");
  }
  try {
    const result = await createOrRenameTenantBadge({
      tenantId: tenantId.trim(),
      code: code.trim(),
      name: name.trim(),
      scopeKind: scopeKind as BadgeScopeKind,
      derivedFrom: typeof derivedFrom === "string" && derivedFrom.trim() ? derivedFrom.trim() : null,
    });
    if (!result.ok) return flashError(req, res, backTo, `Could not create badge: ${result.detail}`);
    return flashSuccess(req, res, backTo, `Badge "${result.badgeType.name}" (${result.badgeType.code}) created.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/badge-types error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/grants — issue a badge_grants row (§9's one point of entry, via badgeGrantsDB). */
router.post("/identity/grants", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { holderEmail, badgeType, governedEntityType, capabilityId, scopeId } = req.body ?? {};
  if (typeof holderEmail !== "string" || !holderEmail.trim() || typeof badgeType !== "string" || !badgeType.trim()) {
    return flashError(req, res, backTo, "Holder email and badge type are required.");
  }
  try {
    const result = await issueBadgeGrant({
      holderEmail: holderEmail.trim(),
      badgeType: badgeType.trim(),
      governedEntityType: typeof governedEntityType === "string" && governedEntityType.trim() ? (governedEntityType.trim() as TransitionEntityType) : null,
      capabilityId: typeof capabilityId === "string" && capabilityId.trim() ? capabilityId.trim() : null,
      scopeId: typeof scopeId === "string" && scopeId.trim() ? scopeId.trim() : null,
    });
    if (!result.ok) return flashError(req, res, backTo, `Could not issue badge: ${result.detail}`);
    return flashSuccess(req, res, backTo, `"${badgeType}" granted to ${holderEmail}.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/grants error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/users — root creates a platform user account (badge issuance is a separate step, via the Badge Grants tab). */
router.post("/identity/users", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { email, name } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) {
    return flashError(req, res, backTo, "Email is required.");
  }
  try {
    const result = await createPlatformUser({ email: email.trim(), name: typeof name === "string" ? name.trim() : undefined });
    if (!result.ok) return flashError(req, res, backTo, `Could not create user: ${result.detail}`);
    return flashSuccess(req, res, backTo, result.verificationLink ? `User created. SMTP not configured — verification link: ${result.verificationLink}` : `User created — verification email sent to ${result.email}.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/users error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/grants/:id/revoke */
router.post("/identity/grants/:id/revoke", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  try {
    const result = await revokeBadgeGrant(String(req.params.id));
    if (!result.ok) return flashError(req, res, backTo, `Could not revoke grant: ${result.detail}`);
    return flashSuccess(req, res, backTo, "Badge grant revoked.");
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/grants/:id/revoke error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
