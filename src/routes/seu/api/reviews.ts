import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/reviews", notImplemented);
router.get("/reviews", notImplemented);
router.post("/reviews/:id/findings", notImplemented);
router.get("/reviews/:id/findings", notImplemented);
router.post("/findings/:id/convert-to-obligation", notImplemented);

export { router };
