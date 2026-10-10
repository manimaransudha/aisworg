import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { commissionSeu } from "../core/commissioning.js";
import { getSeuStatus } from "../core/seus.js";
import { getSeuEvents } from "../core/events.js";
import { getEffectiveGovernanceModel } from "../core/governanceModel.js";

router.post("/commission", async (req: Request, res: Response) => {
  try {
    const { objectiveId, templateId, profileId, tenantId } = req.body ?? {};
    if (!objectiveId || !templateId || !profileId) {
      return res.status(400).json({ error: "objectiveId, templateId and profileId are all required" });
    }

    const actorRole = req.session?.user?.role ?? "general";

    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });
    const actorId = String(req.session.user.id);
    const result = await commissionSeu({ objectiveId, templateIds: [templateId], profileIds: [profileId], actorRole, actorId, requestedBy: actorId, tenantId: typeof tenantId === "string" ? tenantId : null });

    if (!result.ok) {
      return res.status(422).json({ stage: result.stage, reason: result.reason, seuId: result.seuId });
    }
    res.status(201).json({ seuId: result.seu.id, lifecycleState: result.seu.lifecycle_state, ebmId: result.seu.active_ebm_id });
  } catch (err) {
    logger.error("[api/seu/seus] POST /commission error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id", async (req: Request, res: Response) => {
  try {
    const status = await getSeuStatus(String(req.params.id));
    if (!status) return res.status(404).json({ error: "SEU not found" });
    res.status(200).json(status);
  } catch (err) {
    logger.error("[api/seu/seus] GET /:id error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id/events", async (req: Request, res: Response) => {
  try {
    const events = await getSeuEvents(String(req.params.id));
    res.status(200).json({ events });
  } catch (err) {
    logger.error("[api/seu/seus] GET /:id/events error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id/governance-model", async (req: Request, res: Response) => {
  try {
    const model = await getEffectiveGovernanceModel(String(req.params.id));
    if (!model) return res.status(404).json({ error: "SEU or its EBM not found" });
    res.status(200).json(model);
  } catch (err) {
    logger.error("[api/seu/seus] GET /:id/governance-model error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
