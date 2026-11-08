import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/external-interactions", notImplemented);
router.get("/external-interactions", notImplemented);
router.post("/external-interactions/:id/transition", notImplemented);

export { router };
