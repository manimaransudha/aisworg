import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createObjective, getObjectiveDetail, listObjectives, suggestCapabilityCodes, transitionObjective, updateObjective } from "../core/objectives.js";
import type { ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";

/** POST /objectives — Ch.1: create an Objective, optionally tiered/decomposed under a parent. */
router.post("/objectives", async (req: Request, res: Response) => {
  try {
    const { statement, requiredCapabilityCodes, tier, parentObjectiveId, status } = req.body ?? {};
    if (typeof statement !== "string" || !statement.trim() || !Array.isArray(requiredCapabilityCodes) || requiredCapabilityCodes.length === 0) {
      return res.status(400).json({ error: "statement (string) and a non-empty requiredCapabilityCodes (string[]) are required" });
    }

    const { objective, requiredCapabilities } = await createObjective({
      statement,
      requiredCapabilityCodes,
      tier: tier as ObjectiveTier | undefined,
      status: status as ObjectiveStatus | undefined,
      parentObjectiveId: parentObjectiveId ?? null,
      requestedBy: req.session?.user?.id ?? null,
    });

    res.status(201).json({
      id: objective.id,
      status: objective.status,
      tier: objective.tier,
      version: objective.version,
      requiredCapabilities: requiredCapabilities.map((c) => ({ id: c.id, code: c.code, name: c.name })),
    });
  } catch (err) {
    logger.error("[api/seu/objectives] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /objectives — every Objective, any status/tier. */
router.get("/objectives", async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ objectives: await listObjectives() });
  } catch (err) {
    logger.error("[api/seu/objectives] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /objectives/suggest-capabilities?statement=... — word-overlap suggestion, not a sole mechanism. */
router.get("/objectives/suggest-capabilities", async (req: Request, res: Response) => {
  try {
    const statement = typeof req.query.statement === "string" ? req.query.statement : "";
    res.status(200).json({ capabilityCodes: await suggestCapabilityCodes(statement) });
  } catch (err) {
    logger.error("[api/seu/objectives] GET /suggest-capabilities error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /objectives/:id — Objective + decomposition (parent/children) + required Capabilities + valid next lifecycle states. */
router.get("/objectives/:id", async (req: Request, res: Response) => {
  try {
    const detail = await getObjectiveDetail(String(req.params.id));
    if (!detail) return res.status(404).json({ error: "Objective not found" });
    res.status(200).json(detail);
  } catch (err) {
    logger.error("[api/seu/objectives] GET /:id error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /objectives/:id/update — edits statement/tier; increments version. */
router.post("/objectives/:id/update", async (req: Request, res: Response) => {
  try {
    const { statement, tier } = req.body ?? {};
    const updated = await updateObjective(String(req.params.id), { statement, tier: tier as ObjectiveTier | undefined });
    res.status(200).json({ objective: updated });
  } catch (err) {
    logger.error("[api/seu/objectives] POST /:id/update error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /objectives/:id/transition — Ch.1 lifecycle: Proposed -> Active -> Achieved/Superseded/Retired -> Archived. */
router.post("/objectives/:id/transition", async (req: Request, res: Response) => {
  try {
    const { targetState } = req.body ?? {};
    if (typeof targetState !== "string" || !targetState.trim()) {
      return res.status(400).json({ error: "targetState is required" });
    }
    const actorRole = req.session?.user?.role ?? "general";
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const result = await transitionObjective({ objectiveId: String(req.params.id), targetState: targetState as ObjectiveStatus, actorRole, actorId });

    if (!result.ok) {
      if (result.reason === "not_found") return res.status(404).json({ error: "Objective not found" });
      return res.status(409).json({ reason: result.reason, detail: result.detail });
    }
    res.status(200).json({ objective: result.objective, appliedTransition: result.appliedTransition });
  } catch (err) {
    logger.error("[api/seu/objectives] POST /:id/transition error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
