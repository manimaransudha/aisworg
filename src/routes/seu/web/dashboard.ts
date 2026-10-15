import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";

router.get("/", (_req: Request, res: Response) => res.redirect("/aisworg"));

router.get("/dashboard/demo", attachVM("seu/dashboardDemo"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "SEU Platform";
    req.vm.req.about = renderMarkdown(readFileSync(path.join(process.cwd(), "src", "dry-run-suite", "demoLanding.md"), "utf8"));
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/dashboardDemo", req.vm);
  } catch (err) {
    logger.error("[Dashboard] GET /dashboard/demo error:", err);
    next(err);
  }
});

export { router };
