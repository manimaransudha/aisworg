import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { redirects } from "../../../middleware/redirects.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { listAttentionItems, transitionAttentionItem } from "../core/attentionItems.js";
import { nextActionsFor } from "../../../domain/engine/entityTransition.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { requireActorId } from "../../../domain/identity/heldBadges.js";

router.get("/attention", attachVM("seu/attention/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await listAttentionItems();
    const actorId = requireActorId(req);
    const attentionActions: Record<string, Awaited<ReturnType<typeof nextActionsFor>>> = {};
    for (const item of items) attentionActions[item.id] = await nextActionsFor("AttentionItem", item.status, actorId);
    req.vm.req.attentionActions = attentionActions;
    const withStates = items.map((attentionItem) => ({ attentionItem }));
    req.vm.req.title = "Attention";
    const params = parseListParams(req.query, { sortable: ["priority", "category", "title", "status"], defaultSort: "priority", defaultDir: "asc" });
    req.vm.req.list = paginateList(withStates, params, {
      searchFields: [(a) => a.attentionItem.title, (a) => a.attentionItem.description, (a) => a.attentionItem.category],
      sortFields: {
        priority: (a) => a.attentionItem.priority,
        category: (a) => a.attentionItem.category,
        title: (a) => a.attentionItem.title,
        status: (a) => a.attentionItem.status,
      },
    });
    req.vm.opt.listBasePath = "/aisworg/seu/attention";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/attention/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/attention] GET /attention error", err as Error);
    next(err);
  }
});

router.post("/attention/:id/transition/:verb", async (req: Request, res: Response) => {
  try {
    const actorId = requireActorId(req);
    const attentionItemId = String(req.params.id);
    const { data: attentionItem } = await attentionItemsDB.findById(attentionItemId);
    if (!attentionItem) return redirects.seu.attentionTransition.error(req, res, "Attention Item not found.");
    const action = (await nextActionsFor("AttentionItem", attentionItem.status, actorId)).find((a) => a.verb === String(req.params.verb));
    if (!action) return redirects.seu.attentionTransition.error(req, res, `Attention Item transition blocked: "${String(req.params.verb)}" is not available from ${attentionItem.status}.`);
    const result = await transitionAttentionItem({ attentionItemId, targetState: action.toState, actorId });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.attentionTransition.error(req, res, `Attention Item transition blocked: ${reason}`);
    }
    return redirects.seu.attentionTransition.success(req, res, `Attention Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/attention] POST /attention/:id/transition/:verb error", err as Error);
    return redirects.seu.attentionTransition.error(req, res, (err as Error).message);
  }
});

export { router };
