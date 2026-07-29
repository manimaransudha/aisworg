
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { attachVM } from "../../middleware/attachVM.js";
import { requireRole } from "../../middleware/auth.js";
import { renderView } from "../../utils/viewModel.js";
// import { getFlash } from "../../utils/flash.js";
// import { isConnectionError } from "../../utils/db.js";
import { logger } from "../../utils/logger.js";
import { appConfig } from "../../config/appconfig.js";
// import { redirects } from "../../middleware/redirects.js";

/** GET / - Public Landing Page */
router.get("/", attachVM("home"), async (req, res) => {

  return renderView(req, res, "home/index", {
    title: "Home"
  });
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

/** GET /quickview — display portfolio quickview */
router.get("/quickview", requireRole('general'), attachVM("quickview/index"), async (req, res, next) => {
  try {
    req.vm.req.title = "Portfolio QuickView";
    return renderView(req, res, "quickview/index", req.vm);
  } catch (err) {
    logger.error("[QuickView] GET error:", err);
    next(err);
  }
});

export { router };
