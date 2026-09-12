// Participant Registry (CR-098, Ch.13 §8) — the tenant-scoped, cross-SEU
// resource registry: every participants_master row (a reusable identity —
// human, AI agent configuration, Automated integration, External authority),
// not the per-SEU lifecycle `participants` engagements (those stay visible
// on each SEU's own detail page, same as today).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import type { ParticipantMasterRow } from "../../../dblayer/seuTypes.js";

const PARTICIPANT_TYPES = ["AI", "Human", "Automated", "External"];

/** GET /aisworg/seu/participants — every participants_master resource. */
router.get("/participants", attachVM("seu/participants/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Participants";
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;

    const { data: rows } = isRoot || !viewerTenantId
      ? await participantsMasterDB.findAll()
      : await participantsMasterDB.findByTenantId(viewerTenantId);
    const { data: tenants } = await tenantsDB.findAll();
    const tenantNameById = new Map((tenants ?? []).map((t) => [t.id, t.name]));

    const activeType = typeof req.query.status === "string" && PARTICIPANT_TYPES.includes(req.query.status) ? req.query.status : "";
    const scoped = activeType ? (rows ?? []).filter((r) => r.type === activeType) : rows ?? [];

    const params = parseListParams(req.query, { sortable: ["name", "type", "tenant"], defaultSort: "name", defaultDir: "asc" });
    const list = paginateList(scoped, params, {
      searchFields: [(r: ParticipantMasterRow) => r.display_name, (r: ParticipantMasterRow) => r.type],
      sortFields: {
        name: (r: ParticipantMasterRow) => r.display_name,
        type: (r: ParticipantMasterRow) => r.type,
        tenant: (r: ParticipantMasterRow) => tenantNameById.get(r.tenant_id) ?? "",
      },
    });
    list.status = activeType || undefined;

    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/participants";
    req.vm.opt.participantTypes = PARTICIPANT_TYPES;
    req.vm.opt.activeType = activeType;
    req.vm.opt.tenantNameById = Object.fromEntries(tenantNameById);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/participants/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/participantRegistry] GET /participants error", err as Error);
    next(err);
  }
});

export { router };
