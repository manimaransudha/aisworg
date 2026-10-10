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
import { listConceptTypes, listConceptsForType, addConcept, deprecateConcept, retireConcept, archiveConcept, composeConcept, updateConceptMeta, quickRetireConcept, listAllConceptsForPicker, listDistinctUiGroupings, getConceptTypeNav, tabsForActiveType, approveConcept, rejectConcept, listDraftConceptsForApproval, type OntologyActor } from "../core/ontology.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import { getPlatformTenantId  } from "../../../dblayer/constants.js";
 
const backTo = "/aisworg/seu/sdk/ontology";

async function heldBadges(req: Request): Promise<Set<string>> {
  const set = new Set<string>(req.session?.user?.platformBadges ?? []);
  const userId = req.session?.user?.id;
  if (userId != null) {
    const { badgeTypes } = await badgeAuthorityEngine.getHeldBadges(String(userId));
    for (const b of badgeTypes) set.add(b);
  }
  return set;
}

function actorFrom(req: Request, held: Set<string>): OntologyActor {
  const userId = req.session?.user?.id;
  if (userId == null) throw new Error("no acting user to record as this concept's author — log in first.");
  return {
    isRoot: held.has("root"),
    tenantId: req.session?.user?.tenant_id ?? null,
    actorId: String(userId),
    actorBadge: held.has("root") ? "root" : "ontology_define",
  };
}

router.get("/sdk/ontology", attachVM("seu/sdk/ontology/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    const conceptTypes = await listConceptTypes(actor);
    const nav = await getConceptTypeNav(actor, conceptTypes);
    const topLevelTypes = nav.topLevel.map((t) => t.type);
    const activeType = typeof req.query.type === "string" && conceptTypes.includes(req.query.type) ? req.query.type : (topLevelTypes[0] ?? conceptTypes[0] ?? "");
    const tabTypes = activeType ? tabsForActiveType(nav, activeType) : [];

    const concepts = activeType ? await listConceptsForType(activeType, actor) : [];
    const params = parseListParams(req.query, { sortable: ["code", "label", "status", "tenant"], defaultSort: "code", defaultDir: "asc" });
    const NEXT_STATE: Record<string, { toState: string; verb: string } | undefined> = {
      Active: { toState: "Deprecated", verb: "deprecate" },
      Deprecated: { toState: "Retired", verb: "retire" },
      Retired: { toState: "Archived", verb: "archive" },
    };
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    const rows = concepts.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.default_label,
      description: c.description,
      textType: c.text_type,
      uiGrouping: c.ui_grouping,
      version: c.version,
      status: c.status,
      nextState: NEXT_STATE[c.status] ?? null,
      tenantId: c.tenant_id,
      isPlatform: c.tenant_id === PLATFORM_TENANT_ID,
      contributedByPack: c.contributed_by_pack,
      compositionStrategy: c.composition_strategy,
      compositionSources: c.composition_sources,
    }));

    const compositionSources = rows.filter((r) => r.status === "Active").map((r) => ({ id: r.id, code: r.code, label: r.label, isPlatform: r.isPlatform }));

    req.vm.req.title = "Ontology Management";
    req.vm.req.conceptTypes = tabTypes;
    req.vm.req.activeType = activeType;
    req.vm.req.listBasePath = activeType ? `${backTo}?type=${encodeURIComponent(activeType)}` : backTo;
    req.vm.req.list = paginateList(rows, params, {
      searchFields: [(r) => r.code, (r) => r.label],
      sortFields: { code: (r) => r.code, label: (r) => r.label, status: (r) => r.status, tenant: (r) => (r.isPlatform ? 0 : 1) },
    });
    req.vm.opt.isRoot = actor.isRoot;
    req.vm.opt.flash = getFlash(req);
    req.vm.opt.renderMarkdown = renderMarkdown;
    req.vm.opt.compositionSources = compositionSources;
    req.vm.opt.existingGroupLabels = await listDistinctUiGroupings(actor);
    res.locals.currentQuery = { ...(res.locals.currentQuery ?? {}), type: activeType };
    return renderView(req, res, "seu/sdk/ontology/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/ontology] GET /sdk/ontology error", err as Error);
    next(err);
  }
});

