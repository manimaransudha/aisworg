import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { resolveHeldBadges, resolveActorAndBadge } from "../../../domain/identity/heldBadges.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import {
  createPlatformUser,
  createTenant,
  getIdentityCounts,
  listAllTenants,
  listAuthorisedBadgeCodes,
  listAuthorisedRoleCodes,
  listPlatformUsersPaginated,
  listUserTenantFilterOptions,
  listTenantsForManagement,
  setAuthorisedBadges,
  setAuthorisedRoles,
  updatePlatformUser,
} from "../core/identity.js";


router.get("/identity", attachVM("seu/identity/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Identity Management";
    req.vm.req.counts = await getIdentityCounts();
    const routeAuthorityBadge = process.env.ROUTE_AUTHORITY_ADMIN_BADGE || "root";
    const held = await resolveHeldBadges(req);
    req.vm.req.showRouteAuthorityCard = held.has(routeAuthorityBadge);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity error", err as Error);
    next(err);
  }
});

router.get("/identity/tenants", attachVM("seu/identity/tenants"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await listTenantsForManagement();
    req.vm.req.title = "Tenant Management";
    const params = parseListParams(req.query, { sortable: ["code", "name", "status", "created"], defaultSort: "created", defaultDir: "asc" });
    req.vm.req.list = paginateList(tenants, params, {
      searchFields: [(t) => t.code, (t) => t.name, (t) => t.status],
      sortFields: { code: (t) => t.code, name: (t) => t.name, status: (t) => t.status, created: (t) => t.created_at },
    });
    req.vm.opt.listBasePath = "/aisworg/seu/identity/tenants";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/tenants", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity/tenants error", err as Error);
    next(err);
  }
});

router.get("/identity/badges", attachVM("seu/identity/badges"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Badge Management";
    const tenantFilterOptions = await listUserTenantFilterOptions();
    const activeTenant = typeof req.query.tenant === "string" && tenantFilterOptions.some((t) => t.id === req.query.tenant) ? req.query.tenant : "";
    const params = parseListParams(req.query, { sortable: ["email", "name", "created"], defaultSort: "created", defaultDir: "desc" });
    const list = await listPlatformUsersPaginated(params, activeTenant || undefined);
    list.tenant = activeTenant || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/identity/badges";
    req.vm.opt.tenantFilterOptions = tenantFilterOptions;
    req.vm.opt.activeTenant = activeTenant;
    req.vm.req.authorisedBadgeCodes = await listAuthorisedBadgeCodes();
    req.vm.req.currentUserEmail = req.session?.user?.email ?? null;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/badges", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity/badges error", err as Error);
    next(err);
  }
});

router.get("/identity/users", attachVM("seu/identity/users"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "User Management";
    const tenantFilterOptions = await listUserTenantFilterOptions();
    const activeTenant = typeof req.query.tenant === "string" && tenantFilterOptions.some((t) => t.id === req.query.tenant) ? req.query.tenant : "";
    const params = parseListParams(req.query, { sortable: ["email", "name", "created"], defaultSort: "created", defaultDir: "desc" });
    const list = await listPlatformUsersPaginated(params, activeTenant || undefined);
    list.tenant = activeTenant || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/identity/users";
    req.vm.opt.tenantFilterOptions = tenantFilterOptions;
    req.vm.opt.activeTenant = activeTenant;
    req.vm.req.tenants = await listAllTenants();
    req.vm.req.authorisedRoleCodes = await listAuthorisedRoleCodes();
    req.vm.req.currentUserEmail = req.session?.user?.email ?? null;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/users", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity/users error", err as Error);
    next(err);
  }
});

router.post("/identity/tenants", async (req: Request, res: Response) => {
  const { code, name } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim()) {
    return redirects.seu.identityTenants.error(req, res, "Tenant code and name are required.");
  }
  const { actorId, authorBadge } = await resolveActorAndBadge(req);
  try {
    const result = await createTenant({ code: code.trim(), name: name.trim(), authorId: actorId, authorBadge, is_system: false });
    if (!result.ok) return redirects.seu.identityTenants.error(req, res, `Could not create Tenant: ${result.detail}`);
    return redirects.seu.identityTenants.success(req, res, `Tenant "${result.tenant.name}" created. Create its admin user (type Tenant) and grant Tenant Admin from Badge Management.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/tenants error", err as Error);
    return redirects.seu.identityTenants.error(req, res, (err as Error).message);
  }
});

router.post("/identity/users", async (req: Request, res: Response) => {
  const { email, name, tenantId } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) {
    return redirects.seu.identityUsers.error(req, res, "Email is required.");
  }
  if (typeof tenantId !== "string" || !tenantId.trim()) {
    return redirects.seu.identityUsers.error(req, res, "A tenant must be selected.");
  }
  const rawRoles = req.body?.roles;
  const authorisedRoles = (Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : []).filter((r): r is string => typeof r === "string" && r.trim() !== "");
  try {
    const result = await createPlatformUser({
      email: email.trim(),
      name: typeof name === "string" ? name.trim() : undefined,
      tenantId: tenantId.trim(),
      authorisedRoles,
    });
    if (!result.ok) return redirects.seu.identityUsers.error(req, res, `Could not create user: ${result.detail}`);
    return redirects.seu.identityUsers.success(req, res, result.verificationLink ? `User created. SMTP not configured — verification link: ${result.verificationLink}` : `User created — verification email sent to ${result.email}.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/users error", err as Error);
    return redirects.seu.identityUsers.error(req, res, (err as Error).message);
  }
});

router.post("/identity/users/:id/update", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!id) return redirects.seu.identityUsers.error(req, res, "Invalid user id.");
  const isActive = req.body?.isActive === "true";
  const rawRoles = req.body?.roles;
  const roles = (Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : []).filter((r): r is string => typeof r === "string" && r.trim() !== "");
  try {
    const actingUserEmail = req.session?.user?.email ?? null;
    const activeResult = await updatePlatformUser({ id, isActive, actingUserEmail });
    if (!activeResult.ok) return redirects.seu.identityUsers.error(req, res, `Could not update user: ${activeResult.detail}`);
    const rolesResult = await setAuthorisedRoles({ id, roles, actingUserEmail });
    if (!rolesResult.ok) return redirects.seu.identityUsers.error(req, res, `Could not update authorised roles: ${rolesResult.detail}`);
    return redirects.seu.identityUsers.success(req, res, "User updated.");
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/users/:id/update error", err as Error);
    return redirects.seu.identityUsers.error(req, res, (err as Error).message);
  }
});

router.post("/identity/badges/:id/update", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!id) return redirects.seu.identityBadgesUpdate.error(req, res, "Invalid user id.");
  const rawBadges = req.body?.badges;
  const badges = (Array.isArray(rawBadges) ? rawBadges : rawBadges ? [rawBadges] : []).filter((b): b is string => typeof b === "string" && b.trim() !== "");
  try {
    const actingUserEmail = req.session?.user?.email ?? null;
    const result = await setAuthorisedBadges({ id, badges, actingUserEmail });
    if (!result.ok) return redirects.seu.identityBadgesUpdate.error(req, res, `Could not update authorised badges: ${result.detail}`);
    return redirects.seu.identityBadgesUpdate.success(req, res, "Badges updated.");
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/badges/:id/update error", err as Error);
    return redirects.seu.identityBadgesUpdate.error(req, res, (err as Error).message);
  }
});

export { router };
