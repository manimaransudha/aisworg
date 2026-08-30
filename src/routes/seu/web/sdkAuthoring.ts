// SDK UI Layer Plan — the four authoring surfaces' UI (Build order steps
// 3-5; Transition Definition — step 6 — isn't in KIND_BY_SLUG yet, since it
// needs the transitionEngine/qualityGateEngine generalisation first). One
// generic, kind-parametrized set of routes and views, not four hand-built
// copies — "this is where the generator actually pays for itself" (the
// plan's Build order, step 4).
//
// Access control (CR-014): the legacy Platform badges sdk_creator/sdk_approver
// are retired. Each surface is gated by the AUTHORED ENTITY's noun × verb —
// `{kind}_define` (author) / `{kind}_publish` (publisher); root bypasses. The
// /authority/* vocabulary-management surface is gated by transitiondefinition_*.
// See requireAuthoring() / requireAuthorityAdmin() below.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import {
  generateFields, parseFormBody, validateAgainstSchema, groupFieldsForDisplay, ontologyConceptTypesIn, dynamicReferentialSourceFieldsIn,
  CONTRIBUTION_SECTION_HELP, VERIFIABLE_ITEM_FIELD_HELP, type JsonSchemaDocument,
} from "../../../domain/sdk/formGenerator.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import { listConceptsForType } from "../core/ontology.js";
import {
  listMyAuthoredRows, computeRowActions, getAuthoringDraft, createAuthoringDraft, saveAuthoringDraft, publishAuthoringDraft, composeAuthoringDraft,
  listInheritableTemplates, inheritedTemplateContent, listInheritableProfiles, inheritedProfileContent, inheritedPackVersionContent,
  type AuthoringDraftSummary,
} from "../core/sdkAuthoring.js";
import { PLATFORM_TENANT_ID } from "../../../dblayer/constants.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { transitionPack, packCodeVersionSummaries } from "../core/packs.js";
import { transitionTemplate, PACK_SELECTION_SLOTS, deriveCapabilityCodesFromPackCodes, deriveCapabilityProducingPacksFromPackCodes } from "../core/templates.js";
import { transitionProfile } from "../core/profiles.js";
import { transitionDeliverableDefinition, listInheritableDeliverableDefinitions, inheritedDeliverableDefinitionContent } from "../core/deliverableDefinitions.js";
import { listCurrentTransitionDefinitions, getTransitionDefinitionDetail, addTransitionDefinition, retireTransitionDefinition, updateTransitionDefinition } from "../core/transitionDefinitions.js";
import {
  listAuthorityNouns, listAuthorityVerbs, listAuthorityMapping,
  listActiveNouns, listActiveVerbs, activeMappingByNoun,
  addNoun, addVerb, addMapping, retireNoun, retireVerb, retireMapping, updateMappingTrigger,
} from "../core/authorityVocabulary.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import type { SchemaDefinitionEntityKind } from "../../../dblayer/seuTypes.js";

const KIND_BY_SLUG: Record<string, SchemaDefinitionEntityKind> = {
  "pack-authoring": "Pack",
  "template-authoring": "Template",
  "profile-authoring": "Profile",
  "transition-definition-authoring": "TransitionDefinition",
  "deliverable-authoring": "Deliverable",
};
const PUBLISH_REDIRECT_BY_KIND: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "/aisworg/seu/packs",
  Template: "/aisworg/seu/sdk/template-authoring",
  Profile: "/aisworg/seu/sdk/profile-authoring",
  TransitionDefinition: "/aisworg/seu/sdk/transition-definition-authoring",
  Deliverable: "/aisworg/seu/sdk/deliverable-authoring",
};

function resolveKind(slug: string): SchemaDefinitionEntityKind | null {
  return KIND_BY_SLUG[slug] ?? null;
}

const backToIndex = (slug: string) => `/aisworg/seu/sdk/${slug}`;
const backTo = (slug: string, deliverableId: string) => `${backToIndex(slug)}/${deliverableId}`;

// CR-014 — SDK authoring authorisation is the authored entity's noun × verb
// (root bypasses). `{kind}_define` = author (view/create/edit/submit),
// `{kind}_publish` = publisher (approve/publish). The `sdk_creator`/
// `sdk_approver` Platform badges are retired. `Deliverable` is the default noun
// only if a kind ever lacks its own — all four have nouns today.
function authoringBadge(kind: SchemaDefinitionEntityKind, level: "define" | "publish"): string {
  return `${kind.toLowerCase()}_${level}`;
}

// The actor's full set of held badges: platform-scoped (root, etc.) plus every
// active noun_verb grant. One query per request on this admin surface.
async function heldBadges(req: Request): Promise<Set<string>> {
  const set = new Set<string>(req.session?.user?.platformBadges ?? []);
  const userId = req.session?.user?.id;
  if (userId != null) {
    const { data: grants } = await badgeGrantsDB.findActiveForHolder(String(userId));
    for (const g of grants ?? []) set.add(g.badge_type);
  }
  return set;
}

function denyAuthoring(req: Request, res: Response): void {
  if (req.session) {
    (req.session as unknown as { flash?: { type: string; message: string } }).flash = {
      type: "error",
      message: `You don't have the required badge for that.`,
    };
  }
  res.redirect(req.headers.referer || "/aisworg");
}

// Kind-aware gate for the /sdk/:slug authoring surfaces. `define`/`publish` =
// that specific authoring level. `any` = hold ANY of the entity's noun × verb
// badges — not just define/publish. Bug fix: a holder of, say, only
// `pack_validate` (one of Pack's other lifecycle verbs — validate, activate,
// deprecate, retire, archive) was being denied the surface entirely and could
// never reach their own per-verb tab ("User reviewed Packs"); "any" now means
// any `{kind}_*` badge, matching the per-verb tabs this gates access to.
function requireAuthoring(need: "any" | "define" | "publish") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const kind = resolveKind(String(req.params.slug));
    if (!kind) return next();
    const held = await heldBadges(req);
    if (held.has("root")) return next();
    if (need === "define") return held.has(authoringBadge(kind, "define")) ? next() : denyAuthoring(req, res);
    if (need === "publish") return held.has(authoringBadge(kind, "publish")) ? next() : denyAuthoring(req, res);
    const prefix = `${kind.toLowerCase()}_`;
    if ([...held].some((b) => b.startsWith(prefix))) return next();
    return denyAuthoring(req, res);
  };
}

// The /authority/* vocabulary-management surface administers the governed
// vocabulary itself → gated by TransitionDefinition authoring authority.
async function requireAuthorityAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (await canWriteAuthority(req)) return next();
  return denyAuthoring(req, res);
}


// Owner: "I want to change the packs list Pack authoring-All packs similar
// to Objectives. List the tenant scope+platform packs as a list with action
// buttons corresponding to the badge." Replaces the old "I defined" +
// per-verb "Queue" tabs (buildAuthoringTabs, removed) with one flat list of
// the viewer's own authored rows, each carrying whatever governed-transition
// action buttons the viewer currently holds the badge for — computeRowActions
// (core/sdkAuthoring.ts) does the per-status lookup, called once per DISTINCT
// status present rather than once per row.
async function myAuthoredRowsWithActions(kind: SchemaDefinitionEntityKind, held: Set<string>, isRoot: boolean, myId: number | null): Promise<Array<AuthoringDraftSummary & { actions: Awaited<ReturnType<typeof computeRowActions>> }>> {
  if (myId == null) return [];
  const rows = await listMyAuthoredRows(kind, myId);
  const actionsByStatus = new Map<string, Awaited<ReturnType<typeof computeRowActions>>>();
  for (const status of new Set(rows.map((r) => r.status))) {
    actionsByStatus.set(status, await computeRowActions(kind, status, held, isRoot));
  }
  return rows.map((r) => ({ ...r, actions: actionsByStatus.get(r.status) ?? [] }));
}

