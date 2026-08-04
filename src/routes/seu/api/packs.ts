import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { listPacksWithNextStates, transitionPack } from "../core/packs.js";

/**
 * GET /packs — Ch.38 §10 Pack Registry: every published Version of every
 * Pack, newest first within each code. No POST create endpoint — SDK-001
 * ("Every production Pack shall be created using the SDK") means Packs are
 * created via `pnpm pack:publish`, not a web/API form.
 */
router.get("/packs", async (_req: Request, res: Response) => {
  try {
    const packs = await listPacksWithNextStates();
    res.status(200).json({ packs });
  } catch (err) {
    logger.error("[api/seu/packs] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /packs/:id/transition — Ch.5 §11 / Ch.38 §9 lifecycle: Draft -> ... -> Archived. */
router.post("/packs/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const result = await transitionPack({ packId: String(req.params.id), targetState, actorRole });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Pack not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ pack: result.pack, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/packs] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
