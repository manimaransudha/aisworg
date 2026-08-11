import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { commissionSeu } from "../core/commissioning.js";
import { getSeuStatus } from "../core/seus.js";
import { fulfilCapability } from "../core/capabilities.js";
import { getSeuEvents } from "../core/events.js";

/** POST /commission — Ch.8 full pipeline; this endpoint's response is the acceptance test's core assertion. */
router.post("/commission", async (req: Request, res: Response) => {
  try {
    const { objectiveId, templateId, profileId, tenantId } = req.body ?? {};
    if (!objectiveId || !templateId || !profileId) {
      return res.status(400).json({ error: "objectiveId, templateId and profileId are all required" });
    }

    const actorRole = req.session?.user?.role ?? "general";
    const result = await commissionSeu({ objectiveId, templateId, profileId, actorRole, requestedBy: req.session?.user?.id ?? null, tenantId: typeof tenantId === "string" ? tenantId : null });

    if (!result.ok) {
      return res.status(422).json({ stage: result.stage, reason: result.reason, seuId: result.seuId });
    }
    res.status(201).json({ seuId: result.seu.id, lifecycleState: result.seu.lifecycle_state, ebmId: result.seu.active_ebm_id, commissioningReport: result.report });
  } catch (err) {
    logger.error("[api/seu/seus] POST /commission error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /seus/:id — Ch.2 status view: SEU + required Capabilities + Deliverables. */
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

/** POST /seus/:id/capabilities/:capabilityId/fulfil — Ch.12: direct assignment, no Dispatch Engine. */
router.post("/seus/:id/capabilities/:capabilityId/fulfil", async (req: Request, res: Response) => {
  try {
    const { participant } = req.body ?? {};
    if (!participant?.type || !participant?.displayName) {
      return res.status(400).json({ error: "participant.type and participant.displayName are required" });
    }
    const result = await fulfilCapability({
      seuId: String(req.params.id),
      capabilityId: String(req.params.capabilityId),
      participantType: participant.type,
      displayName: participant.displayName,
    });
    res.status(200).json({
      capabilityFulfilment: result.fulfilment,
      participant: result.participant,
      seuCapability: { id: result.seuCapabilityId, capabilityCode: result.capabilityCode, status: "Fulfilled" },
    });
  } catch (err) {
    logger.error("[api/seu/seus] POST /:id/capabilities/:capabilityId/fulfil error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /seus/:id/events — Ch.30: the event log produced by the commissioning + execution flow. */
router.get("/seus/:id/events", async (req: Request, res: Response) => {
  try {
    const events = await getSeuEvents(String(req.params.id));
    res.status(200).json({ events });
  } catch (err) {
    logger.error("[api/seu/seus] GET /:id/events error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
