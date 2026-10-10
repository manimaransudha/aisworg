import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { resolveHeldBadges, resolveAuthorBadge } from "../../../domain/identity/heldBadges.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import {
  createPlatformUser,
  createTenant,
  getIdentityDashboardView,
  listTenantsForManagement,
  setAuthorisedBadges,
  setAuthorisedRoles,
  updatePlatformUser,
} from "../core/identity.js";

const tenantsBackTo = "/aisworg/seu/identity/tenants";
const badgesBackTo = "/aisworg/seu/identity/badges";
const usersBackTo = "/aisworg/seu/identity/users";

router.get("/identity", attachVM("seu/identity/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Identity Management";
    req.vm.req.counts = {
      tenants: view.tenants.filter((t) => !t.is_system).length,
      users: view.users.length,
    };
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
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Badge Management";
    const tenantFilterOptions = [...new Map(view.users.filter((u) => u.tenantId).map((u) => [u.tenantId as string, u.tenantName ?? u.tenantId as string])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const activeTenant = typeof req.query.tenant === "string" && tenantFilterOptions.some((t) => t.id === req.query.tenant) ? req.query.tenant : "";
    const usersInTenant = activeTenant ? view.users.filter((u) => u.tenantId === activeTenant) : view.users;
    const params = parseListParams(req.query, { sortable: ["email", "name", "created"], defaultSort: "created", defaultDir: "desc" });
    const list = paginateList(usersInTenant, params, {
      searchFields: [(u) => u.email, (u) => u.name],
      sortFields: { email: (u) => u.email, name: (u) => u.name, created: (u) => u.created_at },
    });
    list.tenant = activeTenant || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/identity/badges";
    req.vm.opt.tenantFilterOptions = tenantFilterOptions;
    req.vm.opt.activeTenant = activeTenant;
    req.vm.req.authorisedBadgeCodes = view.authorisedBadgeCodes;
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
    const view = await getIdentityDashboardView();
    req.vm.req.title = "User Management";
    const tenantFilterOptions = [...new Map(view.users.filter((u) => u.tenantId).map((u) => [u.tenantId as string, u.tenantName ?? u.tenantId as string])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const activeTenant = typeof req.query.tenant === "string" && tenantFilterOptions.some((t) => t.id === req.query.tenant) ? req.query.tenant : "";
    const usersInTenant = activeTenant ? view.users.filter((u) => u.tenantId === activeTenant) : view.users;
    const params = parseListParams(req.query, { sortable: ["email", "name", "role", "created"], defaultSort: "created", defaultDir: "desc" });
    const list = paginateList(usersInTenant, params, {
      searchFields: [(u) => u.email, (u) => u.name],
      sortFields: { email: (u) => u.email, name: (u) => u.name, role: (u) => u.role, created: (u) => u.created_at },
    });
    list.tenant = activeTenant || undefined;
    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/identity/users";
    req.vm.opt.tenantFilterOptions = tenantFilterOptions;
    req.vm.opt.activeTenant = activeTenant;
    req.vm.req.tenants = view.tenants;
    req.vm.req.authorisedRoleCodes = view.authorisedRoleCodes;
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
    return flashError(req, res, tenantsBackTo, "Tenant code and name are required.");
  }
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, tenantsBackTo, "No actor resolved for this Tenant creation.");
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return flashError(req, res, tenantsBackTo, "No author badge resolved for this Tenant creation.");
  try {
    const result = await createTenant({ code: code.trim(), name: name.trim(), authorId: actorId, authorBadge, is_system: false });
    if (!result.ok) return flashError(req, res, tenantsBackTo, `Could not create Tenant: ${result.detail}`);
    return flashSuccess(req, res, tenantsBackTo, `Tenant "${result.tenant.name}" created. Create its admin user (type Tenant) and grant Tenant Admin from Badge Management.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/tenants error", err as Error);
    return flashError(req, res, tenantsBackTo, (err as Error).message);
  }
});

router.post("/identity/users", async (req: Request, res: Response) => {
  const { email, name, tenantId } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) {
    return flashError(req, res, usersBackTo, "Email is required.");
  }
  if (typeof tenantId !== "string" || !tenantId.trim()) {
    return flashError(req, res, usersBackTo, "A tenant must be selected.");
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
    if (!result.ok) return flashError(req, res, usersBackTo, `Could not create user: ${result.detail}`);
    return flashSuccess(req, res, usersBackTo, result.verificationLink ? `User created. SMTP not configured — verification link: ${result.verificationLink}` : `User created — verification email sent to ${result.email}.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/users error", err as Error);
    return flashError(req, res, usersBackTo, (err as Error).message);
  }
});

router.post("/identity/users/:id/update", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!id) return flashError(req, res, usersBackTo, "Invalid user id.");
  const isActive = req.body?.isActive === "true";
  const rawRoles = req.body?.roles;
  const roles = (Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : []).filter((r): r is string => typeof r === "string" && r.trim() !== "");
  try {
    const actingUserEmail = req.session?.user?.email ?? null;
    const activeResult = await updatePlatformUser({ id, isActive, actingUserEmail });
    if (!activeResult.ok) return flashError(req, res, usersBackTo, `Could not update user: ${activeResult.detail}`);
    const rolesResult = await setAuthorisedRoles({ id, roles, actingUserEmail });
    if (!rolesResult.ok) return flashError(req, res, usersBackTo, `Could not update authorised roles: ${rolesResult.detail}`);
    return flashSuccess(req, res, usersBackTo, "User updated.");
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/users/:id/update error", err as Error);
    return flashError(req, res, usersBackTo, (err as Error).message);
  }
});

router.post("/identity/badges/:id/update", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!id) return flashError(req, res, badgesBackTo, "Invalid user id.");
  const rawBadges = req.body?.badges;
  const badges = (Array.isArray(rawBadges) ? rawBadges : rawBadges ? [rawBadges] : []).filter((b): b is string => typeof b === "string" && b.trim() !== "");
  try {
    const actingUserEmail = req.session?.user?.email ?? null;
    const result = await setAuthorisedBadges({ id, badges, actingUserEmail });
    if (!result.ok) return flashError(req, res, badgesBackTo, `Could not update authorised badges: ${result.detail}`);
    return flashSuccess(req, res, badgesBackTo, "Badges updated.");
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/badges/:id/update error", err as Error);
    return flashError(req, res, badgesBackTo, (err as Error).message);
  }
});

export { router };