/** GET /aisworg/seu/sdk/:slug — every in-progress and completed authoring session for this kind. */
router.get("/sdk/:slug", requireAuthoring("any"), attachVM("seu/sdk/authoring/index"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  try {
    const held = await heldBadges(req);
    const isRoot = held.has("root");
    const myId = req.session?.user?.id != null ? Number(req.session.user.id) : null;
    // CR-019: TransitionDefinition is authored via the CR-007 form embedded below,
    // not the entity-direct grammar path — hide the draft affordances.
    const grammarAuthored = kind !== "TransitionDefinition";
    req.vm.req.title = `${kind} Authoring`;
    req.vm.req.kindLabel = kind;
    req.vm.req.slug = slug;
    req.vm.req.showDrafts = grammarAuthored;

    if (grammarAuthored) {
      req.vm.req.rows = await myAuthoredRowsWithActions(kind, held, isRoot, myId);
      req.vm.req.canCreate = isRoot || held.has(authoringBadge(kind, "define"));
    } else {
      req.vm.req.rows = [];
      req.vm.req.canCreate = false;
    }

    // CR-007: on the Transition Definition surface, also show the LIVE
    // transition_definitions (the current governed-transition graph), not just
    // authoring drafts. Paginated/searchable/sortable (the live set carries
    // test-fixture rows today).
    if (kind === "TransitionDefinition") {
      const params = parseListParams(req.query, { sortable: ["entity", "from", "to", "verb", "rule"], defaultSort: "entity", defaultDir: "asc" });
      const defs = await listCurrentTransitionDefinitions();
      req.vm.opt.definitions = paginateList(defs, params, {
        searchFields: [(d) => d.entityType, (d) => d.fromState, (d) => d.toState, (d) => d.verb, (d) => d.nounVerbBadge, (d) => d.authorityRuleCode],
        sortFields: {
          entity: (d) => d.entityType,
          from: (d) => d.fromState,
          to: (d) => d.toState,
          verb: (d) => d.verb,
          rule: (d) => d.authorityRuleCode,
        },
      });
      req.vm.opt.listBasePath = `/aisworg/seu/sdk/${slug}`;
      // CR-007 Step 2 — data for the "add transition" form + retire/detail actions.
      req.vm.opt.canWriteAuthority = await canWriteAuthority(req);
      req.vm.opt.activeNouns = await listActiveNouns();
      req.vm.opt.mappingByNoun = await activeMappingByNoun();
    }

    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authoring/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /sdk/:slug error", err as Error);
    next(err);
  }
});

// CR-006 Stage 1b — the noun × verb authority vocabulary tabs (read-only
// browse). Own /authority/* paths so they don't collide with /sdk/:slug/:id;
// the nav-tabs partial links these four surfaces together. Each is a real
// server-side list (paginated/searched/sorted) per the List UI Requirements.

// CR-014 — managing the authority vocabulary requires TransitionDefinition
// authoring authority (root bypasses).
async function canWriteAuthority(req: Request): Promise<boolean> {
  const held = await heldBadges(req);
  return held.has("root") || held.has("transitiondefinition_define");
}

/** GET /aisworg/seu/authority/nouns — Work outcome (the noun vocabulary). */
router.get("/authority/nouns", requireAuthorityAdmin, attachVM("seu/sdk/authority/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = parseListParams(req.query, { sortable: ["code", "label", "verbCount", "transitionCount", "active"], defaultSort: "code", defaultDir: "asc" });
    const nouns = await listAuthorityNouns();
    req.vm.req.title = "Authority — Work outcome";
    req.vm.req.activeTab = "nouns";
    req.vm.req.tabLabel = "Work outcome (Nouns)";
    req.vm.req.listBasePath = "/aisworg/seu/authority/nouns";
    req.vm.req.list = paginateList(nouns, params, {
      searchFields: [(n) => n.code, (n) => n.label, (n) => n.description],
      sortFields: { code: (n) => n.code, label: (n) => n.label, verbCount: (n) => n.verbCount, transitionCount: (n) => n.transitionCount, active: (n) => (n.isActive ? 1 : 0) },
    });
    req.vm.opt.canWrite = canWriteAuthority(req);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/nouns error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/authority/verbs — Work process (the verb vocabulary). */
router.get("/authority/verbs", requireAuthorityAdmin, attachVM("seu/sdk/authority/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = parseListParams(req.query, { sortable: ["code", "label", "nounCount", "active"], defaultSort: "code", defaultDir: "asc" });
    const verbs = await listAuthorityVerbs();
    req.vm.req.title = "Authority — Work process";
    req.vm.req.activeTab = "verbs";
    req.vm.req.tabLabel = "Work process (Verbs)";
    req.vm.req.listBasePath = "/aisworg/seu/authority/verbs";
    req.vm.req.list = paginateList(verbs, params, {
      searchFields: [(v) => v.code, (v) => v.label, (v) => v.description],
      sortFields: { code: (v) => v.code, label: (v) => v.label, nounCount: (v) => v.nounCount, active: (v) => (v.isActive ? 1 : 0) },
    });
    req.vm.opt.canWrite = canWriteAuthority(req);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/verbs error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/authority/mapping — Mapping (which verbs a noun allows, per pair). */
router.get("/authority/mapping", requireAuthorityAdmin, attachVM("seu/sdk/authority/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = parseListParams(req.query, { sortable: ["nounCode", "verbCode", "active"], defaultSort: "nounCode", defaultDir: "asc" });
    const mapping = await listAuthorityMapping();
    req.vm.req.title = "Authority — Mapping";
    req.vm.req.activeTab = "mapping";
    req.vm.req.tabLabel = "Mapping (Noun → allowed verbs)";
    req.vm.req.listBasePath = "/aisworg/seu/authority/mapping";
    req.vm.req.list = paginateList(mapping, params, {
      searchFields: [(m) => m.nounCode, (m) => m.nounLabel, (m) => m.verbCode, (m) => m.verbLabel],
      sortFields: { nounCode: (m) => `${m.nounCode} ${m.verbCode}`, verbCode: (m) => m.verbCode, active: (m) => (m.isActive ? 1 : 0) },
    });
    req.vm.opt.canWrite = canWriteAuthority(req);
    req.vm.opt.activeNouns = await listActiveNouns();
    req.vm.opt.activeVerbs = await listActiveVerbs();
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/mapping error", err as Error);
    next(err);
  }
});

// ── CR-007 Step 2 — add + soft-retire (never delete/rename). CR-014: gated by
//    transitiondefinition_define (requireAuthorityAdmin); root bypasses. ──
const AUTH_NOUNS = "/aisworg/seu/authority/nouns";
const AUTH_VERBS = "/aisworg/seu/authority/verbs";
const AUTH_MAPPING = "/aisworg/seu/authority/mapping";
const TD_INDEX = "/aisworg/seu/sdk/transition-definition-authoring";
const wrote = (req: Request, res: Response, back: string, r: { ok: true } | { ok: false; error: string }, okMsg: string) =>
  r.ok ? flashSuccess(req, res, back, okMsg) : flashError(req, res, back, r.error);

router.post("/authority/nouns/add", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { code, label, description } = req.body ?? {};
  wrote(req, res, AUTH_NOUNS, await addNoun(String(code ?? ""), String(label ?? ""), description ? String(description) : null), `Noun "${code}" added.`);
});
router.post("/authority/nouns/retire", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  wrote(req, res, AUTH_NOUNS, await retireNoun(String(code ?? "")), `Noun "${code}" retired.`);
});

router.post("/authority/verbs/add", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { code, label, description } = req.body ?? {};
  wrote(req, res, AUTH_VERBS, await addVerb(String(code ?? ""), String(label ?? ""), description ? String(description) : null), `Verb "${code}" added.`);
});
router.post("/authority/verbs/retire", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  wrote(req, res, AUTH_VERBS, await retireVerb(String(code ?? "")), `Verb "${code}" retired.`);
});

