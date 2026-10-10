import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";

router.get("/", (_req: Request, res: Response) => res.redirect("/aisworg"));

export { router };
