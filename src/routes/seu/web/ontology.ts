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
import { listConceptTypes, listConceptsForType, addConcept, deprecateConcept, retireConcept, archiveConcept, composeConcept, updateConceptMeta, quickRetireConcept, listAllConceptsForPicker, listDistinctUiGroupings, getConceptTypeNav, tabsForActiveType, type OntologyActor } from "../core/ontology.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";

const backTo = "/aisworg/seu/sdk/ontology";

// Same heldBadges/gate shape as sdkAuthoring.ts's own (not shared/exported
// from there — small, self-contained per-route-file checks are the existing
// convention, e.g. schemaRegistry.ts's own root-only gate).
//
// Owner (2026-09-22): "the root bypass should be in the requireBadge, not
// anywhere else in the code" — the noun_verb/root portion is resolved via
// badgeAuthorityEngine.getHeldBadges, the ONE canonical check
// (participants_master.authorised_badges), not a hand-rolled badge_grants
// query re-deriving it here.
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
  return { isRoot: held.has("root"), tenantId: req.session?.user?.tenant_id ?? null, actorId: userId != null ? String(userId) : null };
}

// Owner (2026-09-22): "web/ontology.ts should have badge ontology_manage" —
// the Ontology-registered admin badge (badges:platform/badges:tenant,
// migration 256), alongside the existing ontology_define (CR-022) gate.
async function requireOntologyAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const held = await heldBadges(req);
  if (held.has("root") || held.has("ontology_define") || held.has("ontology_manage")) return next();
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
    const nav = await getConceptTypeNav(actor, conceptTypes);
    const topLevelTypes = nav.topLevel.map((t) => t.type);
    const activeType = typeof req.query.type === "string" && conceptTypes.includes(req.query.type) ? req.query.type : (topLevelTypes[0] ?? conceptTypes[0] ?? "");
    const tabTypes = activeType ? tabsForActiveType(nav, activeType) : [];

    const concepts = activeType ? await listConceptsForType(activeType, actor) : [];
    const params = parseListParams(req.query, { sortable: ["code", "label", "status", "tenant"], defaultSort: "code", defaultDir: "asc" });
    // Owner-label per row so retiring an ambiguous shared code (Platform's
    // vs. this tenant's own, both legitimately named e.g. "saas-product")
    // targets the right one — the retire form submits the row's own tenantId.
    // Migration 190 — status replaces isActive (4 values, not 2) and version
    // is now real; NEXT_STATE names, per row, which single governed hop (if
    // any) this row's own status can move to next (Ch.18 §11, no skip-ahead).
    const NEXT_STATE: Record<string, { toState: string; verb: string } | undefined> = {
      Active: { toState: "Deprecated", verb: "deprecate" },
      Deprecated: { toState: "Retired", verb: "retire" },
      Retired: { toState: "Archived", verb: "archive" },
    };
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

    // Compose picker's candidate sources — every Active concept of this same
    // type, Platform's own plus (for a non-root actor) their own tenant's,
    // same visibility findConceptsByType already resolves.
    const compositionSources = rows.filter((r) => r.status === "Active").map((r) => ({ id: r.id, code: r.code, label: r.label, isPlatform: r.isPlatform }));

    req.vm.req.title = "Ontology Management";
    // The vertical tabs strip: inside a group (profile-configuration's own
    // 8 concept_types, e.g.), just that group's members; otherwise every
    // top-level concept_type (a flat list, same as before, just narrower —
    // grouped members no longer clutter the top-level strip).
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
    // Owner: "Ui grouping in the tab forms should be having a similar
    // change" — same existing-groups datalist the Metadata page's own form
    // has, so a new concept can join an existing group without retyping its
    // label blind (or the Add form here becomes its own source of drift).
    req.vm.opt.existingGroupLabels = await listDistinctUiGroupings(actor);
    // Navbar's Ontology dropdown highlights the active concept type off
    // res.locals.currentQuery.type (app.js) — override with the RESOLVED
    // activeType (defaults to conceptTypes[0] when ?type= is absent/invalid)
    // so the highlight is correct on the bare /sdk/ontology URL too.
    res.locals.currentQuery = { ...(res.locals.currentQuery ?? {}), type: activeType };
    return renderView(req, res, "seu/sdk/ontology/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/ontology] GET /sdk/ontology error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/sdk/ontology/metadata — owner: "the list should show all. otherwise how do I edit?" One page, EVERY Active concept across every category (grouped or not), searchable/sortable, each with an Edit/Retire action, plus a picker-driven form to set text_type/ui_grouping directly. */
router.get("/sdk/ontology/metadata", requireOntologyAdmin, attachVM("seu/sdk/ontology/metadata"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    const allConcepts = await listAllConceptsForPicker(actor);

    // Same list convention every other admin table in this app uses
    // (search/sort/paginate via parseListParams+paginateList+listControls).
    // Every Active concept, not just grouped ones — an ungrouped concept
    // still needs a row to click "Edit" on, or there'd be no way to set its
    // first group/text type except retyping its type+code from scratch in
    // the form above.
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

    // Picker data: concept_type -> [{code, label}], for the page's own
    // cascading selects (real existing pairs, not free-text retyping).
    const conceptsByType: Record<string, Array<{ code: string; label: string }>> = {};
    for (const c of allConcepts) {
      (conceptsByType[c.concept_type] ??= []).push({ code: c.code, label: c.default_label });
    }

    // Owner: "Group is a text field now. It should show whatever is in the
    // db and allow a free text as well." Distinct existing ui_grouping
    // values, offered via a <datalist> — the input stays free text (a
    // genuinely new group is still just typing it), but whatever's already
    // in use is visible/pickable instead of retyped blind, which is exactly
    // the drift this page exists to prevent.
    const existingGroupLabels = await listDistinctUiGroupings(actor);

    req.vm.req.title = "Ontology Metadata";
    req.vm.req.list = list;
    req.vm.req.listBasePath = "/aisworg/seu/sdk/ontology/metadata";
    req.vm.req.conceptTypes = Object.keys(conceptsByType).sort();
    req.vm.opt.conceptsByType = conceptsByType;
    req.vm.opt.existingGroupLabels = existingGroupLabels;
    req.vm.opt.isRoot = actor.isRoot;
    // No tenant selector on this page yet (same simplification the
    // Add-concept form already makes) — root curates Platform's canonical
    // rows, everyone else their own tenant's.
    req.vm.opt.defaultTenantId = actor.isRoot ? PLATFORM_TENANT_ID : actor.tenantId;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/ontology/metadata", req.vm);
  } catch (err) {
    logger.error("[web/seu/ontology] GET /sdk/ontology/metadata error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/ontology/add — add (or re-add/reactivate) a concept; conceptType may be brand new. Non-root always adds to their OWN tenant. */
router.post("/sdk/ontology/add", requireOntologyAdmin, async (req: Request, res: Response) => {
  const { conceptType, code, defaultLabel, description, textType, uiGrouping } = req.body ?? {};
  const type = String(conceptType ?? "").trim();
  try {
    const held = await heldBadges(req);
    const actor = actorFrom(req, held);
    // Root's add form has no tenant selector yet — it always curates
    // Platform's shared vocabulary; targeting a SPECIFIC other tenant's
    // vocabulary as root is supported in core/ontology.ts (`targetTenantId`)
    // but not wired into this form (scope cut, CR-022).
    await addConcept(
      {
        conceptType: type, code: String(code ?? ""), defaultLabel: String(defaultLabel ?? ""),
        description: typeof description === "string" ? description : undefined,
        textType: textType === "text" ? "text" : "markdown",
        // Migration 191 — blank means "leave whatever this code already had"
        // (createConceptVersion's own inherit-from-base), not "clear it";
        // only a genuinely non-empty value overrides.
        uiGrouping: typeof uiGrouping === "string" && uiGrouping.trim() ? uiGrouping.trim() : undefined,
      },
      actor
    );
    return flashSuccess(req, res, `${backTo}?type=${encodeURIComponent(type)}`, `Concept "${code}" added.`);
  } catch (err) {
    return flashError(req, res, `${backTo}?type=${encodeURIComponent(type)}`, (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/ontology/deprecate — Ch.18 §11 real governed Active -> Deprecated hop (migration 190); still visible/usable, discouraged for new use. */
router.post("/sdk/ontology/deprecate", requireOntologyAdmin, async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/sdk/ontology/retire — Deprecated -> Retired (never a hard delete): existing data keeps working, drops out of new-item pickers. tenantId names which row (Platform's / this tenant's / — root only — another tenant's). */
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

/** POST /aisworg/seu/sdk/ontology/archive — Retired -> Archived, the terminal hop. */
router.post("/sdk/ontology/archive", requireOntologyAdmin, async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/sdk/ontology/compose — owner: "allow tenants to compose using the composition strategy that packs already have implemented." Specialization (copy a chosen source concept's label/description into a new/own code, free to diverge) or Override (publish a new Version of this tenant's own existing concept). Reuses domain/engine/compositionEngine.ts, the same module Pack authoring's own Compose action calls. */
router.post("/sdk/ontology/compose", requireOntologyAdmin, async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/sdk/ontology/update-meta — owner: "a CRUD to manually set the ui_grouping / text_type", kept as a SEPARATE page (owner: "if you keep it in each category, there is a possibility that there can be conflicting information within the same group"). Edits the current Version's own administrative metadata in place — no new Version, no status change. Blank uiGrouping explicitly clears it (this form is pre-filled with the current value, unlike /add's own "blank = inherit"). Always posted from, and redirects back to, the dedicated /metadata page. */
router.post("/sdk/ontology/update-meta", requireOntologyAdmin, async (req: Request, res: Response) => {
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

/** POST /aisworg/seu/sdk/ontology/quick-retire — owner: "Add a retire button also. - this should make the isActive false." Migration 190 replaced is_active with a real Active->Deprecated->Retired->Archived lifecycle (no skip-ahead edge); this walks both required hops in one click so the Metadata page can offer the same one-click "retire it" feel the old boolean had, while every real transition still runs its own badge check and publishes its own event. */
router.post("/sdk/ontology/quick-retire", requireOntologyAdmin, async (req: Request, res: Response) => {
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

export { router };
