import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { parseListParams, listResult } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import { getVersionEventsPage } from "../core/versionEvents.js";

router.get("/version-events", attachVM("seu/versionEvents/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Version Replay";
    // A viewer other than root sees the version events of their own tenant only. The tenant filter of the query applies to root alone.
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const sessionTenantId = req.session?.user?.tenant_id ?? null;
    if (!isRoot && !sessionTenantId) throw new Error("the session user has no tenant");
    const tenantId = isRoot ? (typeof req.query.tenantId === "string" ? req.query.tenantId.trim() : "") : (sessionTenantId ?? "");
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType.trim() : "";
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId.trim() : "";
    const versionEvent = typeof req.query.versionEvent === "string" ? req.query.versionEvent.trim() : "";
    req.vm.req.filters = { tenantId, entityType, entityId, versionEvent };

    const params = parseListParams(req.query, {
      sortable: ["occurredAt", "entityType", "versionEvent"],
      defaultSort: "occurredAt",
      defaultDir: "asc",
    });
    const { items, total } = await getVersionEventsPage({
      limit: params.limit,
      offset: params.offset,
      tenantId: tenantId || undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      versionEvent: versionEvent || undefined,
      sort: params.sort,
      dir: params.dir,
    });
    req.vm.req.list = listResult(items, total, params);
    return renderView(req, res, "seu/versionEvents/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/versionEvents] GET /version-events error", err as Error);
    next(err);
  }
});

export { router };
