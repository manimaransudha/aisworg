import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { NextFunction, Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createObjective, getObjectiveDetail, listObjectives, suggestCapabilityCodes, transitionObjective, updateObjective } from "../core/objectives.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import type { ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { requireTenant } from "../../../middleware/requireTenant.js";

router.param(
  "id",
  requireTenantScope.forParam("id", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, { mode: "api", notFoundMessage: "Objective not found" })
);

router.post(
  "/objectives",
  requireTenantScope.forField("body", "parentObjectiveId", objectivesDB.findById, (o) => o.sponsoring_authority?.tenant ?? null, { mode: "api", notFoundMessage: "Parent Objective not found" }),
  async (req: Request, res: Response) => {
  try {
    const { statement, requiredCapabilityCodes, tier, parentObjectiveId, status } = req.body ?? {};
    if (typeof statement !== "string" || !statement.trim() || !Array.isArray(requiredCapabilityCodes) || requiredCapabilityCodes.length === 0) {
      return res.status(400).json({ error: "statement (string) and a non-empty requiredCapabilityCodes (string[]) are required" });
    }
    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });

    const { objective, requiredCapabilities } = await createObjective({
      statement,
      requiredCapabilityCodes,
      tier: tier as ObjectiveTier | undefined,
      status: status as ObjectiveStatus | undefined,
      parentObjectiveId: parentObjectiveId ?? null,
      requestedBy: String(req.session.user.id),
    });

    res.status(201).json({
      id: objective.id,
      status: objective.status,
      tier: objective.tier,
      version: objective.version,
      requiredCapabilities: requiredCapabilities.map((c) => ({ code: c.code, name: c.name })),
    });
  } catch (err) {
    logger.error("[api/seu/objectives] POST error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/objectives", requireTenant(), async (req: Request, res: Response) => {
  try {
    const { isRoot, tenantId } = req.tenantScope!;
    res.status(200).json({ objectives: await listObjectives(isRoot ? undefined : tenantId) });
  } catch (err) {
    logger.error("[api/seu/objectives] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/objectives/suggest-capabilities", async (req: Request, res: Response) => {
  try {
    const statement = typeof req.query.statement === "string" ? req.query.statement : "";
    res.status(200).json({ capabilityCodes: await suggestCapabilityCodes(statement) });
  } catch (err) {
    logger.error("[api/seu/objectives] GET /suggest-capabilities error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

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

router.post("/objectives/:id/update", async (req: Request, res: Response) => {
  try {
    const { statement, requiredCapabilityCodes, bumpVersion } = req.body ?? {};
    if (req.session?.user?.id == null) return res.status(401).json({ error: "authentication required" });
    const updated = await updateObjective(String(req.params.id), {
      statement,
      requiredCapabilityCodes: Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : undefined,
      requestedBy: String(req.session.user.id),
      bumpVersion: typeof bumpVersion === "boolean" ? bumpVersion : undefined,
    });
    res.status(200).json({ objective: updated });
  } catch (err) {
    logger.error("[api/seu/objectives] POST /:id/update error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

function postTransition(targetState: ObjectiveStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { comment, supersedingObjectiveId } = req.body ?? {};
      const actorRole = req.session?.user?.role ?? "general";
      if (req.session?.user?.id == null) {
        res.status(401).json({ error: "authentication required" });
        return;
      }
      const actorId = String(req.session.user.id);
      const result = await transitionObjective({
        objectiveId: String(req.params.id),
        targetState,
        actorRole,
        actorId,
        comment: typeof comment === "string" ? comment : undefined,
        supersedingObjectiveId: typeof supersedingObjectiveId === "string" && supersedingObjectiveId ? supersedingObjectiveId : undefined,
      });

      if (!result.ok) {
        if (result.reason === "not_found") {
          res.status(404).json({ error: "Objective not found" });
          return;
        }
        res.status(409).json({ reason: result.reason, detail: result.detail });
        return;
      }
      res.status(200).json({ objective: result.objective, appliedTransition: result.appliedTransition });
    } catch (err) {
      logger.error(`[api/seu/objectives] POST /:id/transition/${targetState} error`, err as Error);
      res.status(400).json({ error: (err as Error).message });
    }
  };
}

router.post("/objectives/:id/transition/activate", postTransition("Active"));
router.post("/objectives/:id/transition/achieve", postTransition("Achieved"));
router.post("/objectives/:id/transition/supersede", postTransition("Superseded"));
router.post("/objectives/:id/transition/retire", postTransition("Retired"));
router.post("/objectives/:id/transition/archive", postTransition("Archived"));
router.post("/objectives/:id/transition/reject", postTransition("Reject"));

export { router };
