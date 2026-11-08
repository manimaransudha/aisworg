import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/seus/:id/deliverables", notImplemented);
router.post("/deliverables/:id/transition", notImplemented);
router.get("/deliverables/:id/traceability", notImplemented);

export { router };
