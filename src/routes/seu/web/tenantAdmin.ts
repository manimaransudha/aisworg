// Owner: "there has to be a separate view for tenant_admins. They should have
// user management screen for now. The user management screen should list
// users scoped to that tenant. tenant_admin can allocate badges to users."
// Originally scoped to Deliverable-noun badges only; owner later widened this
// to every entity_type's real noun_verb badges (core/identity.ts's
// listGrantableNounVerbBadges, sourced from authority_noun_verbs — the same
// live vocabulary badgeGrantsDB validates a grant against). Gated by
// requireRole('tenant_super') (middleware/auth.js) per owner's own
// instruction — a deliberately separate authority axis from root's own
// requirePlatformBadge-gated Identity Management (identity.ts), scoped by
// req.session.user.tenant_id rather than any badge.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requireRole } from "../../../middleware/requireRole.js";
import { safeBack } from "../../../middleware/safeBack.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import { listUsersForTenant, listGrantableNounVerbBadges, setTenantUserAuthorisedBadges } from "../core/identity.js";

const usersBackTo = "/aisworg/seu/tenant-admin/users";

/** GET /aisworg/seu/tenant-admin/users — Tenant Admin's own User Management: users scoped to their own tenant, Deliverable-verb badge grants only. */
router.get("/tenant-admin/users", requireRole(["tenant_admin"], { redirectTo: "/aisworg" }), attachVM("seu/tenantAdmin/users"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.session?.user?.tenant_id;
    if (!tenantId) {
      req.session.flash = { type: "error", message: "Your account has no tenant assigned." };
      return res.redirect("/aisworg/quickview");
    }
    const [users, badges] = await Promise.all([listUsersForTenant(tenantId), listGrantableNounVerbBadges()]);
    req.vm.req.title = "Tenant User Management";
    const params = parseListParams(req.query, { sortable: ["email", "name", "role", "created"], defaultSort: "created", defaultDir: "desc" });
    req.vm.req.list = paginateList(users, params, {
      searchFields: [(u: { email: string; name: string | null; role: string }) => u.email, (u: { name: string | null }) => u.name, (u: { role: string }) => u.role],
      sortFields: {
        email: (u: { email: string }) => u.email,
        name: (u: { name: string | null }) => u.name,
        role: (u: { role: string }) => u.role,
        created: (u: { created_at: string }) => u.created_at,
      },
    });
    req.vm.opt.listBasePath = usersBackTo;
    req.vm.req.grantableBadges = badges;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/tenantAdmin/users", req.vm);
  } catch (err) {
    logger.error("[web/seu/tenantAdmin] GET /tenant-admin/users error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/tenant-admin/users/:id/badges — owner: "write to
 *  participants_master and remove badge_grants" — reconciles a tenant user's
 *  noun_verb authorised_badges (multi-select) to exactly what's selected,
 *  same shape as Identity Management's own /identity/badges/:id/update. */
router.post("/tenant-admin/users/:id/badges", requireRole(["tenant_admin"], { redirectTo: usersBackTo }), async (req: Request, res: Response) => {
  const tenantId = req.session?.user?.tenant_id;
  // Redirect back to wherever this form was submitted from (the list page's
  // own current ?q=/sort=/page=), not the bare list path — a grant shouldn't
  // reset the tenant_super's search/filter/sort state.
  const back = safeBack(req, usersBackTo);
  if (!tenantId) return flashError(req, res, back, "Your account has no tenant assigned.");
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return flashError(req, res, back, "Invalid user id.");
  // A <select multiple> posts one badge per selection under the same key —
  // express's urlencoded parser gives an array for 2+, a single selection
  // arrives as a bare string, so both shapes need normalising.
  const rawBadges = req.body?.badges;
  const badges = (Array.isArray(rawBadges) ? rawBadges : rawBadges ? [rawBadges] : [])
    .filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v: string) => v.trim());
  try {
    const result = await setTenantUserAuthorisedBadges({ actingTenantId: tenantId, userId, badges });
    if (!result.ok) return flashError(req, res, back, `Could not update badges: ${result.detail}`);
    return flashSuccess(req, res, back, "Badges updated.");
  } catch (err) {
    logger.error("[web/seu/tenantAdmin] POST /tenant-admin/users/:id/badges error", err as Error);
    return flashError(req, res, back, (err as Error).message);
  }
});

export { router };
