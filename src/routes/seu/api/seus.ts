import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/commission", notImplemented);
router.get("/seus/:id", notImplemented);
router.get("/seus/:id/events", notImplemented);
router.get("/seus/:id/governance-model", notImplemented);

export { router };
