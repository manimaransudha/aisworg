import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { packsDB } from "../../../dblayer/packsDB.js";

/** GET /aisworg/seu/packs — Extension Framework: every hand-authored Pack loaded via the seed script. */
router.get("/packs", attachVM("seu/packs/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: packs } = await packsDB.findAll();
    req.vm.req.title = "Packs";
    req.vm.req.packs = packs ?? [];
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/packs/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/packs] GET /packs error", err as Error);
    next(err);
  }
});

export { router };
