// Ontology Model (Ch.18) — Ontology Management admin surface. Owner,
// 2026-08-18: "Each of the concept_types should have a CRUD UI (similar to
// nouns and verbs). So any further additions will be data changes and we do
// not have to touch the code." Settled design (owner: "there will be no end
// to this"): no separate concept_types governance table — CRUD lands
// directly on ontology_concepts; concept_type itself is just whatever values
// already exist in the data, same way Schema Registry's kinds are a fixed
// list but a NEW concept_type here is simply typed into the add form.
//
// CR-022 — two changes from the original CR-020 build:
//   1. Tenant-scoped (owner: "Include tenant_id as part of Ontology. So
//      platform ones will be visible to all + their own vocabulary"):
//      Platform's concepts are canonical/shared; a tenant sees Platform's
//      plus their own. Root sees every tenant's.
//   2. Badge-gated, not root-only (owner: "we should be using the badge
//      grants feature to determine who has the access/authority to add") —
//      `ontology_define` (noun `Ontology`, verb `define`) replaces the
//      original root-only gate. Holding it lets an actor manage THEIR OWN
//      tenant's vocabulary; root still bypasses, and only root can write to
//      Platform's shared rows (core/ontology.ts enforces this, not this route).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { listConceptTypes, listConceptsForType, addConcept, retireConcept, type OntologyActor } from "../core/ontology.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";

const backTo = "/aisworg/seu/sdk/ontology";

// Same heldBadges/gate shape as sdkAuthoring.ts's own (not shared/exported
// from there — small, self-contained per-route-file checks are the existing
// convention, e.g. schemaRegistry.ts's own root-only gate).
async function heldBadges(req: Request): Promise<Set<string>> {
  const set = new Set<string>(req.session?.user?.platformBadges ?? []);
  const userId = req.session?.user?.id;
  if (userId != null) {
    const { data: grants } = await badgeGrantsDB.findActiveForHolder(String(userId));
    for (const g of grants ?? []) set.add(g.badge_type);
  }
  return set;
}

function actorFrom(req: Request, held: Set<string>): OntologyActor {
  return { isRoot: held.has("root"), tenantId: req.session?.user?.tenant_id ?? null };
}

async function requireOntologyAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const held = await heldBadges(req);
  if (held.has("root") || held.has("ontology_define")) return next();
  if (req.session) {
    (req.session as unknown as { flash?: { type: string; message: string } }).flash = {
      type: "error",
      message: `You don't have the required badge for that.`,
    };
  }
  res.redirect(req.headers.referer || "/aisworg");
}

/** GET /aisworg/seu/sdk/ontology — concept_types as tabs; ?type= selects which one's concepts are listed. */
router.get("/sdk/ontology", requireOntologyAdmin, attachVM("seu/sdk/ontology/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    const conceptTypes = await listConceptTypes(actor);
    const activeType = typeof req.query.type === "string" && conceptTypes.includes(req.query.type) ? req.query.type : (conceptTypes[0] ?? "");

    const concepts = activeType ? await listConceptsForType(activeType, actor) : [];
    const params = parseListParams(req.query, { sortable: ["code", "label", "active", "tenant"], defaultSort: "code", defaultDir: "asc" });
    // Owner-label per row so retiring an ambiguous shared code (Platform's
    // vs. this tenant's own, both legitimately named e.g. "saas-product")
    // targets the right one — the retire form submits the row's own tenantId.
    const rows = concepts.map((c) => ({
      code: c.code,
      label: c.default_label,
      description: c.description,
      isActive: c.is_active,
      tenantId: c.tenant_id,
      isPlatform: c.tenant_id === PLATFORM_TENANT_ID,
      contributedByPack: c.contributed_by_pack,
    }));

    req.vm.req.title = "Ontology Management";
    req.vm.req.conceptTypes = conceptTypes;
    req.vm.req.activeType = activeType;
    req.vm.req.listBasePath = activeType ? `${backTo}?type=${encodeURIComponent(activeType)}` : backTo;
    req.vm.req.list = paginateList(rows, params, {
      searchFields: [(r) => r.code, (r) => r.label],
      sortFields: { code: (r) => r.code, label: (r) => r.label, active: (r) => (r.isActive ? 1 : 0), tenant: (r) => (r.isPlatform ? 0 : 1) },
    });
    req.vm.opt.isRoot = actor.isRoot;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/ontology/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/ontology] GET /sdk/ontology error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/ontology/add — add (or re-add/reactivate) a concept; conceptType may be brand new. Non-root always adds to their OWN tenant. */
router.post("/sdk/ontology/add", requireOntologyAdmin, async (req: Request, res: Response) => {
  const { conceptType, code, defaultLabel, description } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    // Root's add form has no tenant selector yet — it always curates
    // Platform's shared vocabulary; targeting a SPECIFIC other tenant's
    // vocabulary as root is supported in core/ontology.ts (`targetTenantId`)
    // but not wired into this form (scope cut, CR-022).
    await addConcept({ conceptType: type, code: String(code ?? ""), defaultLabel: String(defaultLabel ?? ""), description: typeof description === "string" ? description : undefined }, actor);
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" added.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/ontology/retire — soft-retire (never delete): existing data keeps working. tenantId names which row (Platform's / this tenant's / — root only — another tenant's). */
router.post("/sdk/ontology/retire", requireOntologyAdmin, async (req: Request, res: Response) => {
  const { conceptType, code, tenantId } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await retireConcept(type, String(code ?? ""), String(tenantId ?? ""), actor);
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" retired.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

export { router };
