import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";

// The dashboard now lives at the app's home page (routes/web/public.js's
// GET /) since it replaced the old placeholder home page. This keeps
// /aisworg/seu working for anyone with the old link/bookmark instead of
// rendering the same page twice under two URLs.
router.get("/", (_req: Request, res: Response) => res.redirect("/aisworg"));

export { router };
