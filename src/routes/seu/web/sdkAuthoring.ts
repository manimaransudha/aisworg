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
  generateFields, parseFormBody, validateAgainstSchema, groupFieldsForDisplay,
  CONTRIBUTION_SECTION_HELP, VERIFIABLE_ITEM_FIELD_HELP, type JsonSchemaDocument,
} from "../../../domain/sdk/formGenerator.js";
import { packCategoriesDB } from "../../../dblayer/packCategoriesDB.js";
import {
  listAuthoringByVerb, listAuthoringQueue, getAuthoringDraft, createAuthoringDraft, saveAuthoringDraft, publishAuthoringDraft,
  type AuthoringDraftSummary,
} from "../core/sdkAuthoring.js";
import { listCurrentTransitionDefinitions, getTransitionDefinitionDetail, addTransitionDefinition, retireTransitionDefinition } from "../core/transitionDefinitions.js";
import {
  listAuthorityNouns, listAuthorityVerbs, listAuthorityMapping,
  listActiveNouns, listActiveVerbs, activeMappingByNoun,
  addNoun, addVerb, addMapping, retireNoun, retireVerb, retireMapping,
} from "../core/authorityVocabulary.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import type { SchemaDefinitionEntityKind } from "../../../dblayer/seuTypes.js";

const KIND_BY_SLUG: Record<string, SchemaDefinitionEntityKind> = {
  "pack-authoring": "Pack",
  "template-authoring": "Template",
  "profile-authoring": "Profile",
  "transition-definition-authoring": "TransitionDefinition",
};
const PUBLISH_REDIRECT_BY_KIND: Record<SchemaDefinitionEntityKind, string> = {
  Pack: "/aisworg/seu/packs",
  Template: "/aisworg/seu/sdk/template-authoring",
  Profile: "/aisworg/seu/sdk/profile-authoring",
  TransitionDefinition: "/aisworg/seu/sdk/transition-definition-authoring",
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

// Owner: "it should show in separate tabs: Active packs, User defined packs,
// User reviewed packs etc. based on howmanyever verbs are there." One tab per
// verb the entity's noun ACTUALLY has — derived from its own governed
// transitions (data-driven: Pack has 7 verbs, Template/Profile have 2 — never
// hardcoded per kind), each tab held only if the actor holds that badge:
//   - the verb landing on Active is the live catalog ("Active Packs" —
//     everyone with ANY Pack authority sees it, not just whoever holds the
//     one specific verb landing there) — scoped by Pack ownership, not actor:
//     Platform Packs plus this viewer's own tenant's (root sees every
//     tenant's, owner: "platform packs + tenant packs corresponding to the
//     tenant the user belongs to").
//   - every other verb is scoped to what THIS actor did — resolved from the
//     real actor + badge Part 1 now captures on every governed-transition
//     event ("User reviewed Packs" = Packs I ran `pack_validate` on and are
//     still sitting in Validated, not just "Packs that got validated").
const VERB_PAST_TENSE: Record<string, string> = { define: "defined", validate: "reviewed", publish: "published", deprecate: "deprecated", retire: "retired", archive: "archived" };
function verbPastTense(verb: string): string {
  return VERB_PAST_TENSE[verb] ?? `${verb}d`;
}

async function buildAuthoringTabs(kind: SchemaDefinitionEntityKind, held: Set<string>, isRoot: boolean, myId: number | null, viewerTenantId: string | null): Promise<Array<{ key: string; label: string; verb: string; rows: AuthoringDraftSummary[] }>> {
  const allTds = await listCurrentTransitionDefinitions();
  const byFromState = new Map<string, Array<{ toState: string; verb: string }>>();
  for (const d of allTds) {
    if (d.entityType !== kind || !d.isActive || !d.verb) continue;
    if (!byFromState.has(d.fromState)) byFromState.set(d.fromState, []);
    byFromState.get(d.fromState)!.push({ toState: d.toState, verb: d.verb });
  }
  // Walk forward from Draft (the birth state), always taking the first edge to
  // a not-yet-visited state — this naturally follows the entity's real
  // lifecycle order and skips reactivation edges (e.g. Deprecated -> Active),
  // since Active is already visited by the time those are reached. fromState
  // is `current` at each step — carried along so a Queue tab (below) can ask
  // "what's sitting in the state THIS verb consumes."
  const verbOrder: Array<{ verb: string; toState: string; fromState: string }> = [{ verb: "define", toState: "Draft", fromState: "" }];
  const visited = new Set(["Draft"]);
  let current = "Draft";
  for (;;) {
    const next = (byFromState.get(current) ?? []).find((e) => !visited.has(e.toState));
    if (!next) break;
    verbOrder.push({ verb: next.verb, toState: next.toState, fromState: current });
    visited.add(next.toState);
    current = next.toState;
  }

  const viewer = viewerTenantId ? { isRoot, tenantId: viewerTenantId } : null;
  const tabs: Array<{ key: string; label: string; verb: string; rows: AuthoringDraftSummary[] }> = [];
  for (const { verb, toState, fromState } of verbOrder) {
    const badge = `${kind.toLowerCase()}_${verb}`;
    const isLiveCatalog = toState === "Active";
    // Bug fix (owner: "Active packs tab have to be shown for all pack_*
    // badges"): the comment above already said the live-catalog tab is
    // "global, unscoped... everyone with any Pack authority should see the
    // whole live set, not just their own" — but the gate below it still only
    // checked the ONE specific badge that happens to land on Active (e.g.
    // pack_activate), so a pack_define/pack_validate/pack_deprecate/…-only
    // holder never saw it at all. Every other (non-live-catalog) tab is
    // unaffected — those stay gated on their own specific verb, same as ever.
    const canSeeTab = isRoot || (isLiveCatalog ? [...held].some((b) => b.startsWith(`${kind.toLowerCase()}_`)) : held.has(badge));
    if (!canSeeTab) continue;

    // Owner: "add a tab to show what is the queue applicable to the badge
    // you hold... a tab to show queue that needs validation." Every OTHER
    // tab here answers "what did I already do" (listAuthoringByVerb, below);
    // this answers "what's waiting for my verb" — rows sitting in fromState,
    // full stop, not scoped to prior action (there isn't any yet). No queue
    // for `define` — Draft is birth, nothing upstream to wait in.
    //
    // Bug fix (caught in smoke-testing, not the owner's report): a Queue tab
    // is separation-of-duties work THIS verb's holder specifically can act
    // on — it must NEVER inherit isLiveCatalog's broadened "any {kind}_*
    // badge" check above (that broadening is only correct for the live
    // catalog itself, "Active Packs"). A pack_define-only holder was
    // otherwise getting an "Activate Packs" queue tab it has no authority to
    // act on, just because canSeeTab was true for the unrelated live-catalog
    // reason.
    const canActThisVerb = isRoot || held.has(badge);
    if (verb !== "define" && canActThisVerb) {
      const queueRows = await listAuthoringQueue(kind, fromState, viewer);
      const verbLabel = verb.charAt(0).toUpperCase() + verb.slice(1);
      tabs.push({ key: `${verb}-queue`, label: `${verbLabel} ${kind}s`, verb: badge, rows: queueRows });
    }

    const rows = await listAuthoringByVerb(kind, verb, toState, isLiveCatalog ? null : (isRoot ? null : myId), viewer);
    const label = isLiveCatalog ? `Active ${kind}s` : `${isRoot ? "All" : "User"} ${verbPastTense(verb)} ${kind}s`;
    tabs.push({ key: verb, label, verb: badge, rows });
  }
  return tabs;
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
      const viewerTenantId = req.session?.user?.tenant_id ?? null;
      req.vm.req.tabs = await buildAuthoringTabs(kind, held, isRoot, myId, viewerTenantId);
      req.vm.req.canCreate = isRoot || held.has(authoringBadge(kind, "define"));
    } else {
      req.vm.req.tabs = [];
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
  const { nounCode, verbCode } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await addMapping(String(nounCode ?? ""), String(verbCode ?? "")), `Mapping ${nounCode} → ${verbCode} added.`);
});
router.post("/authority/mapping/retire", requireAuthorityAdmin, async (req: Request, res: Response) => {
  const { nounCode, verbCode } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await retireMapping(String(nounCode ?? ""), String(verbCode ?? "")), `Mapping ${nounCode} → ${verbCode} retired.`);
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
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/transition-definitions/:id error", err as Error);
    next(err);
  }
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
async function loadReferentialOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, string[]>> {
  const [{ data: packs }, { data: templates }, { data: categories }] = await Promise.all([
    viewer.isRoot || !viewer.tenantId ? packsDB.findAll() : packsDB.findAllVisibleTo(viewer.tenantId),
    templatesDB.findAllActive(),
    packCategoriesDB.findActive(),
  ]);
  const activePacks = (packs ?? []).filter((p) => p.status === "Active");
  return {
    "pack-code": [...new Set(activePacks.map((p) => p.code))].sort(),
    "template-code": [...new Set((templates ?? []).map((t) => t.code))].sort(),
    // CR-015 — Pack category options come from the pack_category table (data).
    "pack-category": (categories ?? []).map((c) => c.code),
  };
}