router.post("/authority/mapping/add", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { nounCode, verbCode, trigger } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await addMapping(String(nounCode ?? ""), String(verbCode ?? ""), trigger ? String(trigger) : undefined), `Mapping ${nounCode} → ${verbCode} added.`);
});
router.post("/authority/mapping/retire", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { nounCode, verbCode } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await retireMapping(String(nounCode ?? ""), String(verbCode ?? "")), `Mapping ${nounCode} → ${verbCode} retired.`);
});
/** CR-072 — the only field this edits is trigger, on every transition_definitions row sharing this (noun, verb). */
router.post("/authority/mapping/edit-trigger", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { nounCode, verbCode, trigger } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await updateMappingTrigger(String(nounCode ?? ""), String(verbCode ?? ""), String(trigger ?? "")), `${nounCode} + ${verbCode} trigger set to "${trigger}".`);
});

router.post("/authority/transition-definitions/add", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { entityType, fromState, toState, verb } = req.body ?? {};
  wrote(req, res, TD_INDEX, await addTransitionDefinition({ entityType: String(entityType ?? ""), fromState: String(fromState ?? ""), toState: String(toState ?? ""), verb: String(verb ?? "") }), `Transition ${entityType} ${fromState} → ${toState} added.`);
});
router.post("/authority/transition-definitions/retire", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { id } = req.body ?? {};
  wrote(req, res, TD_INDEX, await retireTransitionDefinition(String(id ?? "")), "Transition definition retired.");
});

/** GET /aisworg/seu/authority/transition-definitions/:id — view detail. */
router.get("/authority/transition-definitions/:id", requireAuthorityAdmin, attachVM("seu/sdk/authority/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getTransitionDefinitionDetail(String(req.params.id));
    if (!detail) return next();
    req.vm.req.title = `Transition — ${detail.entityType} ${detail.fromState} → ${detail.toState}`;
    req.vm.req.detail = detail;
    // requireAuthorityAdmin already gated reaching this page on the same
    // predicate, so this is always true here — set explicitly (matching the
    // list route's own use of this same helper) rather than leaving the
    // view's Edit-link check against an unset local.
    req.vm.opt.canWriteAuthority = await canWriteAuthority(req);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/transition-definitions/:id error", err as Error);
    next(err);
  }
});

/**
 * GET /aisworg/seu/authority/transition-definitions/:id/edit (owner: "View,
 * Retire and Add are there. Edit is missing"). entityType/fromState/toState/
 * verb are shown read-only for context — same "never delete/rename" identity
 * as Retire/Add — only creates_obligation/category are editable here.
 */
router.get("/authority/transition-definitions/:id/edit", requireAuthorityAdmin, attachVM("seu/sdk/authority/edit"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getTransitionDefinitionDetail(String(req.params.id));
    if (!detail) return next();
    req.vm.req.title = `Edit — ${detail.entityType} ${detail.fromState} → ${detail.toState}`;
    req.vm.req.detail = detail;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/edit", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/transition-definitions/:id/edit error", err as Error);
    next(err);
  }
});
router.post("/authority/transition-definitions/:id/update", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { createsObligation, category } = req.body ?? {};
  wrote(
    req,
    res,
    `/aisworg/seu/authority/transition-definitions/${id}`,
    await updateTransitionDefinition(id, { createsObligation: createsObligation != null ? String(createsObligation) : null, category: category != null ? String(category) : null }),
    "Transition definition updated."
  );
});

// Registry-backed options for referential-select/referential-list fields,
// keyed by the same x-referential-source string a grammar declares.
//
// Bug fix (owner: "what is the input to the dropdown?"): packsDB.findAll()
// returns every Pack row of every status — a pack-code picker (Dependencies,
// Template's mandatoryPackCodes, Profile's optionalPackCodes) was offering
// Draft/Deprecated/Retired/Archived rows as choices, contradicting the
// Dependencies tab's own help text ("a required dependency must resolve to a
// real, Active Pack"). Only one row per code can be Active at a time
// (activation supersedes whatever else is Active for that code — packs.ts),
// so filtering to status "Active" here is both correct and covers every
// Pack this viewer is allowed to see. Pack ownership (owner: "This applies to
// the packs dropdown in any of the packs dropdown"): root sees every tenant's;
// everyone else sees Platform-owned Packs plus their own tenant's.
// Owner, 2026-08-19: Profile's featureFlagCodes is a plain referential-list
// (not the x-ontology top-level-select mechanism loadOntologyOptions below
// handles) whose item field sources "feature-flag" — an Ontology concept
// type, same tenant-scoped visibility (Platform + this viewer's own) as
// every other Ontology lookup on this page, just resolved as a flat code
// list the same way pack-code/template-code already are.
// Ch.17 §7's own canonical 6 — the only values Quality Gate's category
// picker should ever offer, regardless of what else has drifted into the
// live category:evidence vocabulary over time.
const CANONICAL_EVIDENCE_CATEGORIES = new Set(["Analytical Evidence", "Validation Evidence", "Operational Evidence", "Review Evidence", "Decision Evidence", "External Evidence"]);

