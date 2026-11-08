import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/obligations", notImplemented);
router.get("/obligations", notImplemented);
router.patch("/obligations/:id", notImplemented);

export { router };