// Owner: "Pack code should include the pack and the version number in the
// dropdown. Version should not be a text field... There should also have a
// dropdown on the category." — the Dependencies tab's Pack picker needs more
// than the flat code list above: the version to show/auto-fill alongside each
// code, and the category to filter by. One row per Active Pack visible to
// this viewer (at most one per code, same invariant as above).
export interface PackDependencyOption { code: string; version: string; category: string }
async function loadActivePackDependencyOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<PackDependencyOption[]> {
  const { data: packs } = viewer.isRoot || !viewer.tenantId ? await packsDB.findAll() : await packsDB.findAllVisibleTo(viewer.tenantId);
  return (packs ?? [])
    .filter((p) => p.status === "Active")
    .map((p) => ({ code: p.code, version: p.pack_version, category: p.category }))
    .sort((a, b) => a.code.localeCompare(b.code));
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
async function renderAuthoringForm(req: Request, res: Response, kind: SchemaDefinitionEntityKind, slug: string, draft: { id: string; code: string; name: string; status: string; content: Record<string, unknown> } | null): Promise<void> {
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
  req.vm.req.title = draft ? `${kind} Definition — ${draft.status}` : `New ${kind}`;
  req.vm.req.kindLabel = kind;
  req.vm.req.slug = slug;
  req.vm.req.draft = draft ? { id: draft.id, code: draft.code, name: draft.name, status: draft.status } : null;
  // UI redesign (owner: "extremely unfriendly") — group the flat field list
  // into the sections the page actually renders as separate cards, instead of
  // handing the view 23 interleaved fields with no structure.
  // Owner: "Version should be autogenerated using a next version button.
  // Editable text is not the correct approach." — packVersion is never typed;
  // a brand-new draft starts at 1.0.0 (harmless no-op for Template/Profile,
  // whose schemas have no packVersion property at all), and from then on it's
  // only advanced by the readonly field's "Next version" button
  // (_generatedFieldGroups.ejs / edit.ejs's patch-bump script).
  const contentForForm = { packVersion: "1.0.0", ...(draft?.content ?? {}) };
  req.vm.req.groups = groupFieldsForDisplay(generateFields(schema, contentForForm));
  req.vm.req.contentJson = JSON.stringify(draft?.content ?? {}, null, 2);
  req.vm.req.canEdit = canDefine && isDraft;
  req.vm.req.canPublish = canAdvance;
  req.vm.req.nextState = hop?.toState ?? null;
  req.vm.req.nextVerb = hop?.verb ?? null;
  const viewer = { isRoot, tenantId: req.session?.user?.tenant_id ?? null };
  req.vm.opt.referentialOptions = await loadReferentialOptions(viewer);
  req.vm.opt.packDependencyOptions = kind === "Pack" ? await loadActivePackDependencyOptions(viewer) : [];
  req.vm.opt.contributionHelp = CONTRIBUTION_SECTION_HELP;
  req.vm.opt.verifiableFieldHelp = VERIFIABLE_ITEM_FIELD_HELP;
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/sdk/authoring/edit", req.vm);
}

/** GET /aisworg/seu/sdk/:slug/new — the empty generated form for a new draft. */
router.get("/sdk/:slug/new", requireAuthoring("define"), attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind || kind === "TransitionDefinition") return next();
  try {
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
    // Pack ownership (owner: "Packs will have ownership"): a fresh Pack Draft
    // is owned by its real author's own tenant — read straight off the
    // session (CR-004 already puts it there; ignored for Template/Profile).
    const tenantId = req.session?.user?.tenant_id ?? undefined;
    const result = await createAuthoringDraft({ kind, actorId, tenantId, content });
    if (!result.ok) return flashError(req, res, backToIndex(slug), result.errors.join("; "));
    return flashSuccess(req, res, backTo(slug, result.draftId), `Started a new ${kind} draft.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST /sdk/:slug error", err as Error);
    return flashError(req, res, backToIndex(slug), (err as Error).message);
  }
});

/** GET /aisworg/seu/sdk/:slug/:draftId — the generated form, prefilled from the Draft entity. */
router.get("/sdk/:slug/:draftId", requireAuthoring("any"), attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
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
    // authoring. Any other state (e.g. Pack's Draft -> Validated) is still
    // mid-pipeline — stay on the draft so the next verb-holder (maybe a
    // different person) can take their own step.
    if (result.status === "Active") return flashSuccess(req, res, PUBLISH_REDIRECT_BY_KIND[kind], `${kind} reached Active — published and registered.`);
    return flashSuccess(req, res, backTo(slug, draftId), `Advanced to ${result.status}.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../publish error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

export { router };
