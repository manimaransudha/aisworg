import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { router as dashboardRouter } from "./dashboard.js";
import { router as seusRouter } from "./seus.js";
import { router as packsRouter } from "./packs.js";

router.use(dashboardRouter);
router.use(seusRouter);
router.use(packsRouter);

export { router };
