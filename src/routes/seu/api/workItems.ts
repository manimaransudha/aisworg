import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/work-items/:id/result", notImplemented);
router.post("/work-items/sweep-stalled", notImplemented);
router.post("/capabilities/sweep-unavailable", notImplemented);

export { router };
