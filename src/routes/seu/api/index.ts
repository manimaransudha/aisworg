import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { router as objectivesRouter } from "./objectives.js";
import { router as templatesRouter } from "./templates.js";
import { router as profilesRouter } from "./profiles.js";
import { router as seusRouter } from "./seus.js";
import { router as deliverablesRouter } from "./deliverables.js";

router.use(objectivesRouter);
router.use(templatesRouter);
router.use(profilesRouter);
router.use(seusRouter);
router.use(deliverablesRouter);

export { router };
