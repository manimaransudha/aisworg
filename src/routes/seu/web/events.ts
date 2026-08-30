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
    // Owner: "Include a search by the name" — the entity's own `code`/`name`
    // lives inside payload (there's no dedicated column for it; see
    // _entityLabel in the view, added for the same reason), so this searches
    // payload->>'code' / payload->>'name' rather than a real column.
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    req.vm.req.filters = { seuId, eventType, entityType, name };

    // Owner: "In the eventbus UI, the columns should be sortable." — defaults
    // to sequence/desc, matching the previous hardcoded ORDER BY exactly, so
    // an unsorted visit looks the same as before.
    const params = parseListParams(req.query, {
      sortable: ["sequence", "eventType", "entityType", "seuId", "actor", "occurredAt"],
      defaultSort: "sequence",
      defaultDir: "desc",
    });
    const { items, total } = await getEventsPage({
      limit: params.limit,
      offset: params.offset,
      seuId: seuId || undefined,
      eventType: eventType || undefined,
      entityType: entityType || undefined,
      name: name || undefined,
      sort: params.sort,
      dir: params.dir,
    });
    req.vm.req.list = listResult(items, total, params);
    return renderView(req, res, "seu/events/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/events] GET /events error", err as Error);
    next(err);
  }
});

export { router };
