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
import { router as attentionRouter } from "./attention.js";
import { router as identityRouter } from "./identity.js";
import { router as sdkAuthoringRouter } from "./sdkAuthoring.js";
import { router as schemaRegistryRouter } from "./schemaRegistry.js";
import { router as workQueueRouter } from "./workQueue.js";

router.use(dashboardRouter);
router.use(objectivesRouter);
router.use(seusRouter);
router.use(packsRouter);
router.use(servicesRouter);
router.use(knowledgeRouter);
router.use(telemetryRouter);
router.use(attentionRouter);
router.use(identityRouter);
router.use(schemaRegistryRouter);
router.use(sdkAuthoringRouter);
router.use(workQueueRouter);

export { router };
