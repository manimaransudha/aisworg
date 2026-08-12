import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { complianceDB } from "../../../dblayer/complianceDB.js";
import { evaluateCompliance, grantWaiver, generateComplianceReport, complianceHistory } from "../core/compliance.js";

// Compliance Model — Plan (Phase 15, Ch.27 §18: Compliance APIs). Evaluation is
// read-only and derived from engineering state. The framework/requirement
// registration endpoints are the config surface; the faithful production path is
// Pack contribution (publishPack), which uses the same DB upserts.

/** POST /compliance/frameworks — register a Compliance Framework (config; Packs use the same upsert). */
router.post("/compliance/frameworks", async (req: Request, res: Response) => {
  try {
    const { code, name, description, originatingPackId } = req.body ?? {};
    if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "code and name are required" });
    const { data, error } = await complianceDB.upsertFramework({ code, name, description, originatingPackId: typeof originatingPackId === "string" ? originatingPackId : null });
    if (error || !data) throw error ?? new Error("failed to register framework");
    res.status(200).json({ framework: data });
  } catch (err) {
    logger.error("[api/seu/compliance] POST /compliance/frameworks error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /compliance/requirements — register a declarative Compliance Requirement. */
router.post("/compliance/requirements", async (req: Request, res: Response) => {
  try {
    const { code, frameworkCode, name, description, criteria, severity, conflictsWith, originatingPackId } = req.body ?? {};
    if (typeof code !== "string" || !code.trim() || typeof frameworkCode !== "string" || !frameworkCode.trim() || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "code, frameworkCode and name are required" });
    }
    if (typeof criteria !== "object" || !criteria) return res.status(400).json({ error: "criteria (declarative object) is required" });
    const { data, error } = await complianceDB.upsertRequirement({
      code, frameworkCode, name, description,
      criteria, severity: typeof severity === "string" ? severity : undefined,
      conflictsWith: Array.isArray(conflictsWith) ? conflictsWith : undefined,
      originatingPackId: typeof originatingPackId === "string" ? originatingPackId : null,
    });
    if (error || !data) throw error ?? new Error("failed to register requirement");
    res.status(200).json({ requirement: data });
  } catch (err) {
    logger.error("[api/seu/compliance] POST /compliance/requirements error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /seus/:id/compliance — evaluate the SEU's compliance now (records a snapshot). */
router.get("/seus/:id/compliance", async (req: Request, res: Response) => {
  try {
    res.status(200).json(await evaluateCompliance(String(req.params.id)));
  } catch (err) {
    logger.error("[api/seu/compliance] GET /seus/:id/compliance error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /seus/:id/compliance/report — the Ch.27 §12 report projection. */
router.get("/seus/:id/compliance/report", async (req: Request, res: Response) => {
  try {
    res.status(200).json(await generateComplianceReport(String(req.params.id)));
  } catch (err) {
    logger.error("[api/seu/compliance] GET report error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** GET /seus/:id/compliance/history — immutable evaluation snapshots (FR-27.6). */
router.get("/seus/:id/compliance/history", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ history: await complianceHistory(String(req.params.id)) });
  } catch (err) {
    logger.error("[api/seu/compliance] GET history error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /seus/:id/compliance/waivers — grant a waiver against a requirement. */
router.post("/seus/:id/compliance/waivers", async (req: Request, res: Response) => {
  try {
    const { requirementCode, rationale, expiresAt } = req.body ?? {};
    if (typeof requirementCode !== "string" || !requirementCode.trim() || typeof rationale !== "string" || !rationale.trim()) {
      return res.status(400).json({ error: "requirementCode and rationale are required" });
    }
    const waiver = await grantWaiver({ seuId: String(req.params.id), requirementCode, rationale, grantedBy: req.session?.user?.id ?? null, expiresAt: typeof expiresAt === "string" ? expiresAt : null });
    res.status(200).json({ waiver });
  } catch (err) {
    logger.error("[api/seu/compliance] POST waiver error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
