import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.get("/tenants", notImplemented);
router.post("/tenants", notImplemented);
router.get("/tenants/:id/contract", notImplemented);
router.post("/tenants/:id/contract", notImplemented);

export { router };