router.get("/sdk/ontology/metadata", attachVM("seu/sdk/ontology/metadata"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    const allConcepts = await listAllConceptsForPicker(actor);

    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    const listRows = allConcepts.map((c) => ({
      conceptType: c.concept_type,
      code: c.code,
      label: c.default_label,
      groupLabel: c.ui_grouping,
      textType: c.text_type,
      tenantId: c.tenant_id,
      isPlatform: c.tenant_id === PLATFORM_TENANT_ID,
    }));
    const params = parseListParams(req.query, { sortable: ["conceptType", "code", "label", "group", "textType", "tenant"], defaultSort: "conceptType", defaultDir: "asc" });
    const list = paginateList(listRows, params, {
      searchFields: [(r) => r.conceptType, (r) => r.code, (r) => r.label, (r) => r.groupLabel ?? ""],
      sortFields: {
        conceptType: (r) => r.conceptType, code: (r) => r.code, label: (r) => r.label,
        group: (r) => r.groupLabel ?? "", textType: (r) => r.textType, tenant: (r) => (r.isPlatform ? 0 : 1),
      },
    });

    const conceptsByType: Record<string, Array<{ code: string; label: string }>> = {};
    for (const c of allConcepts) {
      (conceptsByType[c.concept_type] ??= []).push({ code: c.code, label: c.default_label });
    }

    const existingGroupLabels = await listDistinctUiGroupings(actor);

    req.vm.req.title = "Ontology Metadata";
    req.vm.req.list = list;
    req.vm.req.listBasePath = "/aisworg/seu/sdk/ontology/metadata";
    req.vm.req.conceptTypes = Object.keys(conceptsByType).sort();
    req.vm.opt.conceptsByType = conceptsByType;
    req.vm.opt.existingGroupLabels = existingGroupLabels;
    req.vm.opt.isRoot = actor.isRoot;
    req.vm.opt.defaultTenantId = actor.tenantId || PLATFORM_TENANT_ID;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/ontology/metadata", req.vm);
  } catch (err) {
    logger.error("[web/seu/ontology] GET /sdk/ontology/metadata error", err as Error);
    next(err);
  }
});

