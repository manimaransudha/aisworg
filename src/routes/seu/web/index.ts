import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { router as dashboardRouter } from "./dashboard.js";
import { router as seusRouter } from "./seus.js";
import { router as packsRouter } from "./packs.js";
import { router as objectivesRouter } from "./objectives.js";
import { router as servicesRouter } from "./services.js";
import { router as knowledgeRouter } from "./knowledge.js";
import { router as telemetryRouter } from "./telemetry.js";

router.use(dashboardRouter);
router.use(objectivesRouter);
router.use(seusRouter);
router.use(packsRouter);
router.use(servicesRouter);
router.use(knowledgeRouter);
router.use(telemetryRouter);

export { router };
