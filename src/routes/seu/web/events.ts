import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { requireRole } from "../../../middleware/auth.js";
import { parseListParams, listResult } from "../../../utils/listQuery.js";
import { logger } from "../../../utils/logger.js";
import { getEventsPage } from "../core/events.js";

// CR-074 (owner: "Create a UI to show the EventBus (events table)") — a
// general, filterable, paginated browser over the raw events table, not
// scoped to one SEU/entity. Super only, same gating as the other links in
// this Profile dropdown (Settings, Users).
router.get("/events", requireRole("super"), attachVM("seu/events/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Event Bus";
    const seuId = typeof req.query.seuId === "string" ? req.query.seuId.trim() : "";
    const eventType = typeof req.query.eventType === "string" ? req.query.eventType.trim() : "";
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType.trim() : "";
    req.vm.req.filters = { seuId, eventType, entityType };

    const params = parseListParams(req.query, { sortable: [], defaultSort: "" });
    const { items, total } = await getEventsPage({
      limit: params.limit,
      offset: params.offset,
      seuId: seuId || undefined,
      eventType: eventType || undefined,
      entityType: entityType || undefined,
    });
    req.vm.req.list = listResult(items, total, params);
    return renderView(req, res, "seu/events/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/events] GET /events error", err as Error);
    next(err);
  }
});

export { router };
