import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/compliance/frameworks", notImplemented);
router.post("/compliance/requirements", notImplemented);
router.get("/seus/:id/compliance", notImplemented);
router.get("/seus/:id/compliance/report", notImplemented);
router.get("/seus/:id/compliance/history", notImplemented);
router.post("/seus/:id/compliance/waivers", notImplemented);

export { router };
