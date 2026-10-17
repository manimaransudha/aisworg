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
import { listAttentionItems, listAttentionItemsWithNextStates, transitionAttentionItem } from "../core/attentionItems.js";

router.get("/attention", attachVM("seu/attention/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await listAttentionItems();
    const withStates = await listAttentionItemsWithNextStates(items);
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

router.post("/attention/:id/transition", async (req: Request, res: Response) => {
  const { targetState } = req.body ?? {};

  if (typeof targetState !== "string" || !targetState.trim()) {
    return redirects.seu.attentionTransition.error(req, res, "Target state is required.");
  }

  try {
    if (req.session?.user?.id == null) return redirects.seu.attentionTransition.error(req, res, "Authentication required.");
    const result = await transitionAttentionItem({
      attentionItemId: String(req.params.id),
      targetState,
      actorId: String(req.session.user.id),
    });
    if (!result.ok) {
      const reason = "detail" in result ? result.detail : result.reason;
      return redirects.seu.attentionTransition.error(req, res, `Attention Item transition blocked: ${reason}`);
    }
    return redirects.seu.attentionTransition.success(req, res, `Attention Item moved from "${result.appliedTransition.fromState}" to "${result.appliedTransition.toState}".`);
  } catch (err) {
    logger.error("[web/seu/attention] POST /attention/:id/transition error", err as Error);
    return redirects.seu.attentionTransition.error(req, res, (err as Error).message);
  }
});

export { router };
