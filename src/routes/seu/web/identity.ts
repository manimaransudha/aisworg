import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requirePlatformBadge } from "../../../middleware/requirePlatformBadge.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import {
  createOrRenameTenantBadge,
  createPlatformUser,
  createTenant,
  getIdentityDashboardView,
  issueBadgeGrant,
  listTenantsForManagement,
  revokeBadgeGrant,
} from "../core/identity.js";
import type { BadgeScopeKind, TransitionEntityType } from "../../../dblayer/seuTypes.js";

const tenantsBackTo = "/aisworg/seu/identity/tenants";
const badgesBackTo = "/aisworg/seu/identity/badges";
const usersBackTo = "/aisworg/seu/identity/users";

/** GET /aisworg/seu/identity — hub: Tenant Management, Badge Management, User Management, each its own page. Root badge only, this pass. */
router.get("/identity", requirePlatformBadge("root"), attachVM("seu/identity/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Identity Management";
    req.vm.req.counts = {
      tenants: view.tenants.length,
      badgeTypes: view.badgeTypes.length,
      grants: view.grants.length,
      users: view.users.length,
    };
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/identity/tenants — Tenant Management: the old Tenants tab, split out on its own. */
router.get("/identity/tenants", requirePlatformBadge("root"), attachVM("seu/identity/tenants"), async (req: Request, res: Response, next: NextFunction) => {
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

/** GET /aisworg/seu/identity/badges — Badge Management: the old Badge Catalog + Badge Grants tabs, combined on their own page. */
router.get("/identity/badges", requirePlatformBadge("root"), attachVM("seu/identity/badges"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "Badge Management";
    req.vm.req.badgeTypes = view.badgeTypes;
    req.vm.req.tenants = view.tenants;
    // The grants list is the large one (accumulates over time) — paginate it.
    // badgeTypes/tenants are bounded vocabulary, rendered in full.
    // "entity" (governed_entity_type) dropped as a sort/search key — it only
    // ever carried data for the retired Layer 2b Creator/Reviewer/Approver
    // grants (migration 043); every remaining/future grant leaves it NULL.
    const params = parseListParams(req.query, { sortable: ["badge", "holder", "created"], defaultSort: "created", defaultDir: "desc" });
    req.vm.req.list = paginateList(view.grants, params, {
      searchFields: [(g) => g.badge_type, (g) => g.holderEmail, (g) => g.holder_id],
      sortFields: { badge: (g) => g.badge_type, holder: (g) => g.holderEmail ?? g.holder_id, created: (g) => g.created_at },
    });
    req.vm.opt.listBasePath = "/aisworg/seu/identity/badges";
    // Bug fix: paginating/sorting/searching the Badge Grants tab is a full
    // page GET (listControls' links, no JS) — Bootstrap's own tab state is
    // client-side only and always re-initialises to the first tab (Badge
    // Catalog) on reload, silently dropping the user back there even though
    // they were paging through Grants. Only the Grants tab ever produces any
    // of these query params (the Catalog tables aren't paginated/searchable),
    // so their mere presence is enough to know which tab to reopen.
    req.vm.opt.activeTab = (req.query.sort || req.query.dir || req.query.page || req.query.pageSize || req.query.q) ? "grants" : "catalog";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/identity/badges", req.vm);
  } catch (err) {
    logger.error("[web/seu/identity] GET /identity/badges error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/identity/users — User Management: the old Platform Users tab, split out on its own. */
router.get("/identity/users", requirePlatformBadge("root"), attachVM("seu/identity/users"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await getIdentityDashboardView();
    req.vm.req.title = "User Management";
    const params = parseListParams(req.query, { sortable: ["email", "name", "role", "created"], defaultSort: "created", defaultDir: "desc" });
    req.vm.req.list = paginateList(view.users, params, {
      searchFields: [(u) => u.email, (u) => u.name, (u) => u.role],
      sortFields: { email: (u) => u.email, name: (u) => u.name, role: (u) => u.role, created: (u) => u.created_at },
    });
    req.vm.opt.listBasePath = "/aisworg/seu/identity/users";
    // CR-004: operational tenants for the create-user tenant picker (excludes the reserved 'platform').
    req.vm.req.tenants = view.tenants.filter((t) => !t.is_system);
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
router.post("/identity/tenants", requirePlatformBadge("root"), async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/identity/badge-types — §8.1: rename an inherited badge, or add a new one derived from a Platform-recommended badge. */
router.post("/identity/badge-types", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { tenantId, code, name, scopeKind, derivedFrom } = req.body ?? {};
  if (typeof tenantId !== "string" || !tenantId.trim() || typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim() || typeof scopeKind !== "string") {
    return flashError(req, res, badgesBackTo, "Tenant, code, name, and scope kind are all required.");
  }
  try {
    const result = await createOrRenameTenantBadge({
      tenantId: tenantId.trim(),
      code: code.trim(),
      name: name.trim(),
      scopeKind: scopeKind as BadgeScopeKind,
      derivedFrom: typeof derivedFrom === "string" && derivedFrom.trim() ? derivedFrom.trim() : null,
    });
    if (!result.ok) return flashError(req, res, badgesBackTo, `Could not create badge: ${result.detail}`);
    return flashSuccess(req, res, badgesBackTo, `Badge "${result.badgeType.name}" (${result.badgeType.code}) created.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/badge-types error", err as Error);
    return flashError(req, res, badgesBackTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/grants — issue a badge_grants row (§9's one point of entry, via badgeGrantsDB). */
router.post("/identity/grants", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { holderEmail, badgeType, governedEntityType, capabilityId, scopeId } = req.body ?? {};
  if (typeof holderEmail !== "string" || !holderEmail.trim() || typeof badgeType !== "string" || !badgeType.trim()) {
    return flashError(req, res, badgesBackTo, "Holder email and badge type are required.");
  }
  try {
    const result = await issueBadgeGrant({
      holderEmail: holderEmail.trim(),
      badgeType: badgeType.trim(),
      governedEntityType: typeof governedEntityType === "string" && governedEntityType.trim() ? (governedEntityType.trim() as TransitionEntityType) : null,
      capabilityId: typeof capabilityId === "string" && capabilityId.trim() ? capabilityId.trim() : null,
      scopeId: typeof scopeId === "string" && scopeId.trim() ? scopeId.trim() : null,
    });
    if (!result.ok) return flashError(req, res, badgesBackTo, `Could not issue badge: ${result.detail}`);
    return flashSuccess(req, res, badgesBackTo, `"${badgeType}" granted to ${holderEmail}.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/grants error", err as Error);
    return flashError(req, res, badgesBackTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/users — root creates a platform user account (badge issuance is a separate step, via Badge Management). */
router.post("/identity/users", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { email, name, type, tenantId } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) {
    return flashError(req, res, usersBackTo, "Email is required.");
  }
  if (type !== "Platform" && type !== "Tenant") {
    return flashError(req, res, usersBackTo, "User type (Platform or Tenant) is required.");
  }
  if (type === "Tenant" && (typeof tenantId !== "string" || !tenantId.trim())) {
    return flashError(req, res, usersBackTo, "A tenant must be selected for a Tenant user.");
  }
  try {
    const result = await createPlatformUser({
      email: email.trim(),
      name: typeof name === "string" ? name.trim() : undefined,
      type,
      tenantId: type === "Tenant" ? String(tenantId).trim() : undefined,
    });
    if (!result.ok) return flashError(req, res, usersBackTo, `Could not create user: ${result.detail}`);
    return flashSuccess(req, res, usersBackTo, result.verificationLink ? `User created. SMTP not configured — verification link: ${result.verificationLink}` : `User created — verification email sent to ${result.email}.`);
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/users error", err as Error);
    return flashError(req, res, usersBackTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/identity/grants/:id/revoke */
router.post("/identity/grants/:id/revoke", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  try {
    const result = await revokeBadgeGrant(String(req.params.id));
    if (!result.ok) return flashError(req, res, badgesBackTo, `Could not revoke grant: ${result.detail}`);
    return flashSuccess(req, res, badgesBackTo, "Badge grant revoked.");
  } catch (err) {
    logger.error("[web/seu/identity] POST /identity/grants/:id/revoke error", err as Error);
    return flashError(req, res, badgesBackTo, (err as Error).message);
  }
});

export { router };
