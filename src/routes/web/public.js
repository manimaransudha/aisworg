
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { attachVM } from "../../middleware/attachVM.js";
import { requireRole } from "../../middleware/auth.js";
import { renderView } from "../../utils/viewModel.js";
import { getFlash } from "../../utils/flash.js";
// import { isConnectionError } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { appConfig } from "../../config/appconfig.js";
// import { redirects } from "../../middleware/redirects.js";
import { getArchitectureLayers, getDashboardCounts } from "../seu/core/dashboard.js";
import { getSeuQuickview } from "../seu/core/seus.js";

/** GET / — the SEU Commissioning Platform's home page: the architecture layers + live counts. */
router.get("/", requireRole('general'), attachVM("seu/dashboard"), async (req, res, next) => {
  try {
    const [layers, counts] = await Promise.all([getArchitectureLayers(), getDashboardCounts()]);
    req.vm.req.title = "SEU Platform";
    req.vm.req.layers = layers;
    req.vm.req.counts = counts;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/dashboard", req.vm);
  } catch (err) {
    logger.error("[Home] GET / error:", err);
    next(err);
  }
});

/** GET /settings — display app settings */
router.get("/settings", requireRole('super'), attachVM("settings/index"), async (req, res, next) => {
  try {
    const configData = await appConfig.getAll();

    // Group configs by category
    const grouped = {};
    for (const row of configData) {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push(row);
    }

    req.vm.req.title = "App Settings";
    req.vm.req.grouped = grouped;
    req.vm.opt.saved = req.session?.flash?.saved || null;
    req.vm.opt.error = req.session?.flash?.error || null;
    if (req.session?.flash) {
      delete req.session.flash;
    }

    return renderView(req, res, "settings/index", req.vm);
  } catch (err) {
    logger.error("[Settings] GET error:", err);
    next(err);
  }
});

/** POST /settings/:key — update a setting */
router.post("/settings/:key", requireRole('super'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      if (!req.session.flash) req.session.flash = {};
      req.session.flash.error = "Value is required.";
      return res.redirect("/aisworg/settings");
    }

    await appConfig.set(key, value);
    await appConfig.reload();

    if (!req.session.flash) req.session.flash = {};
    req.session.flash.saved = key;
    return res.redirect("/aisworg/settings");
  } catch (err) {
    logger.error(`[Settings] POST error for key=${req.params.key}:`, err);
    if (!req.session.flash) req.session.flash = {};
    req.session.flash.error = err.message;
    return res.redirect("/aisworg/settings");
  }
});

/** GET /quickview — post-login landing: progress on every commissioned SEU. */
router.get("/quickview", requireRole('general'), attachVM("quickview/index"), async (req, res, next) => {
  try {
    req.vm.req.title = "Commissioned SEUs";
    req.vm.req.seus = await getSeuQuickview();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "quickview/index", req.vm);
  } catch (err) {
    logger.error("[QuickView] GET error:", err);
    next(err);
  }
});

export { router };
