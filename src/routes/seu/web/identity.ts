import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { resolveHeldBadges } from "../../../domain/identity/heldBadges.js";
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

/** GET /aisworg/seu/identity — hub: Tenant Management, Badge Management, User Management, each its own page. Root badge only, this pass. */
router.get("/identity", requireBadge(["root"], { redirectTo: "/aisworg" }), attachVM("seu/identity/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Identity Management";
    req.vm.req.counts = {
      // Bug fix (owner, 2026-08-19: "There are only 5 tenants. But .../identity
      // page shows 6 tenants") — getIdentityDashboardView's own `tenants` is
      // deliberately unfiltered (Badge Management's tenant-scoped picker,
      // .../identity/badges, needs the reserved Platform system tenant as a
      // real scope option) — but this hub tile links straight through to
      // .../identity/tenants, which correctly counts operational tenants only
      // (findAllOperational, CR-004). The tile's own number must match what's
      // actually on the other side of that link.
      tenants: view.tenants.filter((t) => !t.is_system).length,
      users: view.users.length,
    };
    // Route Authority's own CRUD screen is gated by an env-var badge, not
    // by this hub's own ["root"] gate or the (not-yet-wired) route_authority
    // table — its hub card must key off the same env-var badge, via the
    // same live resolveHeldBadges check requireBadge itself uses, not the
    // session-cached platformBadges (the env badge need not be one of the
    // fixed 3-code Platform vocabulary).
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

/** GET /aisworg/seu/identity/tenants — Tenant Management: the old Tenants tab, split out on its own. */
router.get("/identity/tenants", requireBadge(["root"], { redirectTo: "/aisworg/seu/identity" }), attachVM("seu/identity/tenants"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only the tenant list — not the whole identity dashboard (CR: this page
    // was paying for the grant/user N+1 and took ~9s).
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

/** GET /aisworg/seu/identity/badges — Badge Management. Owner: "badge_grants on
 *  the user management should be replaced with the new badges implementation"
 *  — same per-user multi-select shape as /identity/users' own authorised-role
 *  Actions column, backed by participants_master.authorised_badges instead of
 *  badge_grants (Badge Catalog tab already dropped). */
router.get("/identity/badges", requireBadge(["identity_manage"], { redirectTo: "/aisworg/seu/identity" }), attachVM("seu/identity/badges"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Badge Management";
    // Tenant filter — same shape as /identity/users' own (owner: "add a
    // tenant filter similar to user management").
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

/** GET /aisworg/seu/identity/users — User Management: the old Platform Users tab, split out on its own. */
router.get("/identity/users", requireBadge(["identity_manage"], { redirectTo: "/aisworg/seu/identity" }), attachVM("seu/identity/users"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "User Management";
    // Tenant filter — every tenant that actually has a user, not the "manageable"
    // list below (that one deliberately excludes the reserved Platform tenant,
    // which real Platform-type users DO belong to and need to be filterable by).
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
    // Owner: "Type should be renamed to Tenant. The dropdown should have the
    // tenants list" — every real tenant, Platform's own reserved row
    // included (it's a valid, real choice now: picking it is how a
    // Platform-type account gets created, createPlatformUser derives `type`
    // from it). CR-004's old operational-only filter is gone with the Type field.
    req.vm.req.tenants = view.tenants;
    // Owner: "actions dropdown should be from ontology authorised-role" —
    // the multi-select's option list.
    req.vm.req.authorisedRoleCodes = view.authorisedRoleCodes;
    // Owner: "add an action button to edit the users" — the edit form is
    // hidden for the viewer's own row (same self-edit guard the legacy
    // /auth/users page already has), so the view needs to know who's
    // looking, not just who's listed.
    req.vm.req.currentUserEmail = req.session?.user?.email ?? null;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/users", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity/users error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/identity/tenants — CR-005: create a Tenant only. Its first
 *  admin is created separately (createPlatformUser, type=Tenant) then granted
 *  the tenant_admin badge via the Badge Management grant form. */
router.post("/identity/tenants", requireBadge(["root"], { redirectTo: tenantsBackTo }), async (req: Request, res: Response) => {
  const { code, name } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim()) {
    return flashError(req, res, tenantsBackTo, "Tenant code and name are required.");
  }
  try {
    const result = await createTenant({ code: code.trim(), name: name.trim() });
    if (!result.ok) return flashError(req, res, tenantsBackTo, `Could not create Tenant: ${result.detail}`);
    return flashSuccess(req, res, tenantsBackTo, `Tenant "${result.tenant.name}" created. Create its admin user (type Tenant) and grant Tenant Admin from Badge Management.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/tenants error", err as Error);
    return flashError(req, res, tenantsBackTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/users — root creates a platform user account (badge issuance is a separate step, via Badge Management). */
router.post("/identity/users", requireBadge(["identity_manage"], { redirectTo: usersBackTo }), async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/identity/users/:id/update — owner: "add an action
 *  button to edit the users," later revised: "omit the legacy role column...
 *  actions dropdown should be from ontology authorised-role... dropdown is
 *  multi-select." Active (updatePlatformUser) and the authorised_role
 *  multi-select (setAuthorisedRoles) are two separate DB edits — users vs
 *  participants_master — run together from this one form submit. */
router.post("/identity/users/:id/update", requireBadge(["identity_manage"], { redirectTo: usersBackTo }), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return flashError(req, res, usersBackTo, "Invalid user id.");
  // An unchecked checkbox submits no key at all — its absence IS "false".
  const isActive = req.body?.isActive === "true";
  const rawRoles = req.body?.roles;
  const roles = (Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : []).filter((r): r is string => typeof r === "string" && r.trim() !== "");
  try {
    // Self-edit guard lives in both functions (by email, not id — see
    // updatePlatformUser's own comment for why id doesn't work here).
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

/** POST /aisworg/seu/identity/badges/:id/update — owner: "badge_grants on
 *  the user management should be replaced with the new badges
 *  implementation." Same multi-select-reconcile shape as
 *  /identity/users/:id/update's own authorised_role form, for
 *  authorised_badges instead. */
router.post("/identity/badges/:id/update", requireBadge(["identity_manage"], { redirectTo: badgesBackTo }), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return flashError(req, res, badgesBackTo, "Invalid user id.");
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
