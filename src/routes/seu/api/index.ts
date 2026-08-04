import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { router as objectivesRouter } from "./objectives.js";
import { router as templatesRouter } from "./templates.js";
import { router as profilesRouter } from "./profiles.js";
import { router as seusRouter } from "./seus.js";
import { router as deliverablesRouter } from "./deliverables.js";
import { router as servicesRouter } from "./services.js";
import { router as obligationsRouter } from "./obligations.js";
import { router as evidenceRouter } from "./evidence.js";
import { router as knowledgeRouter } from "./knowledge.js";
import { router as decisionsRouter } from "./decisions.js";
import { router as telemetryRouter } from "./telemetry.js";
import { router as attentionItemsRouter } from "./attentionItems.js";
import { router as externalInteractionsRouter } from "./externalInteractions.js";

router.use(objectivesRouter);
router.use(templatesRouter);
router.use(profilesRouter);
router.use(seusRouter);
router.use(deliverablesRouter);
router.use(servicesRouter);
router.use(obligationsRouter);
router.use(evidenceRouter);
router.use(knowledgeRouter);
router.use(decisionsRouter);
router.use(telemetryRouter);
router.use(attentionItemsRouter);
router.use(externalInteractionsRouter);

export { router };
