import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/evidence", notImplemented);
router.post("/evidence/:id/validate", notImplemented);
router.get("/evidence", notImplemented);
router.post("/evidence/:id/link", notImplemented);

export { router };
