import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.post("/knowledge", notImplemented);
router.patch("/knowledge/:id/references", notImplemented);
router.post("/knowledge/:id/validation-notes", notImplemented);
router.get("/knowledge/:id/validation-notes", notImplemented);
router.get("/knowledge", notImplemented);
router.get("/knowledge/capital", notImplemented);
router.post("/knowledge/:id/promote-scope", notImplemented);

export { router };
