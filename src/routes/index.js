import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { attachVM } from "../middleware/attachVM.js";
import { requireRole } from "../middleware/auth.js";
import { renderView } from "../utils/viewModel.js";
import { getFlash } from "../utils/flash.js";
import { userStocksDB } from "../dblayer/userStocks.js";
import {LocalStockIngestor} from "../domain/ingestion/localStockIngestor.js";
import { PriceRefresher } from "../domain/processing/priceRefresher.js";
import { metricsCacheDB } from "../dblayer/metricsCache.js";
import { SignalEngine } from "../domain/analysis/signalEngine.js";
import {AnalyticalPillars} from "../domain/analysis/analyticalPillars.js";
import {sectorNames} from "../config/sector_fields.js";
import {isConnectionError} from "../utils/db.js";
import {logger} from "../utils/logger.js";

import {financialsDB} from "../dblayer/financials.js";
import {cacheValidator} from "../domain/analysis/cacheValidator.js";
import {getAggregatedStocks} from "../domain/analysis/dataAggregator.js";
import {userPreferencesDB} from "../dblayer/userPreferences.js";




/** GET / - Decision Storyboard (power and above) */
router.get("/", requireRole('power'), attachVM("dashboard"), async (req, res) => {
  const flash = getFlash(req);
  const query = (req.query.q || "").toLowerCase().trim();

  
    const vmStart = Date.now();
    const vm = {
      title: "Public Landing Page",
      flash,
      query,
      userStocks,
      alerts: [],
      marketOverview,
      sectorNames,
      activePage: 'Home'
    };

    return renderView(req, res, "dashboard", vm);
  
});

 

export { router };
