import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { listServices } from "../core/services.js";

/** GET /aisworg/seu/services — Ch.11: every declared Service and its Service Level. */
router.get("/services", attachVM("seu/services/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Services";
    req.vm.req.services = await listServices();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/services/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/services] GET /services error", err as Error);
    next(err);
  }
});

export { router };
