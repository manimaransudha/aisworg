import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import { notImplemented } from "./notImplemented.js";

// Unused, untested and so considered not implemented.
router.get("/ontology/concepts", notImplemented);
router.get("/tenants/:id/vocabulary", notImplemented);
router.get("/tenants/:id/aliases", notImplemented);
router.post("/tenants/:id/aliases", notImplemented);

export { router };
