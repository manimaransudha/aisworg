import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { complianceDB } from "../../../dblayer/complianceDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { resolveHeldBadges } from "../../../domain/identity/heldBadges.js";
import { evaluateCompliance, grantWaiver, generateComplianceReport, complianceHistory } from "../core/compliance.js";

async function resolveConfigAuthor(req: Request): Promise<{ authorId: string; authorBadge: string } | { error: string }> {
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : null;
  if (!actorId) return { error: `No actor.` };
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) return { error: `No superuser provisioned.` };
  const held = await resolveHeldBadges(req);
  const authorBadge = held.isRoot ? "root" : [...held.badgeTypes][0] ?? "general";
  return { authorId: master.id, authorBadge };
}

router.post("/compliance/frameworks", async (req: Request, res: Response) => {
  try {
    const { code, name, description, originatingPackId } = req.body ?? {};
    if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "code and name are required" });
    const author = await resolveConfigAuthor(req);
    if ("error" in author) return res.status(401).json({ error: author.error });
    const { data, error } = await complianceDB.upsertFramework({ code, name, description, originatingPackId: typeof originatingPackId === "string" ? originatingPackId : null, ...author });
    if (error || !data) throw error ?? new Error("failed to register framework");
    res.status(200).json({ framework: data });
  } catch (err) {
    logger.error("[api/seu/compliance] POST /compliance/frameworks error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/compliance/requirements", async (req: Request, res: Response) => {
  try {
    const { code, frameworkCode, name, description, criteria, severity, conflictsWith, originatingPackId } = req.body ?? {};
    if (typeof code !== "string" || !code.trim() || typeof frameworkCode !== "string" || !frameworkCode.trim() || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "code, frameworkCode and name are required" });
    }
    if (typeof criteria !== "object" || !criteria) return res.status(400).json({ error: "criteria (declarative object) is required" });
    const author = await resolveConfigAuthor(req);
    if ("error" in author) return res.status(401).json({ error: author.error });
    const { data, error } = await complianceDB.upsertRequirement({
      code, frameworkCode, name, description,
      criteria, severity: typeof severity === "string" ? severity : undefined,
      conflictsWith: Array.isArray(conflictsWith) ? conflictsWith : undefined,
      originatingPackId: typeof originatingPackId === "string" ? originatingPackId : null,
      ...author,
    });
    if (error || !data) throw error ?? new Error("failed to register requirement");
    res.status(200).json({ requirement: data });
  } catch (err) {
    logger.error("[api/seu/compliance] POST /compliance/requirements error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id/compliance", async (req: Request, res: Response) => {
  try {
    res.status(200).json(await evaluateCompliance(String(req.params.id)));
  } catch (err) {
    logger.error("[api/seu/compliance] GET /seus/:id/compliance error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id/compliance/report", async (req: Request, res: Response) => {
  try {
    res.status(200).json(await generateComplianceReport(String(req.params.id)));
  } catch (err) {
    logger.error("[api/seu/compliance] GET report error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/seus/:id/compliance/history", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ history: await complianceHistory(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/compliance] GET history error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/seus/:id/compliance/waivers", async (req: Request, res: Response) => {
  try {
    const { requirementCode, rationale, expiresAt } = req.body ?? {};
    if (typeof requirementCode !== "string" || !requirementCode.trim() || typeof rationale !== "string" || !rationale.trim()) {
      return res.status(400).json({ error: "requirementCode and rationale are required" });
    }
    const author = await resolveConfigAuthor(req);
    if ("error" in author) return res.status(401).json({ error: author.error });
    const waiver = await grantWaiver({ seuId: String(req.params.id), requirementCode, rationale, grantedBy: author.authorId, authorBadge: author.authorBadge, expiresAt: typeof expiresAt === "string" ? expiresAt : null });
    res.status(200).json({ waiver });
  } catch (err) {
    logger.error("[api/seu/compliance] POST waiver error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