async function loadReferentialOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, string[]>> {
  const [{ data: packs }, { data: templates }, featureFlags, deliverableNames, deliverableCategories, evidenceCategories, policyCategories, obligationCategories, obligationOrigins, serviceNames, capabilityNames, { data: transitionDefinitions }] = await Promise.all([
    viewer.isRoot || !viewer.tenantId ? packsDB.findAll() : packsDB.findAllVisibleTo(viewer.tenantId),
    templatesDB.findAllActive(),
    listConceptsForType("feature-flag", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("deliverable-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:deliverable", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    // CR-058 follow-up 2 (owner: "the code isn't a UUID or a freeform
    // Pack-specific string — it's the category identifier itself, drawn
    // from the same Ontology-governed vocabulary as Ch.17 §7's Evidence
    // Categories") — a Quality Gate's category (and hence its code) is
    // category:evidence, reused directly rather than a separate
    // quality-gate-only vocabulary.
    listConceptsForType("category:evidence", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    // CR-061 — Policy's own category, a new concept type of its own (owner:
    // "category should be ontology driven. The policy categories are in
    // section 7. Seed these categories as category:policy"), not reused
    // from category:evidence/category:pack — confirmed independent (owner:
    // "It does not change the policy category. So I can have a customer
    // sign off policy category across any gate category").
    listConceptsForType("category:policy", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    // CR-062 — Obligation Definition's own category (category:obligation,
    // already existed, real precedent per Ch.23 §19.4 — just never wired
    // into the authoring form) and origin (category:obligation-origin, new
    // concept type, Ch.23 §10's 11 named Obligation Sources).
    listConceptsForType("category:obligation", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:obligation-origin", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    // CR-064 — a Service's own canonical code (service-name, freely-
    // extensible, deliberately shared across Packs so e.g. a Development
    // and a Deployment Pack can each declare their own row under the same
    // code with different Service Level content).
    listConceptsForType("service-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    // CR-079 step (c) — a Capability contribution's own code (Track A),
    // strictly picked from capability-name — same freely-extensible, shared-
    // across-Packs treatment as service-name above.
    listConceptsForType("capability-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    transitionDefinitionsDB.listAll(),
  ]);
  const activePacks = (packs ?? []).filter((p) => p.status === "Active");
  return {
    "pack-code": [...new Set(activePacks.map((p) => p.code))].sort(),
    "template-code": [...new Set((templates ?? []).map((t) => t.code))].sort(),
    "feature-flag": [...new Set(featureFlags.map((c) => c.code))].sort(),
    // CR-038 — unlike feature-flag (a stable slug checked elsewhere in code),
    // these submit the concept's own default_label, not its code: the value
    // has to BE the human name that ends up in deliverables.name at runtime,
    // the same thing dependencyGraph's self-referential toName/fromName
    // already expect from this same field.
    "deliverable-name": [...new Set(deliverableNames.map((c) => c.default_label))].sort(),
    "category:deliverable": [...new Set(deliverableCategories.map((c) => c.default_label))].sort(),
    // Owner: "Review Gates form is pathetic... same feedback for quality
    // gates" — the live category:evidence vocabulary carries 4 drifted,
    // non-canonical values ("Review"/"Technical"/"Test"/"Validation") never
    // cleaned up (a pre-existing Evidence-model gap, out of scope to fix at
    // the Ontology-data level here — real Evidence rows already use them).
    // This picker is Quality Gate's ONLY consumer of category:evidence
    // (confirmed: no other schema field references this source), so
    // narrowing what's OFFERED here to the real Ch.17 §7 canonical 6 is
    // safe and fully scoped — doesn't touch the underlying Ontology data or
    // any other picker/validation path.
    "category:evidence": [...new Set(evidenceCategories.map((c) => c.code))]
      .filter((c) => CANONICAL_EVIDENCE_CATEGORIES.has(c))
      .sort(),
    "category:policy": [...new Set(policyCategories.map((c) => c.code))].sort(),
    "category:obligation": [...new Set(obligationCategories.map((c) => c.code))].sort(),
    "category:obligation-origin": [...new Set(obligationOrigins.map((c) => c.code))].sort(),
    "service-name": [...new Set(serviceNames.map((c) => c.code))].sort(),
    "capability-name": [...new Set(capabilityNames.map((c) => c.code))].sort(),
    // CR-058 — a Quality Gate's Scope/Applicable Lifecycle Transition,
    // picked from real transition_definitions rows only (owner: "the pack
    // should not define something beyond what a transition definition
    // already holds"). Submitted value is the machine-parseable delimited
    // triple (core/packs.ts's parseGovernedTransition splits it back apart
    // at seedContributions time); the option's own display TEXT (set in the
    // view, options are plain strings here) needs to stay legible, so the
    // delimited value itself uses a readable separator rather than an
    // opaque id.
    "transition-definition": [...new Set((transitionDefinitions ?? []).filter((t) => t.is_active).map((t) => `${t.entity_type}|${t.from_state}|${t.to_state}`))].sort(),
  };
}

// CR-038 — "The Required Capability codes need not be an UI field. It is
// derived from the selections the user makes" — producingCapabilityCode's
// own options are exactly that derivation, run live against whichever Packs
// are CURRENTLY selected on this Draft (not yet saved/published), so the
// picker always offers what publishing would actually derive. content's Pack
// fields may be raw {packCode} rows (as posted) or already-flat strings
// (reactivateAsNewVersion's own draftContent convention) — normalised
// defensively either way.
function extractPackCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (typeof row === "string" ? row : (row as Record<string, unknown> | null)?.packCode))
    .filter((code): code is string => typeof code === "string" && code.trim() !== "");
}

async function loadDerivedPackCapabilityOptions(content: Record<string, unknown>): Promise<Record<string, string[]>> {
  const packCodes = [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => extractPackCodes(content[slot.field as string])))];
  const derived = await deriveCapabilityCodesFromPackCodes(packCodes);
  return { "derived:requiredCapabilityCodes": derived.sort() };
}

// Owner: "Producing Capability Code as a link to the pack" — Deliverable
// Catalogue's own view-mode rendering (_referentialListGroup.ejs) needs to
// resolve producingCapabilityCode back to the real Pack that contributes it.
async function loadProducingCapabilityPacks(content: Record<string, unknown>): Promise<Record<string, unknown>> {
  const packCodes = [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => extractPackCodes(content[slot.field as string])))];
  return deriveCapabilityProducingPacksFromPackCodes(packCodes);
}

// CR-041 — self-referential referential-list options: "pick from the rows
// already entered in another field of this same Draft," not an external
// registry. Schema-driven and entity-kind-agnostic by construction (any
// referential-list item field whose x-referential starts with "self:" gets
// resolved this way, whichever kind's schema declares it — Template's
// dependencyGraph.toName -> "self:deliverableCatalogue" is the first, not
// the only, caller) — no per-kind branch here, same discipline
// loadOntologyOptions already follows for x-ontology fields.
function selfReferentialFieldNamesIn(schema: JsonSchemaDocument): string[] {
  const names = new Set<string>();
  for (const def of Object.values(schema.properties ?? {})) {
    if (def["x-widget"] !== "referential-list") continue;
    for (const itemDef of Object.values(def.items?.properties ?? {})) {
      const source = itemDef["x-referential"];
      if (source?.startsWith("self:")) names.add(source.slice("self:".length));
    }
  }
  return [...names];
}

// content is the Draft's own already-parsed content (JSONB, not the raw
// posted textarea string) — the same object generateFields itself renders
// from. Identifying value per row was always its own `name` until CR-059's
// contributionQualityGates -> contributionReviewGates reference: Review
// Gate's own identity is `code` (the deliverable type it's for), not `name`
// (a separate label field). Which key applies is decided once, per FIELD,
// from the schema itself (does that field's own item shape declare a
// `code` property?) — not guessed per row, which would silently mix values
// within one option list whenever a row happens to be missing whichever key
// the fallback tried first (owner: "no fallback ; it has to be code... this
// fallback will pollute").
function loadSelfReferentialOptions(schema: JsonSchemaDocument, content: Record<string, unknown>): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  for (const fieldName of selfReferentialFieldNamesIn(schema)) {
    const rows = Array.isArray(content[fieldName]) ? (content[fieldName] as Array<Record<string, unknown>>) : [];
    const identityKey = schema.properties?.[fieldName]?.items?.properties?.code ? "code" : "name";
    options[`self:${fieldName}`] = [...new Set(rows.map((r) => (typeof r[identityKey] === "string" ? (r[identityKey] as string) : "")).filter(Boolean))];
  }
  return options;
}

