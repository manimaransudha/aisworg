import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { safeBack } from "../../../middleware/safeBack.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import { listUsersForTenant, listGrantableNounVerbBadges, setTenantUserAuthorisedBadges } from "../core/identity.js";

const usersBackTo = "/aisworg/seu/tenant-admin/users";

router.get("/tenant-admin/users", attachVM("seu/tenantAdmin/users"), async (req: Request, res: Response, next: NextFunction) => {
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

router.post("/tenant-admin/users/:id/badges", async (req: Request, res: Response) => {
  const tenantId = req.session?.user?.tenant_id;
  const back = safeBack(req, usersBackTo);
  if (!tenantId) return flashError(req, res, back, "Your account has no tenant assigned.");
  const userId = String(req.params.id);
  if (!userId) return flashError(req, res, back, "Invalid user id.");
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
