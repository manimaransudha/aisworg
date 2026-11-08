import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/objectives", notImplemented);
router.get("/objectives/suggest-capabilities", notImplemented);
router.get("/objectives/:id", notImplemented);
router.post("/objectives/:id/update", notImplemented);
router.post("/objectives/:id/transition/activate", notImplemented);
router.post("/objectives/:id/transition/achieve", notImplemented);
router.post("/objectives/:id/transition/supersede", notImplemented);
router.post("/objectives/:id/transition/retire", notImplemented);
router.post("/objectives/:id/transition/archive", notImplemented);
router.post("/objectives/:id/transition/reject", notImplemented);

export { router };
