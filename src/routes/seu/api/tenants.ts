import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response } from "express";
import { logger } from "../../../utils/logger.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { tenantContractsDB } from "../../../dblayer/tenantContractsDB.js";

// Participant Integration — Plan step 6. Deployment-time contract config: a
// tenant, and its edge declarations (VCS binding #1, callback auth #3,
// attestation config #4). The per-Capability execution target (#2) and SLA (#5)
// have their own endpoints. Two tenants with entirely different providers,
// orchestrators, and auth run on the same core — only these declarations differ.

router.get("/tenants", async (_req: Request, res: Response) => {
  try {
    const { data } = await tenantsDB.findAll();
    res.status(200).json({ tenants: data ?? [] });
  } catch (err) {
    logger.error("[api/seu/tenants] GET /tenants error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/tenants", async (req: Request, res: Response) => {
  try {
    const { code, name } = req.body ?? {};
    if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "code is required" });
    const existing = await tenantsDB.findByCode(code);
    if (existing.data) return res.status(409).json({ error: `tenant code already exists: ${code}` });
    const { data, error } = await tenantsDB.create({ code, name: typeof name === "string" && name.trim() ? name : code });
    if (error || !data) throw error ?? new Error("failed to create tenant");
    res.status(201).json({ tenant: data });
  } catch (err) {
    logger.error("[api/seu/tenants] POST /tenants error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/tenants/:id/contract", async (req: Request, res: Response) => {
  try {
    const { data } = await tenantContractsDB.findByTenantId(String(req.params.id));
    res.status(200).json({ contract: data ?? null });
  } catch (err) {
    logger.error("[api/seu/tenants] GET /tenants/:id/contract error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/tenants/:id/contract", async (req: Request, res: Response) => {
  try {
    const tenantId = String(req.params.id);
    const { data: tenant } = await tenantsDB.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: "tenant not found" });
    const { vcsBinding, callbackAuth, attestationConfig } = req.body ?? {};
    const { data, error } = await tenantContractsDB.upsert({
      tenantId,
      vcsBinding: typeof vcsBinding === "object" && vcsBinding ? vcsBinding : {},
      callbackAuth: typeof callbackAuth === "object" && callbackAuth ? callbackAuth : {},
      attestationConfig: typeof attestationConfig === "object" && attestationConfig ? attestationConfig : {},
    });
    if (error || !data) throw error ?? new Error("failed to save tenant contract");
    res.status(200).json({ contract: data });
  } catch (err) {
    logger.error("[api/seu/tenants] POST /tenants/:id/contract error", err as Error);
    res.status(400).json({ error: (err as Error).message });
  }
});

export { router };
