import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { NextFunction, Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { createObjective, getObjectiveDetail, listObjectives, suggestCapabilityCodes, transitionObjective, updateObjective } from "../core/objectives.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import type { ObjectiveStatus, ObjectiveTier } from "../../../dblayer/seuTypes.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { requireTenant } from "../../../middleware/requireTenant.js";

// CR-076 — every route on this router now carries an explicit requireBadge
// declaration, mode: "api" throughout (always JSON, never a redirect — this
// is a JSON API router, no page exists to send a browser back to, not even
// for its own GETs). Tenant reach gate — same check and same reasoning as
// web/objectives.ts's own router.param("id", ...), now the same shared
// requireTenantScope.forParam primitive: a direct request naming an id is
// otherwise ungated, so this covers every /objectives/:id* route on this
// router (get, update, transition). A non-root, cross-tenant request gets
// the same 404 "Objective not found" a genuinely missing id gets — never a
// 403, so it never confirms another tenant's Objective exists. Fails closed
// on a legacy row with no sponsoring_authority yet (predates CR-071), same
// as objectivesDB.findAll/findRootsPage's own "NULL never matches" rule.
router.param(
  "id",
  requireTenantScope.forParam("id", objectivesDB.findById, { mode: "api", notFoundMessage: "Objective not found" })
);

/** POST /objectives — Ch.1: create an Objective, optionally tiered/decomposed under a parent. */
router.post(
  "/objectives",
  requireBadge(["objective_propose"], { mode: "api" }),
  requireTenantScope.forField("body", "parentObjectiveId", objectivesDB.findById, { mode: "api", notFoundMessage: "Parent Objective not found" }),
  async (req: Request, res: Response) => {
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

// CR-076 (owner: "GET /objectives should have a requireTenant and include
// tenant filtering") — closes the gap CR-071 flagged and deferred: this used
// to return every Objective, unfiltered, root or not. requireTenant resolves
// and attaches this request's own scope; root omits the filter entirely
// (undefined), same "sees every tenant" convention web/objectives.ts's own
// list route already uses.
/** GET /objectives — every Objective in the caller's own tenant (every tenant for root), any status/tier. */
router.get("/objectives", requireBadge(["None"], { mode: "api" }), requireTenant(), async (req: Request, res: Response) => {
  try {
    const { isRoot, tenantId } = req.tenantScope!;
    res.status(200).json({ objectives: await listObjectives(isRoot ? undefined : tenantId) });
  } catch (err) {
    logger.error("[api/seu/objectives] GET error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /objectives/suggest-capabilities?statement=... — word-overlap suggestion, not a sole mechanism. */
router.get("/objectives/suggest-capabilities", requireBadge(["None"], { mode: "api" }), async (req: Request, res: Response) => {
  try {
    const statement = typeof req.query.statement === "string" ? req.query.statement : "";
    res.status(200).json({ capabilityCodes: await suggestCapabilityCodes(statement) });
  } catch (err) {
    logger.error("[api/seu/objectives] GET /suggest-capabilities error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /objectives/:id — Objective + decomposition (parent/children) + required Capabilities + valid next lifecycle states. */
router.get("/objectives/:id", requireBadge(["None"], { mode: "api" }), async (req: Request, res: Response) => {
  try {
    const detail = await getObjectiveDetail(String(req.params.id));
    if (!detail) return res.status(404).json({ error: "Objective not found" });
    res.status(200).json(detail);
  } catch (err) {
    logger.error("[api/seu/objectives] GET /:id error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// CR-076 — same gap closed here as web/objectives.ts's own POST /update: no
// server-side badge check existed at all before this.
/** POST /objectives/:id/update — edits statement/required Capabilities; tier is not editable. */
router.post("/objectives/:id/update", requireBadge(["objective_propose"], { mode: "api" }), async (req: Request, res: Response) => {
  try {
    const { statement, requiredCapabilityCodes, bumpVersion } = req.body ?? {};
    const updated = await updateObjective(String(req.params.id), {
      statement,
      requiredCapabilityCodes: Array.isArray(requiredCapabilityCodes) ? requiredCapabilityCodes : undefined,
      bumpVersion: typeof bumpVersion === "boolean" ? bumpVersion : undefined,
    });
    res.status(200).json({ objective: updated });
  } catch (err) {
    logger.error("[api/seu/objectives] POST /:id/update error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

// CR-076 (owner: "One function cannot do multiple things requiring different
// badges. They have to be split") — this used to be one route dispatching on
// a body-supplied targetState across every objective_<verb> badge. Now one
// route per target, each with its own single requireBadge; postTransition is
// just the shared mechanics, not an authorization decision (each route's own
// middleware already made that call before this ever runs). Six targets, not
// web/objectives.ts's five: this API layer has no /submit endpoint and
// doesn't filter by trigger the way the web UI's dropdown does (a
// pre-existing, separate gap — trigger='governed' is never enforced inside
// transitionEngine.evaluate itself, only filtered out of the web dropdown —
// left as-is here, not silently narrowed by this conversion).
function postTransition(targetState: ObjectiveStatus) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { comment } = req.body ?? {};
      const actorRole = req.session?.user?.role ?? "general";
      const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
      const result = await transitionObjective({
        objectiveId: String(req.params.id),
        targetState,
        actorRole,
        actorId,
        comment: typeof comment === "string" ? comment : undefined,
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

router.post("/objectives/:id/transition/activate", requireBadge(["objective_activate"], { mode: "api" }), postTransition("Active"));
router.post("/objectives/:id/transition/achieve", requireBadge(["objective_achieve"], { mode: "api" }), postTransition("Achieved"));
router.post("/objectives/:id/transition/supersede", requireBadge(["objective_supersede"], { mode: "api" }), postTransition("Superseded"));
router.post("/objectives/:id/transition/retire", requireBadge(["objective_retire"], { mode: "api" }), postTransition("Retired"));
router.post("/objectives/:id/transition/archive", requireBadge(["objective_archive"], { mode: "api" }), postTransition("Archived"));
router.post("/objectives/:id/transition/reject", requireBadge(["objective_reject"], { mode: "api" }), postTransition("Reject"));

export { router };
