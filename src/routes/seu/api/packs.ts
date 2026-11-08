import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/packs/:id/transition/validate", notImplemented);
router.post("/packs/:id/transition/publish", notImplemented);
router.post("/packs/:id/transition/reject", notImplemented);
router.post("/packs/:id/transition/activate", notImplemented);
router.post("/packs/:id/transition/retire", notImplemented);
router.post("/packs/:id/transition/archive", notImplemented);

export { router };