router.post("/sdk/ontology/add", async (req: Request, res: Response) => {
  const { conceptType, code, defaultLabel, description, textType, uiGrouping } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await addConcept(
      {
        conceptType: type, code: String(code ?? ""), defaultLabel: String(defaultLabel ?? ""),
        description: typeof description === "string" ? description : undefined,
        textType: textType === "text" ? "text" : "markdown",
        uiGrouping: typeof uiGrouping === "string" && uiGrouping.trim() ? uiGrouping.trim() : undefined,
      },
      actor
    );
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" added.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

router.post("/sdk/ontology/deprecate", async (req: Request, res: Response) => {
  const { conceptType, code, tenantId } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await deprecateConcept(type, String(code ?? ""), String(tenantId ?? ""), actor);
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" deprecated.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

router.post("/sdk/ontology/retire", async (req: Request, res: Response) => {
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

router.post("/sdk/ontology/archive", async (req: Request, res: Response) => {
  const { conceptType, code, tenantId } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await archiveConcept(type, String(code ?? ""), String(tenantId ?? ""), actor);
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" archived.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

router.post("/sdk/ontology/compose", async (req: Request, res: Response) => {
  const { conceptType, code, strategy, sourceConceptId, defaultLabel, description } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await composeConcept(
      {
        conceptType: type,
        code: String(code ?? ""),
        strategy: strategy === "override" ? "override" : "specialization",
        sourceConceptId: typeof sourceConceptId === "string" && sourceConceptId ? sourceConceptId : undefined,
        defaultLabel: typeof defaultLabel === "string" ? defaultLabel : undefined,
        description: typeof description === "string" ? description : undefined,
      },
      actor
    );
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" composed.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

router.post("/sdk/ontology/update-meta", async (req: Request, res: Response) => {
  const { conceptType, code, tenantId, textType, uiGrouping } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  const metadataUrl = `${backTo}/metadata`;
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await updateConceptMeta(
      type,
      String(code ?? ""),
      String(tenantId ?? ""),
      { textType: textType === "text" ? "text" : "markdown", uiGrouping: typeof uiGrouping === "string" && uiGrouping.trim() ? uiGrouping.trim() : null },
      actor
    );
    return flashSuccess(req, res, metadataUrl, `Concept "${code}" updated.`);
  } catch (err) {
    return flashError(req, res, metadataUrl, (err as Error).message);
  }
});

router.post("/sdk/ontology/quick-retire", async (req: Request, res: Response) => {
  const { conceptType, code, tenantId } = req.body ?? {};
  const metadataUrl = `${backTo}/metadata`;
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await quickRetireConcept(String(conceptType ?? "").trim(), String(code ?? ""), String(tenantId ?? ""), actor);
    return flashSuccess(req, res, metadataUrl, `Concept "${code}" retired.`);
  } catch (err) {
    return flashError(req, res, metadataUrl, (err as Error).message);
  }
});

router.get("/sdk/ontology/approvals", attachVM("seu/sdk/ontology/approvals"), async (req: Request, res: Response, next: NextFunction) => {
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    const drafts = await listDraftConceptsForApproval(actor);
    const rows = drafts.map((c) => ({
      id: c.id,
      conceptType: c.concept_type,
      code: c.code,
      label: c.default_label,
      description: c.description,
      tenantId: c.tenant_id,
      isPlatform: c.tenant_id === PLATFORM_TENANT_ID,
      createdAt: c.created_at,
    }));
    const params = parseListParams(req.query, { sortable: ["conceptType", "code", "label", "tenant"], defaultSort: "conceptType", defaultDir: "asc" });

    req.vm.req.title = "Ontology Approvals";
    req.vm.req.listBasePath = "/aisworg/seu/sdk/ontology/approvals";
    req.vm.req.list = paginateList(rows, params, {
      searchFields: [(r) => r.conceptType, (r) => r.code, (r) => r.label],
      sortFields: { conceptType: (r) => r.conceptType, code: (r) => r.code, label: (r) => r.label, tenant: (r) => (r.isPlatform ? 0 : 1) },
    });
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/ontology/approvals", req.vm);
  } catch (err) {
    logger.error("[web/seu/ontology] GET /sdk/ontology/approvals error", err as Error);
    next(err);
  }
});

router.post("/sdk/ontology/approvals/approve", async (req: Request, res: Response) => {
  const { conceptType, code, tenantId } = req.body ?? {};
  const backToApprovals = "/aisworg/seu/sdk/ontology/approvals";
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await approveConcept(String(conceptType ?? "").trim(), String(code ?? ""), String(tenantId ?? ""), actor);
    return flashSuccess(req, res, backToApprovals, `Concept "${code}" approved.`);
  } catch (err) {
    return flashError(req, res, backToApprovals, (err as Error).message);
  }
});

router.post("/sdk/ontology/approvals/reject", async (req: Request, res: Response) => {
  const { conceptType, code, tenantId, comment } = req.body ?? {};
  const backToApprovals = "/aisworg/seu/sdk/ontology/approvals";
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    await rejectConcept(String(conceptType ?? "").trim(), String(code ?? ""), String(tenantId ?? ""), String(comment ?? ""), actor);
    return flashSuccess(req, res, backToApprovals, `Concept "${code}" rejected.`);
  } catch (err) {
    return flashError(req, res, backToApprovals, (err as Error).message);
  }
});

export { router };
