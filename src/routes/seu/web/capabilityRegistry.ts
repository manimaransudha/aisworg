// Capability Registry (owner: "In registry, add Capability registry. This
// has the capability-name details" / "capability registry is the ontology
// concept type capability-name") — a read-only catalog of the canonical
// capability-name Ontology vocabulary (CR-086), same source Objective/Pack/
// Profile/Service Definition all validate their own Capability codes
// against. Distinct from the Pack-instance-scoped `capabilities` table
// (capabilitiesDB) — that's a per-Pack materialization, this is the single
// canonical vocabulary it's drawn from.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { requireRole } from "../../../middleware/requireRole.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { ontologyDB, type OntologyViewer } from "../../../dblayer/ontologyDB.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";

/** GET /aisworg/seu/capabilities — every canonical capability-name Ontology concept. */
router.get("/capabilities", requireRole(["participant"], { redirectTo: "/aisworg" }), attachVM("seu/capabilities/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.vm.req.title = "Capabilities";
    const isRoot = (req.session?.user?.platformBadges ?? []).includes("root");
    const viewerTenantId = req.session?.user?.tenant_id ?? null;
    const viewer: OntologyViewer = { isRoot, tenantId: viewerTenantId };
    const { data: concepts } = await ontologyDB.findConceptsByType("capability-name", viewer);

    const params = parseListParams(req.query, { sortable: ["code", "label"], defaultSort: "code", defaultDir: "asc" });
    const list = paginateList(concepts ?? [], params, {
      searchFields: [(c) => c.code, (c) => c.default_label, (c) => c.description],
      sortFields: { code: (c) => c.code, label: (c) => c.default_label },
    });

    req.vm.req.list = list;
    req.vm.opt.listBasePath = "/aisworg/seu/capabilities";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/capabilities/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/capabilityRegistry] GET /capabilities error", err as Error);
    next(err);
  }
});

export { router };