// Ontology-backed referential-select options — ONE resolver for every such
// field across Pack/Template/Profile (owner: "The form generator should say
// which fields are from ontology and use a generic function so this is still
// driven by the schema pointing to the ontology. Every field that needs the
// ontology... has to follow this" / "do not hard code in the schema. The
// schema has to pick the values from the ontology"). Which fields are
// ontology-backed, and which concept_type each resolves, comes entirely from
// the schema's own x-ontology/x-referential-source markers
// (ontologyConceptTypesIn) — nothing here branches on a field name or kind.
// A new ontology-backed field on any of the three kinds is a schema change +
// an Ontology Management data change, never a new loader function.
//
// CR-022: concepts are tenant-scoped now — `viewer` shows this author
// Platform's shared vocabulary plus their own tenant's (root sees every
// tenant's), the same visibility every other Pack/Template picker on this
// page already uses.
async function loadOntologyOptions(schema: JsonSchemaDocument, viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, Array<{ code: string; label: string; description: string | null }>>> {
  const conceptTypes = ontologyConceptTypesIn(schema);
  const entries = await Promise.all(conceptTypes.map(async (conceptType) => {
    const concepts = await listConceptsForType(conceptType, viewer, false); // active only — the picker view, not the admin view
    // CR-023: description travels alongside code/label now — "when to use
    // this" guidance (e.g. template-categories), shown live as the author
    // picks an option (edit.ejs's script), not just on the admin page.
    return [conceptType, concepts.map((c) => ({ code: c.code, label: c.default_label, description: c.description })).sort((a, b) => a.label.localeCompare(b.label))] as const;
  }));
  const result: Record<string, Array<{ code: string; label: string; description: string | null }>> = Object.fromEntries(entries);

  // CR-079 step (d) — a field driven by another field's value (Pack's own
  // `code`, driven by `category`) needs every POSSIBLE concept type
  // pre-loaded, not just whichever matches today's saved category — the
  // author can change category in the browser before saving, and the
  // client-side swap has no server round trip to fetch a new one. The set of
  // possible types is derived from the driver field's OWN governing
  // vocabulary (category -> category:pack), never a hardcoded list — a new
  // category is still a pure data change (Ch.5 §17).
  for (const { driverField, suffix } of dynamicReferentialSourceFieldsIn(schema)) {
    const driverConceptType = schema.properties?.[driverField]?.["x-referential-source"];
    if (!driverConceptType) continue;
    const driverConcepts = await listConceptsForType(driverConceptType, viewer, false);
    await Promise.all(driverConcepts.map(async (driverConcept) => {
      const conceptType = `${driverConcept.code.toLowerCase()}${suffix}`;
      if (result[conceptType]) return;
      const concepts = await listConceptsForType(conceptType, viewer, false);
      result[conceptType] = concepts.map((c) => ({ code: c.code, label: c.default_label, description: c.description })).sort((a, b) => a.label.localeCompare(b.label));
    }));
  }
  return result;
}

// Owner: "Pack code should include the pack and the version number in the
// dropdown. Version should not be a text field... There should also have a
// dropdown on the category." — the Dependencies tab's Pack picker needs more
// than the flat code list above: the version to show/auto-fill alongside each
// code, and the category to filter by. One row per Active Pack visible to
// this viewer (at most one per code, same invariant as above).
//
// `name` (owner, 2026-08-18: "Pack code dropdown has to be platform + tenant
// ones" + the CR-015 legibility half it never got — "the dependency picker
// should display name for legibility"): every picker sourced from this list
// (Pack's own Dependencies tab, Template's mandatoryPackCodes, Profile's
// optionalPackCodes) now shows the Pack's `name` as the option label — `code`
// is a system UUID (CR-015) with nothing readable in it — while still
// submitting `code` as the value underneath.
// `id` (CR-046) — the view-mode row rendering (_referentialListGroup.ejs)
// links a resolved Pack reference straight to its own authoring/view page;
// a code alone isn't a routable URL (the authoring route is id-keyed).
export interface PackDependencyOption { id: string; code: string; name: string; version: string; category: string }
async function loadActivePackDependencyOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<PackDependencyOption[]> {
  const { data: packs } = viewer.isRoot || !viewer.tenantId ? await packsDB.findAll() : await packsDB.findAllVisibleTo(viewer.tenantId);
  return (packs ?? [])
    .filter((p) => p.status === "Active")
    .map((p) => ({ id: p.id, code: p.code, name: p.name, version: p.pack_version, category: p.category }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// CR-060, corrected same day — checklistIds' own picker source, scoped to
// Checklists belonging to a Pack sharing THIS Pack's own `code` (owner:
// "any Pack's gate can point at any Pack's checklist - i thought we said
// this is if the pack codes match. If checklists are global, then we would
// have created a registry?"). Not the whole platform: Checklist has no real
// registry (Ch.47 §16/§20) — matching `code` (any version/tenant) is the
// real scope. Policy (CR-061, `loadPolicyOptions` below) has the identical
// scope for the identical reason. Empty until the Pack's own `code` is
// chosen — there's nothing to share a code with yet. `packName` still
// disambiguates the option label (Checklist Name is only unique within its
// own Pack row, and several rows can share this code).
export interface ChecklistOption { id: string; name: string; packName: string }
async function loadChecklistOptions(packCode: string): Promise<ChecklistOption[]> {
  if (!packCode.trim()) return [];
  const { data: checklists } = await checklistsDB.findByPackCode(packCode);
  return (checklists ?? []).map((c) => ({ id: c.id, name: c.name, packName: c.pack_name })).sort((a, b) => a.packName.localeCompare(b.packName) || a.name.localeCompare(b.name));
}

// CR-061 — requiredPolicyCodes' own picker source, identical shape and
// scope to loadChecklistOptions above (owner: "Similar to checklist, if
// the pack code matches, that policy has to be visible to all other
// packs").
export interface PolicyOption { id: string; name: string; packName: string }
async function loadPolicyOptions(packCode: string): Promise<PolicyOption[]> {
  if (!packCode.trim()) return [];
  const { data: policies } = await policiesDB.findByPackCode(packCode);
  return (policies ?? []).map((p) => ({ id: p.id, name: p.name, packName: p.pack_name })).sort((a, b) => a.packName.localeCompare(b.packName) || a.name.localeCompare(b.name));
}

// Same legibility fix, for Profile's baseTemplateCode picker — Template's own
// `code` is now also a system UUID (migration 045, owner: "Why is code not
// auto generated?"), so the picker needs `name` too. Active Templates only,
// same invariant as the Pack picker above. Templates have no Pack-style
// tenant ownership (Ch.6 §20), so this stays unscoped for every viewer.
export interface TemplateOption { code: string; name: string }
async function loadActiveTemplateOptions(): Promise<TemplateOption[]> {
  const { data: templates } = await templatesDB.findAllActive();
  return (templates ?? []).map((t) => ({ code: t.code, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
}

async function latestSchemaFor(kind: SchemaDefinitionEntityKind): Promise<JsonSchemaDocument | null> {
  const { data: schemaDef } = await schemaDefinitionsDB.findLatest(kind);
  return (schemaDef?.schema as JsonSchemaDocument) ?? null;
}

// The one governed transition leading OUT of `fromState`, if any — what
// "Advance" on the authoring surface actually runs next. One hop, not the
// whole remaining chain (see advancePackOneStep / publishAuthoringDraft) —
// Pack has several of these between Draft and Active; Template/Profile have
// exactly one (Draft -> Active). No ambiguity in the seeded graph: each
// pre-Active state has a single forward edge (the reactivation edges some
// terminal states carry back to Active aren't reachable from here — the
// authoring surface never puts a Draft-derived row past Active).
async function nextHop(kind: SchemaDefinitionEntityKind, fromState: string): Promise<{ verb: string; toState: string } | null> {
  const defs = await listCurrentTransitionDefinitions();
  const match = defs.find((d) => d.entityType === kind && d.isActive && d.fromState === fromState && d.verb);
  return match ? { verb: match.verb!, toState: match.toState } : null;
}

// Shared renderer for both the "new" (no draft yet) and "edit" (existing draft)
// forms — entity-direct: the form is generated from the kind's schema and
// prefilled from the Draft entity's own content.
async function renderAuthoringForm(req: Request, res: Response, kind: SchemaDefinitionEntityKind, slug: string, draft: { id: string; code: string; name: string; status: string; content: Record<string, unknown> } | null, prefill?: { content: Record<string, unknown>; parentTemplateId?: string; parentProfileId?: string; parentDeliverableDefinitionId?: string }): Promise<void> {
  const schema = await latestSchemaFor(kind);
  if (!schema) return flashError(req, res, backToIndex(slug), `No schema_definitions grammar for ${kind}.`);
  const held = await heldBadges(req);
  const isRoot = held.has("root");
  const canDefine = isRoot || held.has(authoringBadge(kind, "define"));
  const isDraft = !draft || draft.status === "Draft";
  // The next single hop off this draft's CURRENT status (not always "publish"
  // — e.g. a Validated Pack's next hop is `publish` -> Published, gated on
  // pack_publish, not pack_activate). Only shown if this actor holds THAT
  // hop's specific badge — separation of duties, not a blanket "publish" grant.
  // Bug fix (owner: "I do not see the Validate button on the new pack
  // form... why did you remove it"): computed off "Draft" even when no draft
  // exists yet (isNew) — the button should still be VISIBLE (just disabled
  // until the first Save, edit.ejs's own script) so its existence and label
  // aren't a surprise that only appears after saving. Was `draft ? ... :
  // null`, which made canPublish permanently false on the new-draft form
  // regardless of this actor's authority.
  const hop = await nextHop(kind, draft ? draft.status : "Draft");
  const canAdvance = !!hop && (isRoot || held.has(`${kind.toLowerCase()}_${hop.verb}`));
  // Registry governance moved here (owner, 2026-08-19: "Add it back to
  // Authoring" — the Registry page is view-only now). Once a Draft leaves
  // the Draft state, `nextHop`'s own single-match .find() is no longer
  // sufficient — a Published/Active/Retired/Archived row can have MULTIPLE
  // valid next states (e.g. CR-080's Pack Validated -> Published AND
  // Validated -> Draft, a Reject edge), not just the one linear authoring
  // hop. Every possible next state is offered here (mirrors the removed
  // Registry dropdown exactly); the real authority check still happens
  // server-side in transitionPack/transitionTemplate/transitionProfile, same
  // as it always did.
  const possibleNextStates = draft && draft.status !== "Draft" && kind !== "TransitionDefinition" ? (await transitionDefinitionsDB.findPossibleNextStates(kind, draft.status)).data ?? [] : [];
  // CR-080 — Pack's own comment thread (Reject requires one every time; any
  // *_define/*_validate/*_publish/*_activate/*_retire/*_archive/*_reject
  // holder can also read it here to see why a Draft was sent back).
  req.vm.opt.packComments = draft && kind === "Pack" ? (await packsDB.getComments(draft.id)).data ?? [] : [];
  // CR-081 — every code this tenant already has a Pack row under, with its
  // Published-through-Archived versions+status (the branch picker) and the
  // version the next Draft under that code will actually get (computed,
  // sequence-based — see packCodeVersionSummaries' own header). Pre-embedded
  // for the SAME "browser never needs a round trip" reason category->code's
  // own driver data is (dynamicOntologyField.js swaps what it shows the
  // moment Code resolves to a match, or falls back to "1.0.0" for a
  // genuinely new code with no entry here at all). New-Pack-only (!draft) —
  // the branch-picker's own links navigate to THIS page with ?fromPackId=,
  // which only /sdk/:slug/new handles; rendering it on an existing Draft's
  // edit page would just be a dead link.
  req.vm.opt.packCodeVersions = kind === "Pack" && !draft ? await packCodeVersionSummaries(req.session?.user?.tenant_id ?? PLATFORM_TENANT_ID) : {};
  req.vm.req.title = draft ? `${kind} Definition — ${draft.status}` : `New ${kind}`;
  req.vm.req.kindLabel = kind;
  req.vm.req.slug = slug;
  req.vm.req.possibleNextStates = possibleNextStates;
  // CR-023: `purpose` (Template only; undefined/blank for Pack/Profile) rides
  // along on the draft summary so the view can show it as a subtitle under
  // the title, without pulling in the whole content object.
  req.vm.req.draft = draft ? { id: draft.id, code: draft.code, name: draft.name, status: draft.status, purpose: typeof draft.content.purpose === "string" ? draft.content.purpose : "" } : null;
  // UI redesign (owner: "extremely unfriendly") — group the flat field list
  // into the sections the page actually renders as separate cards, instead of
  // handing the view 23 interleaved fields with no structure.
  // Owner: "Version should be autogenerated using a next version button.
  // Editable text is not the correct approach." — packVersion/templateVersion
  // are never typed; a brand-new Template/Profile/Deliverable Draft starts at
  // 1.0.0 (harmless no-op for whichever of these a given kind's schema
  // doesn't declare), and from then on it's only advanced by the readonly
  // field's own "Next version" button (_generatedFieldGroups.ejs / edit.ejs's
  // patch-bump script, generic over kind "version" — CR-024).
  // CR-081 — Pack's OWN packVersion no longer defaults to "1.0.0" here (owner:
  // "Version should not be shown in the form by default that is wrong").
  // Since Code is now Ontology-driven-by-category with a real existing-code
  // branch picker (see packCodeVersions below), 1.0.0 is often simply wrong
  // before Code is even chosen — it's computed client-side instead
  // (dynamicOntologyField.js) the moment Code resolves to something, new or
  // existing. Left absent (not even an empty string) when there's no
  // draft/prefill content yet, so the version widget renders genuinely blank.
  const contentForForm = {
    templateVersion: "1.0.0", profileVersion: "1.0.0", definitionVersion: "1.0.0",
    ...(kind !== "Pack" ? { packVersion: "1.0.0" } : {}),
    ...(draft?.content ?? prefill?.content ?? {}),
  };
  req.vm.req.groups = groupFieldsForDisplay(generateFields(schema, contentForForm));
  req.vm.req.contentJson = JSON.stringify(draft?.content ?? {}, null, 2);
  req.vm.req.canEdit = canDefine && isDraft;
  req.vm.req.canPublish = canAdvance;
  req.vm.req.nextState = hop?.toState ?? null;
  req.vm.req.nextVerb = hop?.verb ?? null;
  // CR-026 Template Inheritance / Profile Inheritance (owner, 2026-08-19) —
  // the hidden field the main form submits alongside its schema fields
  // (parentTemplateId/parentProfileId aren't schema properties, so
  // parseFormBody would otherwise drop them) so createAuthoringDraft can lock
  // the new Draft's code and lineage to the chosen parent.
  req.vm.req.inheritingFromTemplateId = prefill?.parentTemplateId ?? null;
  req.vm.req.inheritingFromProfileId = prefill?.parentProfileId ?? null;
  req.vm.req.inheritingFromDeliverableDefinitionId = prefill?.parentDeliverableDefinitionId ?? null;
  const viewer = { isRoot, tenantId: req.session?.user?.tenant_id ?? null };
  req.vm.opt.referentialOptions = {
    ...(await loadReferentialOptions(viewer)),
    ...loadSelfReferentialOptions(schema, contentForForm),
    ...(await loadDerivedPackCapabilityOptions(contentForForm)),
  };
  req.vm.opt.producingCapabilityPacks = kind === "Template" ? await loadProducingCapabilityPacks(contentForForm) : {};
  // CR-026 Template Inheritance (Ch.6 §9, owner: "There is no change to the
  // way template is created by a platform user... When a tenant wants to
  // define a template, show a dropdown of codes"): only offered on a brand
  // new Template Draft, only to a real tenant author (never Platform, never
  // root — "no change" for Platform's own flow). Ch.7 §9 Profile Inheritance
  // (owner, 2026-08-19): same treatment, for Profile.
  req.vm.opt.inheritableTemplates = kind === "Template" && !draft && viewer.tenantId && viewer.tenantId !== PLATFORM_TENANT_ID
    ? await listInheritableTemplates(viewer.tenantId)
    : [];
  req.vm.opt.inheritableProfiles = kind === "Profile" && !draft && viewer.tenantId && viewer.tenantId !== PLATFORM_TENANT_ID
    ? await listInheritableProfiles(viewer.tenantId)
    : [];
  // Ch.15 §12 (CR-049) — same treatment, for Deliverable Definition. Unlike
  // Template/Profile, the inheritable list is Platform-owned only (the
  // canonical root to specialise from), not "Platform + own tenant".
  req.vm.opt.inheritableDeliverableDefinitions = kind === "Deliverable" && !draft && viewer.tenantId && viewer.tenantId !== PLATFORM_TENANT_ID
    ? await listInheritableDeliverableDefinitions()
    : [];
  // Owner: "Why is code not auto generated?" made every kind's Pack-code
  // pickers need real names now (§ above) — Template's mandatoryPackCodes and
  // Profile's optionalPackCodes use this too, not just Pack's own Dependencies
  // tab, so this is no longer conditional on kind === "Pack".
  req.vm.opt.packDependencyOptions = await loadActivePackDependencyOptions(viewer);
  req.vm.opt.templateOptions = kind === "Profile" ? await loadActiveTemplateOptions() : [];
  // CR-060, corrected same day — checklistIds' picker (Review Gate/Quality
  // Gate), only relevant to Pack authoring, scoped to this Pack's own
  // `code` (empty/unchosen yet on a brand new Draft — loadChecklistOptions
  // returns nothing until it's set, same as "nothing shares a code with an
  // unset code").
  req.vm.opt.checklistOptions = kind === "Pack" ? await loadChecklistOptions(String((contentForForm as Record<string, unknown>).code ?? "")) : [];
  // CR-061 — requiredPolicyCodes' picker (Quality Gate only), same scoping
  // and empty-until-code-is-chosen behaviour as checklistOptions above.
  req.vm.opt.policyOptions = kind === "Pack" ? await loadPolicyOptions(String((contentForForm as Record<string, unknown>).code ?? "")) : [];
  req.vm.opt.ontologyOptions = await loadOntologyOptions(schema, viewer);
  req.vm.opt.contributionHelp = CONTRIBUTION_SECTION_HELP;
  req.vm.opt.verifiableFieldHelp = VERIFIABLE_ITEM_FIELD_HELP;
  // CR-077 — passed through so _referentialListGroup.ejs's read-mode branches
  // can render a markdown-flagged field's saved value as safe HTML instead of
  // plain pre-wrap text.
  req.vm.opt.renderMarkdown = renderMarkdown;
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/sdk/authoring/edit", req.vm);
}

/** GET /aisworg/seu/sdk/:slug/new — the empty generated form for a new draft. */
router.get("/sdk/:slug/new", requireAuthoring("define"), attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind || kind === "TransitionDefinition") return next();
  try {
    // CR-026 Template Inheritance / Ch.7 §9 Profile Inheritance — "Inherit"
    // resubmits this same page with ?parentTemplateId=/?parentProfileId=, so
    // the form reloads pre-filled from the chosen parent's real content
    // before the author writes anything of their own.
    const parentTemplateId = kind === "Template" && typeof req.query.parentTemplateId === "string" ? req.query.parentTemplateId.trim() : "";
    const parentProfileId = kind === "Profile" && typeof req.query.parentProfileId === "string" ? req.query.parentProfileId.trim() : "";
    const parentDeliverableDefinitionId = kind === "Deliverable" && typeof req.query.parentDeliverableDefinitionId === "string" ? req.query.parentDeliverableDefinitionId.trim() : "";
    // CR-081 — Pack's own version of the same "Inherit" mechanism: the "New
    // Pack" form's existing-code branch picker reloads this page with
    // ?fromPackId= when the author clicks one of the offered Published-
    // through-Archived versions, pre-filling content the same real-render
    // way Template/Profile Inheritance already do (never a client-side
    // JSON-rehydration exercise).
    const fromPackId = kind === "Pack" && typeof req.query.fromPackId === "string" ? req.query.fromPackId.trim() : "";
    if (fromPackId) {
      // Bug fix (owner: "the form is not prefilled") — must resolve the SAME
      // way packCodeVersionSummaries did when it built the very links this
      // branch handles (below, in renderAuthoringForm): a root/Platform-type
      // viewer with no session tenant_id at all falls back to
      // PLATFORM_TENANT_ID there, so every id in the panel belongs to
      // PLATFORM_TENANT_ID — falling back to "" here instead made
      // inheritedPackVersionContent's strict tenant match ("PLATFORM_TENANT_ID"
      // !== "") fail every single time for exactly that (common, dev-testing)
      // case, silently bouncing to the index instead of pre-filling.
      const viewerTenantId = req.session?.user?.tenant_id ?? PLATFORM_TENANT_ID;
      const inherited = await inheritedPackVersionContent(fromPackId, viewerTenantId);
      if (!inherited.ok) return flashError(req, res, backToIndex(slug), inherited.error);
      return await renderAuthoringForm(req, res, kind, slug, null, { content: inherited.content });
    }
    if (parentTemplateId) {
      const viewerTenantId = req.session?.user?.tenant_id ?? "";
      const inherited = await inheritedTemplateContent(parentTemplateId, viewerTenantId);
      if (!inherited.ok) return flashError(req, res, backToIndex(slug), inherited.error);
      return await renderAuthoringForm(req, res, kind, slug, null, { content: inherited.content, parentTemplateId });
    }
    if (parentProfileId) {
      const viewerTenantId = req.session?.user?.tenant_id ?? "";
      const inherited = await inheritedProfileContent(parentProfileId, viewerTenantId);
      if (!inherited.ok) return flashError(req, res, backToIndex(slug), inherited.error);
      return await renderAuthoringForm(req, res, kind, slug, null, { content: inherited.content, parentProfileId });
    }
    if (parentDeliverableDefinitionId) {
      const inherited = await inheritedDeliverableDefinitionContent(parentDeliverableDefinitionId);
      if (!inherited.ok) return flashError(req, res, backToIndex(slug), inherited.error);
      return await renderAuthoringForm(req, res, kind, slug, null, { content: inherited.content, parentDeliverableDefinitionId });
    }
    return await renderAuthoringForm(req, res, kind, slug, null);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /sdk/:slug/new error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/:slug — create a Draft entity from the authored content (real author). */
router.post("/sdk/:slug", requireAuthoring("define"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  if (kind === "TransitionDefinition") {
    return flashError(req, res, backToIndex(slug), "Transition definitions are authored in the form on this page (noun × verb), not as drafts.");
  }
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, backToIndex(slug), "No actor identity on session.");
  try {
    const schema = await latestSchemaFor(kind);
    if (!schema) return flashError(req, res, backToIndex(slug), `No schema_definitions grammar for ${kind}.`);
    const content = parseFormBody(schema, req.body ?? {});
    // Pack/Template/Profile ownership (owner: "Packs will have ownership" /
    // CR-026 / 2026-08-19): a fresh Draft is owned by its real author's own
    // tenant — read straight off the session (CR-004 already puts it there).
    const tenantId = req.session?.user?.tenant_id ?? undefined;
    // CR-026 Template Inheritance / Ch.7 §9 Profile Inheritance:
    // parentTemplateId/parentProfileId aren't schema properties (parseFormBody
    // wouldn't carry them) — they travel as their own hidden field, set only
    // when the author reached this form via the "Inherit" control.
    const parentTemplateId = kind === "Template" && typeof req.body?.parentTemplateId === "string" && req.body.parentTemplateId.trim() ? req.body.parentTemplateId.trim() : undefined;
    const parentProfileId = kind === "Profile" && typeof req.body?.parentProfileId === "string" && req.body.parentProfileId.trim() ? req.body.parentProfileId.trim() : undefined;
    const parentDeliverableDefinitionId = kind === "Deliverable" && typeof req.body?.parentDeliverableDefinitionId === "string" && req.body.parentDeliverableDefinitionId.trim() ? req.body.parentDeliverableDefinitionId.trim() : undefined;
    const result = await createAuthoringDraft({ kind, actorId, tenantId, parentTemplateId, parentProfileId, parentDeliverableDefinitionId, content });
    if (!result.ok) return flashError(req, res, backToIndex(slug), result.errors.join("; "));
    return flashSuccess(req, res, backTo(slug, result.draftId), `Started a new ${kind} draft.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST /sdk/:slug error", err as Error);
    return flashError(req, res, backToIndex(slug), (err as Error).message);
  }
});

/** GET /aisworg/seu/sdk/:slug/:draftId — the generated form, prefilled from the Draft entity.
 * Deliberately NOT requireAuthoring-gated (bug fix, CR-046: a Registry "View"
 * link must work for anyone logged in, matching the Registry list pages
 * themselves — which carry no badge requirement at all — not just the
 * subset of viewers who happen to hold a define/publish/etc. badge for this
 * kind). renderAuthoringForm computes held/canDefine/canEdit/canPublish
 * independently of this route's own gate, so a badge-less viewer correctly
 * gets a genuine read-only page (CR-045's plain-text rendering), not a
 * disabled one; every mutating action (save/publish/transition/import)
 * keeps its own separate requireAuthoring gate below, unaffected. */
router.get("/sdk/:slug/:draftId", attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  try {
    const draft = await getAuthoringDraft(kind, String(req.params.draftId));
    if (!draft) return flashError(req, res, backToIndex(slug), "Draft not found.");
    return await renderAuthoringForm(req, res, kind, slug, draft);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /sdk/:slug/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/:slug/:draftId/save — update the Draft's authored content. */
router.post("/sdk/:slug/:draftId/save", requireAuthoring("define"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  try {
    const schema = await latestSchemaFor(kind);
    if (!schema) return flashError(req, res, backTo(slug, draftId), `No schema_definitions grammar for ${kind}.`);
    const content = parseFormBody(schema, req.body ?? {});
    const saved = await saveAuthoringDraft({ kind, id: draftId, content });
    if (!saved.ok) return flashError(req, res, backTo(slug, draftId), saved.errors.join("; "));
    // Validate the save against the schema, but don't block an incremental draft.
    const errors = validateAgainstSchema(schema, content);
    const msg = errors.length ? `Draft saved — ${errors.length} still to resolve before publish: ${errors.join("; ")}` : "Draft saved.";
    return flashSuccess(req, res, backTo(slug, draftId), msg);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../save error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/:slug/:draftId/compose — CR-067: pre-fill the Draft's
 * content from its own already-saved compositionStrategy/compositionSources.
 * Explicit action (not a side effect of Save) — see composeAuthoringDraft's
 * own comment for why. Only reachable for kinds whose schema actually
 * declares both fields (Pack today); composeAuthoringDraft itself returns a
 * clean "not yet available" error for every other kind, so no extra gating
 * is needed here. */
router.post("/sdk/:slug/:draftId/compose", requireAuthoring("define"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  try {
    const result = await composeAuthoringDraft({ kind, id: draftId });
    if (!result.ok) return flashError(req, res, backTo(slug, draftId), result.errors.join("; "));
    if (result.note) return flashSuccess(req, res, backTo(slug, draftId), result.note);
    const from = result.composedFrom.join(", ");
    const conflictNote = result.conflicts.length ? ` — ${result.conflicts.length} field(s) could not be automatically combined: ${result.conflicts.join(" ")}` : "";
    return flashSuccess(req, res, backTo(slug, draftId), `Composed from ${from}.${conflictNote}`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../compose error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/:slug/:draftId/import — replace the whole document with pasted JSON. */
router.post("/sdk/:slug/:draftId/import", requireAuthoring("define"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  const raw = req.body?.importedJson;
  if (typeof raw !== "string" || !raw.trim()) return flashError(req, res, backTo(slug, draftId), "Paste a JSON document to import.");
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const schema = await latestSchemaFor(kind);
    if (!schema) return flashError(req, res, backTo(slug, draftId), `No schema_definitions grammar for ${kind}.`);
    const errors = validateAgainstSchema(schema, parsed);
    if (errors.length) return flashError(req, res, backTo(slug, draftId), `Import rejected — invalid against the ${kind} schema: ${errors.join("; ")}`);
    const saved = await saveAuthoringDraft({ kind, id: draftId, content: parsed });
    if (!saved.ok) return flashError(req, res, backTo(slug, draftId), saved.errors.join("; "));
    return flashSuccess(req, res, backTo(slug, draftId), "Imported.");
  } catch (err) {
    return flashError(req, res, backTo(slug, draftId), `Invalid JSON: ${(err as Error).message}`);
  }
});

/** POST /aisworg/seu/sdk/:slug/:draftId/publish — advance ONE governed hop, run by the REAL actor under THAT hop's own verb. */
// Gate is deliberately "any" here, not "publish" — which specific `{kind}_*`
// badge is required depends on which hop this draft is about to take (Draft->
// Validated needs pack_validate, not pack_publish), and the real authorisation
// is enforced inside publishAuthoringDraft's own transitionEngine call
// regardless. The route only needs to confirm the actor has SOME authority on
// this kind before it's worth attempting.
router.post("/sdk/:slug/:draftId/publish", requireAuthoring("any"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, backTo(slug, draftId), "No actor identity on session.");
  try {
    const result = await publishAuthoringDraft({ kind, id: draftId, actorId, actorRole: req.session?.user?.role ?? "general" });
    if (!result.ok) return flashError(req, res, backTo(slug, draftId), result.errors.join("; "));
    // Reached the live catalog -> the registry. NOT "no further governed
    // transition at all" — Pack always has more of those (Active -> Deprecated
    // -> Retired -> Archived), but those are registry governance, not more
    // authoring. Any other state (e.g. Pack's Published, still short of
    // Active) is still mid-pipeline — stay on the draft so the next
    // verb-holder (maybe a different person) can take their own step.
    //
    // Owner: "When Validation is complete, it should go back to the All Packs
    // page" — Pack's own Draft -> Validated hop is the one exception to the
    // rule above: back to the list, same as reaching Active, not staying on
    // the draft. Scoped to Pack + Validated specifically, not generalised to
    // every kind's own first hop — Template/Profile/Deliverable's own
    // pipelines are unaffected.
    if (result.status === "Active" || (kind === "Pack" && result.status === "Validated")) {
      return flashSuccess(req, res, PUBLISH_REDIRECT_BY_KIND[kind], result.status === "Active" ? `${kind} reached Active — published and registered.` : `Advanced to ${result.status}.`);
    }
    return flashSuccess(req, res, backTo(slug, draftId), `Advanced to ${result.status}.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../publish error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/:slug/:draftId/transition — post-Active Registry governance
 *  (Active -> Deprecated -> Retired -> Archived, and reactivation), relocated
 *  from the now view-only Registry page (owner, 2026-08-19). Gate is "any" for
 *  the same reason /publish's is — the real authority for THIS specific target
 *  state is enforced inside transitionPack/transitionTemplate/transitionProfile's
 *  own transitionEngine call. */
router.post("/sdk/:slug/:draftId/transition", requireAuthoring("any"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  const { targetState, comment } = req.body ?? {};
  if (typeof targetState !== "string" || !targetState.trim()) {
    return flashError(req, res, backTo(slug, draftId), "Target state is required.");
  }
  const actorRole = req.session?.user?.role ?? "general";
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  try {
    if (kind === "Pack") {
      // CR-080 — comment is only actually required by transitionPack itself
      // for Validated -> Draft (Reject); harmless to pass through unused for
      // every other target state, same "real check happens server-side"
      // discipline the rest of this generic route already follows.
      const result = await transitionPack({ packId: draftId, targetState, actorRole, actorId, comment: typeof comment === "string" ? comment : undefined });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${"detail" in result ? result.detail : result.reason}`);
      return flashSuccess(req, res, backTo(slug, draftId), `Moved to "${result.appliedTransition.toState}".`);
    }
    if (kind === "Template") {
      const result = await transitionTemplate({ templateId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backTo(slug, draftId), `Moved to "${result.template.status}".`);
    }
    if (kind === "Profile") {
      const result = await transitionProfile({ profileId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backTo(slug, draftId), `Moved to "${result.profile.status}".`);
    }
    if (kind === "Deliverable") {
      const result = await transitionDeliverableDefinition({ deliverableDefinitionId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backTo(slug, draftId), `Moved to "${result.deliverableDefinition.status}".`);
    }
    return next();
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../transition error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

export { router };
