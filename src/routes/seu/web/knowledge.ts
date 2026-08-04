import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { getEngineeringCapital } from "../core/knowledge.js";

/** GET /aisworg/seu/knowledge/capital — Ch.16 §13 / Book 1 Ch.21 §21.6: Engineering Capital, platform-wide. */
router.get("/knowledge/capital", attachVM("seu/knowledge/capital"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Engineering Capital";
    req.vm.req.engineeringCapital = await getEngineeringCapital();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/knowledge/capital", req.vm);
  } catch (err) {
    logger.error("[web/seu/knowledge] GET /knowledge/capital error", err as Error);
    next(err);
  }
});

export { router };
