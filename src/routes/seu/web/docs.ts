import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { logger } from "../../../utils/logger.js";
import { renderDocMarkdown } from "../../../domain/sdk/markdownRender.js";
import { DOCS_ROOT, listDocsDir, listTopLevelDocFolders } from "../../../domain/sdk/docsTree.js";

router.get("/docs", attachVM("seu/docs/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folders = listTopLevelDocFolders();
    req.vm.req.title = "Documentation";
    req.vm.req.folders = folders;
    return renderView(req, res, "seu/docs/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/docs] GET /docs error", err as Error);
    next(err);
  }
});

router.get("/docs/*splat", attachVM("seu/docs/browse"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segments = (req.params.splat as unknown as string[]) ?? [];
    const relPath = segments.filter(Boolean).join("/");
    const absPath = path.resolve(DOCS_ROOT, relPath);

    if (!(absPath === DOCS_ROOT || absPath.startsWith(DOCS_ROOT + path.sep)) || !fs.existsSync(absPath)) {
      return next();
    }

    const breadcrumb = segments.filter(Boolean);
    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      const { folders, files } = listDocsDir(absPath, relPath);
      req.vm.req.title = breadcrumb[breadcrumb.length - 1] || "Documentation";
      req.vm.req.breadcrumb = breadcrumb;
      req.vm.req.folders = folders;
      req.vm.req.files = files;
      return renderView(req, res, "seu/docs/folder", req.vm);
    }

    if (!absPath.toLowerCase().endsWith(".md")) return next();

    const raw = fs.readFileSync(absPath, "utf-8");
    req.vm.req.title = path.basename(absPath, ".md");
    req.vm.req.breadcrumb = breadcrumb;
    req.vm.req.html = renderDocMarkdown(raw);
    return renderView(req, res, "seu/docs/view", req.vm);
  } catch (err) {
    logger.error("[web/seu/docs] GET /docs/*splat error", err as Error);
    next(err);
  }
});

export { router };
