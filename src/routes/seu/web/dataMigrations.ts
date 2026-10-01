// Admin screen: root triggers the baseline-data population that used to
// happen only via a one-off migration INSERT, so authored_by/author_badge
// (both NOT NULL) get the real logged-in root's participants_master id and
// 'root' badge instead of being left for a migration to fill in.
//
// Gating: root-only, via a literal requireBadge call, same pattern
// routeAuthorityRegistry.ts uses for itself -- NOT via route_authority
// (CR-110's own global gate exempts this path, same as route-authority's
// own screen: this is the screen that POPULATES route_authority
// (seedRouteAuthority.ts), so gating it BY route_authority is circular —
// on a table with zero rows, visiting the page that would fix it is itself
// denied, and the deny-redirect's Referer bounce is an infinite loop).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { DATA_MIGRATION_TARGETS, resolveRootActor, runDataMigrations } from "../core/dataMigrations.js";

const backTo = "/aisworg/seu/data-migrations";
const gate = requireBadge(["root"], { redirectTo: "/aisworg" });

/** GET /aisworg/seu/data-migrations */
router.get("/data-migrations", gate, attachVM("seu/data-migrations/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Data Migrations";
    const params = parseListParams(req.query, { sortable: ["target", "tables"], defaultSort: "target", defaultDir: "asc" });
    req.vm.req.list = paginateList(DATA_MIGRATION_TARGETS, params, {
      searchFields: [(t) => t.label, (t) => t.tables.join(" ")],
      sortFields: { target: (t) => t.label, tables: (t) => t.tables.join(" ") },
    });
    req.vm.opt.listBasePath = backTo;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/data-migrations/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/dataMigrations] GET /data-migrations error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/data-migrations/run */
router.post("/data-migrations/run", gate, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.user?.id != null ? String(req.session.user.id) : null;
    if (!userId) return flashError(req, res, backTo, "No logged-in user on this session.");

    const rawCodes = req.body?.codes;
    const codes = Array.isArray(rawCodes) ? rawCodes.map(String) : rawCodes != null ? [String(rawCodes)] : [];

    const actor = await resolveRootActor(userId);
    const results = await runDataMigrations(actor, userId, codes);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      return flashError(req, res, backTo, `Failed: ${failed.map((f) => `${f.code} (${f.error})`).join("; ")}`);
    }
    return flashSuccess(req, res, backTo, `Ran ${results.length} data migration(s), authored by this session's root participant.`);
  } catch (err) {
    logger.error("[web/seu/dataMigrations] POST /data-migrations/run error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
