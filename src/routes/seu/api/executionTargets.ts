import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { executionTargetsDB } from "../../../dblayer/executionTargetsDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import type { ExecutionMode } from "../../../dblayer/seuTypes.js";

// Participant Integration — Plan step 6 (Contract declaration #2, tenant-scoped).
// Register how a tenant's Participant for a Capability is reached: human-on-UI
// (the labelled UI stub) or external-orchestrator (deliver the assignment to an
// endpoint). Omitting tenantId targets the default tenant.
const VALID_MODES: ExecutionMode[] = ["human-on-ui", "external-orchestrator"];

async function resolveTenantId(body: Record<string, unknown>): Promise<string | null> {
  if (typeof body.tenantId === "string" && body.tenantId.trim() !== "") return body.tenantId;
  const { data: def } = await tenantsDB.findDefault();
  return def?.id ?? null;
}

router.post("/execution-targets", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const { capabilityId, mode, adapterEndpoint, adapterAuthRef } = body;
    if (typeof capabilityId !== "string" || !capabilityId.trim()) return res.status(400).json({ error: "capabilityId is required" });
    if (typeof mode !== "string" || !VALID_MODES.includes(mode as ExecutionMode)) return res.status(400).json({ error: `mode must be one of ${VALID_MODES.join(", ")}` });
    if (mode === "external-orchestrator" && (typeof adapterEndpoint !== "string" || !adapterEndpoint.trim())) {
      return res.status(400).json({ error: "adapterEndpoint is required for external-orchestrator mode" });
    }
    const tenantId = await resolveTenantId(body);
    if (!tenantId) return res.status(400).json({ error: "no tenant resolved (and no default tenant seeded)" });

    const { data, error } = await executionTargetsDB.upsert({
      tenantId,
      capabilityId,
      mode: mode as ExecutionMode,
      adapterEndpoint: typeof adapterEndpoint === "string" ? adapterEndpoint : null,
      adapterAuthRef: typeof adapterAuthRef === "string" ? adapterAuthRef : null,
    });
    if (error || !data) throw error ?? new Error("failed to register execution target");
    res.status(200).json({ executionTarget: data });
  } catch (err) {
    logger.error("[api/seu/executionTargets] POST /execution-targets error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/execution-targets/:capabilityId", async (req: Request, res: Response) => {
  try {
    const tenantId = typeof req.query.tenantId === "string" && req.query.tenantId.trim() !== ""
      ? req.query.tenantId
      : (await tenantsDB.findDefault()).data?.id ?? null;
    if (!tenantId) return res.status(200).json({ executionTarget: null, effectiveMode: "human-on-ui" });
    const { data } = await executionTargetsDB.findByTenantAndCapability(tenantId, String(req.params.capabilityId));
    if (!data) return res.status(200).json({ executionTarget: null, effectiveMode: "human-on-ui" });
    res.status(200).json({ executionTarget: data, effectiveMode: data.mode });
  } catch (err) {
    logger.error("[api/seu/executionTargets] GET /execution-targets/:capabilityId error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
