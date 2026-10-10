import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { logger } from "../../../utils/logger.js";
import { requireBadge } from "../../../middleware/requireBadge.js";
import { requireTenantScope } from "../../../middleware/requireTenantScope.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { deliverableDefinitionsDB } from "../../../dblayer/deliverableDefinitionsDB.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import {
  generateFields, parseFormBody, validateAgainstSchema, groupFieldsForDisplay, ontologyConceptTypesIn, dynamicReferentialSourceFieldsIn, dynamicReferentialSourceItemFieldsIn,
  CONTRIBUTION_SECTION_HELP, VERIFIABLE_ITEM_FIELD_HELP, type JsonSchemaDocument,
} from "../../../domain/sdk/formGenerator.js";
import { renderMarkdown } from "../../../domain/sdk/markdownRender.js";
import { listConceptsForType, resolveLabels } from "../core/ontology.js";
import {
  listTenantAuthoringRows, computeRowActions, requiredBadgeForRowAction, getAuthoringDraft, createAuthoringDraft, saveAuthoringDraft, publishAuthoringDraft, composeAuthoringDraft,
  listInheritableTemplates, inheritedTemplateContent, listInheritableProfiles, inheritedProfileContent, inheritedPackVersionContent,
  type AuthoringDraftSummary,
} from "../core/sdkAuthoring.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { policiesDB } from "../../../dblayer/policiesDB.js";
import { checklistsDB } from "../../../dblayer/checklistsDB.js";
import { transitionPack, packCodeVersionSummaries } from "../core/packs.js";
import { transitionTemplate, PACK_SELECTION_SLOTS, deriveCapabilityCodesFromPackCodes, deriveCapabilityProducingPacksFromPackCodes, deriveExposableParameterCandidates, deriveOverridableParameterCandidates, getPackSelectionsByCategory, type ExposableParameterCandidate, type ExposedParameter, type PackSelectionsByCategory } from "../core/templates.js";
import { transitionProfile, CONFIGURATION_PARAMETER_FIELDS, type ExposedParameterOverride } from "../core/profiles.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { resolveHeldBadges, resolveAuthorBadge } from "../../../domain/identity/heldBadges.js";
import { lookupRouteAuthority } from "../../../domain/identity/routeAuthorityCache.js";
import { transitionDeliverableDefinition, listInheritableDeliverableDefinitions, inheritedDeliverableDefinitionContent } from "../core/deliverableDefinitions.js";
import { transitionServiceDefinition, listInheritableServiceDefinitions, inheritedServiceDefinitionContent } from "../core/serviceDefinitions.js";
import { transitionPolicyDefinition } from "../core/policyDefinitions.js";
import { transitionCapabilityDefinition } from "../core/capabilityDefinitions.js";
import { listCurrentTransitionDefinitions, getTransitionDefinitionDetail, addTransitionDefinition, retireTransitionDefinition, updateTransitionDefinition } from "../core/transitionDefinitions.js";
import {
  listAuthorityNouns, listAuthorityVerbs, listAuthorityMapping,
  listActiveNouns, listActiveVerbs, activeMappingByNoun,
  addNoun, addVerb, addMapping, retireNoun, retireVerb, retireMapping, updateMappingTrigger,
} from "../core/authorityVocabulary.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import type { SchemaDefinitionEntityKind, ServiceLevelExpectation, TemplateDependencyGraphEntry } from "../../../dblayer/seuTypes.js";
import { getPlatformTenantId } from "../../../dblayer/constants.js";
 
const KIND_BY_SLUG: Record<string, SchemaDefinitionEntityKind> = {
  "pack-authoring": "Pack",
  "template-authoring": "Template",
  "profile-authoring": "Profile",
  "transition-definition-authoring": "TransitionDefinition",
  "deliverable-authoring": "Deliverable",
  "service-authoring": "Service",
  "policy-authoring": "Policy",
  "capability-authoring": "Capability",
};

function resolveKind(slug: string): SchemaDefinitionEntityKind | null {
  return KIND_BY_SLUG[slug] ?? null;
}

const backToIndex = (slug: string) => `/aisworg/seu/sdk/${slug}`;
const backTo = (slug: string, deliverableId: string) => `${backToIndex(slug)}/${deliverableId}`;

function authoringBadge(kind: SchemaDefinitionEntityKind, level: "define" | "publish"): string {
  return `${kind.toLowerCase()}_${level}`;
}

async function heldBadges(req: Request): Promise<Set<string>> {
  const set = new Set<string>(req.session?.user?.platformBadges ?? []);
  const userId = req.session?.user?.id;
  if (userId != null) {
    const { badgeTypes } = await badgeAuthorityEngine.getHeldBadges(String(userId));
    for (const b of badgeTypes) set.add(b);
  }
  if (set.has("platform_manage")) set.add("root");
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

function requireDefineBadge() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slug = String(req.params.slug);
    const kind = resolveKind(slug);
    if (!kind) return next();
    return requireBadge([authoringBadge(kind, "define")], { mode: "web", redirectTo: backToIndex(slug) })(req, res, next);
  };
}

function requireRowActionBadge(action: { endpoint: "publish" } | { endpoint: "transition"; targetStateField: "targetState" }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slug = String(req.params.slug);
    const kind = resolveKind(slug);
    if (!kind) return next();
    const draftId = String(req.params.draftId);
    const draft = await getAuthoringDraft(kind, draftId);
    if (!draft) return flashError(req, res, backToIndex(slug), "Draft not found.");
    const target = action.endpoint === "publish"
      ? ({ endpoint: "publish" } as const)
      : (() => {
          const raw = req.body?.[action.targetStateField];
          const targetState = typeof raw === "string" ? raw.trim() : "";
          return targetState ? ({ endpoint: "transition", toState: targetState } as const) : null;
        })();
    if (!target) return flashError(req, res, backTo(slug, draftId), "Target state is required.");
    const badges = await requiredBadgeForRowAction(kind, draft.status, target);
    if (!badges) return flashError(req, res, backTo(slug, draftId), `No governed ${action.endpoint} is available from ${draft.status}.`);
    return requireBadge(badges, { mode: "web", redirectTo: backTo(slug, draftId), match: "any" })(req, res, next);
  };
}

function requireDraftTenantScope() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slug = String(req.params.slug);
    const kind = resolveKind(slug);
    if (!kind) return next();
    const PLATFORM_TENANT_ID = await getPlatformTenantId();
    const opts = { mode: "web" as const, notFoundRedirect: backToIndex(slug), notFoundMessage: "Not found.", platformTenantId: PLATFORM_TENANT_ID };
    const gate =
      kind === "Pack" ? requireTenantScope.forParam("draftId", packsDB.findById, (p) => p.tenant_id, opts) :
      kind === "Template" ? requireTenantScope.forParam("draftId", templatesDB.findById, (t) => t.tenant_id, opts) :
      kind === "Profile" ? requireTenantScope.forParam("draftId", profilesDB.findById, (p) => p.tenant_id, opts) :
      kind === "Deliverable" ? requireTenantScope.forParam("draftId", deliverableDefinitionsDB.findById, (d) => d.tenant_id, opts) :
      kind === "Service" ? requireTenantScope.forParam("draftId", serviceDefinitionsDB.findById, (s) => s.tenant_id, opts) :
      kind === "Policy" ? requireTenantScope.forParam("draftId", policyDefinitionsDB.findById, (p) => p.tenant_id, opts) :
      kind === "Capability" ? requireTenantScope.forParam("draftId", capabilityDefinitionsDB.findById, (c) => c.tenant_id, opts) :
      null;
    if (!gate) return next();
    return gate(req, res, next, String(req.params.draftId));
  };
}

async function tenantAuthoringRowsWithActions(kind: SchemaDefinitionEntityKind, held: Set<string>, isRoot: boolean, tenantId: string | null): Promise<Array<AuthoringDraftSummary & { actions: Awaited<ReturnType<typeof computeRowActions>> }>> {
  const rows = await listTenantAuthoringRows(kind, { isRoot, tenantId });
  const actionsByStatus = new Map<string, Awaited<ReturnType<typeof computeRowActions>>>();
  for (const status of new Set(rows.map((r) => r.status))) {
    actionsByStatus.set(status, await computeRowActions(kind, status, held, isRoot));
  }
  return rows.map((r) => ({ ...r, actions: actionsByStatus.get(r.status) ?? [] }));
}

router.get("/sdk/:slug", requireAuthoring("any"), attachVM("seu/sdk/authoring/index"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  try {
    const held = await heldBadges(req);
    const isRoot = held.has("root");
    const tenantId = req.session?.user?.tenant_id ?? null;
    const grammarAuthored = kind !== "TransitionDefinition";
    req.vm.req.title = `${kind} Authoring`;
    req.vm.req.kindLabel = kind;
    req.vm.req.slug = slug;
    req.vm.req.showDrafts = grammarAuthored;

    if (grammarAuthored) {
      req.vm.req.rows = await tenantAuthoringRowsWithActions(kind, held, isRoot, tenantId);
      req.vm.req.canCreate = isRoot || held.has(authoringBadge(kind, "define"));
    } else {
      req.vm.req.rows = [];
      req.vm.req.canCreate = false;
    }

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

async function canWriteAuthority(req: Request): Promise<boolean> {
  const held = await heldBadges(req);
  return held.has("root") || held.has("transitiondefinition_define");
}

router.get("/authority/nouns", attachVM("seu/sdk/authority/index"), async (req: Request, res: Response, next: NextFunction) => {
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

router.get("/authority/verbs", attachVM("seu/sdk/authority/index"), async (req: Request, res: Response, next: NextFunction) => {
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

router.get("/authority/mapping", attachVM("seu/sdk/authority/index"), async (req: Request, res: Response, next: NextFunction) => {
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

const AUTH_NOUNS = "/aisworg/seu/authority/nouns";
const AUTH_VERBS = "/aisworg/seu/authority/verbs";
const AUTH_MAPPING = "/aisworg/seu/authority/mapping";
const TD_INDEX = "/aisworg/seu/sdk/transition-definition-authoring";
const wrote = (req: Request, res: Response, back: string, r: { ok: true } | { ok: false; error: string }, okMsg: string) =>
  r.ok ? flashSuccess(req, res, back, okMsg) : flashError(req, res, back, r.error);

async function resolveAuthorityVocabAuthor(req: Request): Promise<{ authorId: string; authorBadge: string } | { error: string }> {
  if (req.session?.user?.id == null) {
    return { error: "No logged-in user on this session." };
  }
  const userId = String(req.session.user.id) ;
  
  const { data: master } = await participantsMasterDB.findById(userId);
  if (!master) return { error: `No superuser provisioned.` };
  const authRow = lookupRouteAuthority(req.method, req.baseUrl + req.path);
  const held = await resolveHeldBadges(req);
  const authorBadge = resolveAuthorBadge(authRow, held);
  if (!authorBadge) return { error: "No held badge authorises this action -- cannot record an author badge." };
  return { authorId: master.id, authorBadge };
}

router.post("/authority/nouns/add", async (req: Request, res: Response) => {
  const { code, label, description } = req.body ?? {};
  const author = await resolveAuthorityVocabAuthor(req);
  if ("error" in author) return flashError(req, res, AUTH_NOUNS, author.error);
  wrote(req, res, AUTH_NOUNS, await addNoun(String(code ?? ""), String(label ?? ""), description ? String(description) : null, author.authorId, author.authorBadge), `Noun "${code}" added.`);
});
router.post("/authority/nouns/retire", async (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  wrote(req, res, AUTH_NOUNS, await retireNoun(String(code ?? "")), `Noun "${code}" retired.`);
});

router.post("/authority/verbs/add", async (req: Request, res: Response) => {
  const { code, label, description } = req.body ?? {};
  const author = await resolveAuthorityVocabAuthor(req);
  if ("error" in author) return flashError(req, res, AUTH_VERBS, author.error);
  wrote(req, res, AUTH_VERBS, await addVerb(String(code ?? ""), String(label ?? ""), description ? String(description) : null, author.authorId, author.authorBadge), `Verb "${code}" added.`);
});
router.post("/authority/verbs/retire", async (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  wrote(req, res, AUTH_VERBS, await retireVerb(String(code ?? "")), `Verb "${code}" retired.`);
});

router.post("/authority/mapping/add", async (req: Request, res: Response) => {
  const { nounCode, verbCode, trigger } = req.body ?? {};
  const author = await resolveAuthorityVocabAuthor(req);
  if ("error" in author) return flashError(req, res, AUTH_MAPPING, author.error);
  wrote(req, res, AUTH_MAPPING, await addMapping(String(nounCode ?? ""), String(verbCode ?? ""), trigger ? String(trigger) : undefined, author.authorId, author.authorBadge), `Mapping ${nounCode} → ${verbCode} added.`);
});
router.post("/authority/mapping/retire", async (req: Request, res: Response) => {
  const { nounCode, verbCode } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await retireMapping(String(nounCode ?? ""), String(verbCode ?? "")), `Mapping ${nounCode} → ${verbCode} retired.`);
});
router.post("/authority/mapping/edit-trigger", async (req: Request, res: Response) => {
  const { nounCode, verbCode, trigger } = req.body ?? {};
  wrote(req, res, AUTH_MAPPING, await updateMappingTrigger(String(nounCode ?? ""), String(verbCode ?? ""), String(trigger ?? "")), `${nounCode} + ${verbCode} trigger set to "${trigger}".`);
});

router.post("/authority/transition-definitions/add", async (req: Request, res: Response) => {
  const { entityType, fromState, toState, verb } = req.body ?? {};
  const author = await resolveAuthorityVocabAuthor(req);
  if ("error" in author) return flashError(req, res, TD_INDEX, author.error);
  wrote(req, res, TD_INDEX, await addTransitionDefinition({ entityType: String(entityType ?? ""), fromState: String(fromState ?? ""), toState: String(toState ?? ""), verb: String(verb ?? ""), authorId: author.authorId, authorBadge: author.authorBadge }), `Transition ${entityType} ${fromState} → ${toState} added.`);
});
router.post("/authority/transition-definitions/retire", async (req: Request, res: Response) => {
  const { id } = req.body ?? {};
  wrote(req, res, TD_INDEX, await retireTransitionDefinition(String(id ?? "")), "Transition definition retired.");
});

router.get("/authority/transition-definitions/:id", attachVM("seu/sdk/authority/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getTransitionDefinitionDetail(String(req.params.id));
    if (!detail) return next();
    req.vm.req.title = `Transition — ${detail.entityType} ${detail.fromState} → ${detail.toState}`;
    req.vm.req.detail = detail;
    req.vm.opt.canWriteAuthority = await canWriteAuthority(req);
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authority/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /authority/transition-definitions/:id error", err as Error);
    next(err);
  }
});

router.get("/authority/transition-definitions/:id/edit", attachVM("seu/sdk/authority/edit"), async (req: Request, res: Response, next: NextFunction) => {
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
router.post("/authority/transition-definitions/:id/update", async (req: Request, res: Response) => {
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

async function loadReferentialOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, string[]>> {
  const [{ data: packs }, { data: templates }, featureFlags, deliverableNames, deliverableCategories, evidenceCategories, policyCategories, obligationCategories, obligationOrigins, serviceNames, capabilityNames, engineeringCapitalTypes, complianceNames, roleNames, worktypeNames, { data: transitionDefinitions }] = await Promise.all([
    viewer.isRoot || !viewer.tenantId ? packsDB.findAll() : packsDB.findAllVisibleTo(viewer.tenantId),
    templatesDB.findAllActive(),
    listConceptsForType("feature-flag", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("deliverable-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:deliverable", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:evidence", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:policy", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:obligation", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("category:obligation-origin", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("service-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("capability-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("engineering-capital", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("compliance-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("role-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    listConceptsForType("worktype-name", { isRoot: viewer.isRoot, tenantId: viewer.tenantId }, false),
    transitionDefinitionsDB.listAll(),
  ]);
  const activePacks = (packs ?? []).filter((p) => p.status === "Active");
  return {
    "pack-code": [...new Set(activePacks.map((p) => p.code))].sort(),
    "template-code": [...new Set((templates ?? []).map((t) => t.code))].sort(),
    "feature-flag": [...new Set(featureFlags.map((c) => c.code))].sort(),
    "deliverable-name": [...new Set(deliverableNames.map((c) => c.default_label))].sort(),
    "category:deliverable": [...new Set(deliverableCategories.map((c) => c.default_label))].sort(),
    "category:evidence": [...new Set(evidenceCategories.map((c) => c.code))].sort(),
    "category:policy": [...new Set(policyCategories.map((c) => c.code))].sort(),
    "category:obligation": [...new Set(obligationCategories.map((c) => c.code))].sort(),
    "category:obligation-origin": [...new Set(obligationOrigins.map((c) => c.code))].sort(),
    "service-name": [...new Set(serviceNames.map((c) => c.code))].sort(),
    "capability-name": [...new Set(capabilityNames.map((c) => c.code))].sort(),
    "engineering-capital": [...new Set(engineeringCapitalTypes.map((c) => c.code))].sort(),
    "compliance-name": [...new Set(complianceNames.map((c) => c.code))].sort(),
    "role-name": [...new Set(roleNames.map((c) => c.code))].sort(),
    "worktype-name": [...new Set(worktypeNames.map((c) => c.code))].sort(),
    "transition-definition": [...new Set((transitionDefinitions ?? []).filter((t) => t.is_active).map((t) => `${t.entity_type}|${t.from_state}|${t.to_state}`))].sort(),
    "noun": (await listActiveNouns()).map((n) => n.code).sort(),
    "authority-badge": Object.entries(await activeMappingByNoun())
      .flatMap(([noun, verbs]) => verbs.map((verb) => `${noun}_${verb}`))
      .sort(),
  };
}

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

async function loadProducingCapabilityPacks(content: Record<string, unknown>): Promise<Record<string, unknown>> {
  const packCodes = [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => extractPackCodes(content[slot.field as string])))];
  return deriveCapabilityProducingPacksFromPackCodes(packCodes);
}

function extractDeliverableCatalogueCodes(content: Record<string, unknown>): string[] {
  const catalogue = Array.isArray(content.deliverableCatalogue) ? content.deliverableCatalogue : [];
  const codes = new Set<string>();
  for (const row of catalogue) {
    const entry = row as Record<string, unknown> | null;
    const code = entry?.code;
    if (typeof code === "string" && code.trim() !== "") codes.add(code);
  }
  return [...codes];
}

interface CapabilityNameEntry { code: string; label: string }
interface PackCodesCapabilityCoverage {
  required: CapabilityNameEntry[];
  gaps: CapabilityNameEntry[];
  excess: CapabilityNameEntry[];
}
async function loadPackCodesCapabilityCoverage(content: Record<string, unknown>, viewerTenantId: string | null): Promise<PackCodesCapabilityCoverage> {
  const deliverableCodes = extractDeliverableCatalogueCodes(content);
  const { data: serviceDefinitions } = await serviceDefinitionsDB.findAllVisibleTo(viewerTenantId ?? (await getPlatformTenantId()));
  const requiredSet = new Set<string>();
  for (const def of serviceDefinitions ?? []) {
    if (def.status !== "Active") continue;
    const outputs = (def.outputs as unknown as string[] | null) ?? [];
    if (outputs.some((code) => deliverableCodes.includes(code))) requiredSet.add(def.capability_code);
  }
  const requiredCodes = [...requiredSet].sort();

  const packCodes = [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => extractPackCodes(content[slot.field as string])))];
  const selectedCodes = await deriveCapabilityCodesFromPackCodes(packCodes);
  const selectedSet = new Set(selectedCodes);

  const labels = await resolveLabels(viewerTenantId, "capability-name");
  const toEntry = (code: string): CapabilityNameEntry => ({ code, label: labels[code] || code });
  return {
    required: requiredCodes.map(toEntry),
    gaps: requiredCodes.filter((code) => !selectedSet.has(code)).map(toEntry),
    excess: selectedCodes.filter((code) => !requiredSet.has(code)).map(toEntry),
  };
}

export interface ExposableParameterRow extends ExposableParameterCandidate {
  value: string;
  overridable: boolean;
}

async function loadExposableParameterRows(content: Record<string, unknown>, viewerTenantId: string | null): Promise<ExposableParameterRow[]> {
  const packCodes = [...new Set(PACK_SELECTION_SLOTS.flatMap((slot) => extractPackCodes(content[slot.field as string])))];
  const dependencyGraph = Array.isArray(content.dependencyGraph) ? (content.dependencyGraph as TemplateDependencyGraphEntry[]) : [];
  const candidates = await deriveExposableParameterCandidates(packCodes, viewerTenantId ?? (await getPlatformTenantId()), dependencyGraph);
  const existing = Array.isArray(content.exposedParameters) ? (content.exposedParameters as ExposedParameter[]) : [];
  const existingByKey = new Map(existing.map((e) => [`${e.sourceType}::${e.sourceCode}::${e.parameterName}`, e]));
  return candidates.map((c) => {
    const saved = existingByKey.get(`${c.sourceType}::${c.sourceCode}::${c.parameterName}`);
    return { ...c, value: saved?.value ?? c.defaultValue ?? "", overridable: saved ? saved.overridable : true };
  });
}

interface ProfileParameterOverrideRow extends ExposableParameterCandidate {
  value: string;
}

async function loadProfileParameterOverrideRows(content: Record<string, unknown>, viewerTenantId: string | null): Promise<ProfileParameterOverrideRow[]> {
  const baseTemplateCode = typeof content.baseTemplateCode === "string" ? content.baseTemplateCode.trim() : "";
  if (!baseTemplateCode) return [];
  const candidates = await deriveOverridableParameterCandidates(baseTemplateCode, viewerTenantId ?? (await getPlatformTenantId()));
  const existing = Array.isArray(content.exposedParameterOverrides) ? (content.exposedParameterOverrides as ExposedParameterOverride[]) : [];
  const existingByKey = new Map(existing.map((e) => [`${e.sourceType}::${e.sourceCode}::${e.parameterName}`, e]));
  return candidates.map((c) => {
    const saved = existingByKey.get(`${c.sourceType}::${c.sourceCode}::${c.parameterName}`);
    return { ...c, value: saved?.value ?? "" };
  });
}

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

function loadSelfReferentialOptions(schema: JsonSchemaDocument, content: Record<string, unknown>): Record<string, string[]> {
  const options: Record<string, string[]> = {};
  for (const fieldName of selfReferentialFieldNamesIn(schema)) {
    const rows = Array.isArray(content[fieldName]) ? (content[fieldName] as Array<Record<string, unknown>>) : [];
    const identityKey = schema.properties?.[fieldName]?.items?.properties?.code ? "code" : "name";
    options[`self:${fieldName}`] = [...new Set(rows.map((r) => (typeof r[identityKey] === "string" ? (r[identityKey] as string) : "")).filter(Boolean))];
  }
  return options;
}

async function loadOntologyOptions(schema: JsonSchemaDocument, viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, Array<{ code: string; label: string; description: string | null }>>> {
  const conceptTypes = ontologyConceptTypesIn(schema);
  const entries = await Promise.all(conceptTypes.map(async (conceptType) => {
    const concepts = await listConceptsForType(conceptType, viewer, false);
    return [conceptType, concepts.map((c) => ({ code: c.code, label: c.default_label, description: c.description })).sort((a, b) => a.label.localeCompare(b.label))] as const;
  }));
  const result: Record<string, Array<{ code: string; label: string; description: string | null }>> = Object.fromEntries(entries);

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

  for (const { driverConceptType, suffix } of dynamicReferentialSourceItemFieldsIn(schema)) {
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

export interface PackDependencyOption { id: string; code: string; name: string; version: string; category: string }
async function loadActivePackDependencyOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<PackDependencyOption[]> {
  const { data: packs } = viewer.isRoot || !viewer.tenantId ? await packsDB.findAll() : await packsDB.findAllVisibleTo(viewer.tenantId);
  return (packs ?? [])
    .filter((p) => p.status === "Active")
    .map((p) => ({ id: p.id, code: p.code, name: p.name, version: p.pack_version, category: p.category }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ServiceDefinitionOption { code: string; name: string; capabilityCode: string; purpose: string; serviceLevel: ServiceLevelExpectation[] }
async function loadServiceDefinitionOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<ServiceDefinitionOption[]> {
  const { data: definitions } = viewer.isRoot || !viewer.tenantId ? await serviceDefinitionsDB.findAll() : await serviceDefinitionsDB.findAllVisibleTo(viewer.tenantId);
  return (definitions ?? [])
    .filter((d) => d.status === "Active")
    .map((d) => ({ code: d.code, name: d.name, capabilityCode: d.capability_code, purpose: d.purpose ?? "", serviceLevel: d.service_level }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PolicyDefinitionOption { code: string; name: string; description: string; applicabilityDeliverableNames: string[] }
async function loadPolicyDefinitionOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<PolicyDefinitionOption[]> {
  const { data: definitions } = viewer.isRoot || !viewer.tenantId ? await policyDefinitionsDB.findAll() : await policyDefinitionsDB.findAllVisibleTo(viewer.tenantId);
  return (definitions ?? [])
    .filter((d) => d.status === "Active")
    .map((d) => ({ code: d.code, name: d.name, description: d.description ?? "", applicabilityDeliverableNames: [...new Set(d.conditions.flatMap((c) => c.applicabilityDeliverables.map((r) => r.name)))] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadCapabilityDeliverableNames(viewer: { isRoot: boolean; tenantId: string | null }): Promise<Record<string, string[]>> {
  const { data: definitions } = viewer.isRoot || !viewer.tenantId ? await serviceDefinitionsDB.findAll() : await serviceDefinitionsDB.findAllVisibleTo(viewer.tenantId);
  const byCapability: Record<string, Set<string>> = {};
  for (const def of definitions ?? []) {
    if (def.status !== "Active") continue;
    const outputs = (def.outputs as unknown as string[] | null) ?? [];
    if (!byCapability[def.capability_code]) byCapability[def.capability_code] = new Set();
    for (const code of outputs) byCapability[def.capability_code].add(code);
  }
  return Object.fromEntries(Object.entries(byCapability).map(([k, v]) => [k, [...v]]));
}

export interface ChecklistOption { id: string; name: string; packName: string }
async function loadChecklistOptions(packCode: string): Promise<ChecklistOption[]> {
  if (!packCode.trim()) return [];
  const { data: checklists } = await checklistsDB.findByPackCode(packCode);
  return (checklists ?? []).map((c) => ({ id: c.id, name: c.name, packName: c.pack_name })).sort((a, b) => a.packName.localeCompare(b.packName) || a.name.localeCompare(b.name));
}

export interface PolicyOption { id: string; name: string; packName: string }
async function loadPolicyOptions(packCode: string): Promise<PolicyOption[]> {
  if (!packCode.trim()) return [];
  const { data: policies } = await policiesDB.findByPackCode(packCode);
  return (policies ?? []).map((p) => ({ id: p.id, name: p.name, packName: p.pack_name })).sort((a, b) => a.packName.localeCompare(b.packName) || a.name.localeCompare(b.name));
}

export interface TemplateOption { code: string; name: string }
async function loadActiveTemplateOptions(): Promise<TemplateOption[]> {
  const { data: templates } = await templatesDB.findAllActive();
  return (templates ?? []).map((t) => ({ code: t.code, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
}

async function latestSchemaFor(kind: SchemaDefinitionEntityKind): Promise<JsonSchemaDocument | null> {
  const { data: schemaDef } = await schemaDefinitionsDB.findLatest(kind);
  return (schemaDef?.schema as JsonSchemaDocument) ?? null;
}

async function loadDbSelectOptions(kind: SchemaDefinitionEntityKind): Promise<Record<string, Array<{ value: string; label: string }>>> {
  const { data: versions } = await schemaDefinitionsDB.findAllVersions(kind);
  return {
    "schema-version": (versions ?? []).map((v) => ({ value: v.id, label: `v${v.version}` })),
  };
}

async function resolvedSchemaFor(kind: SchemaDefinitionEntityKind, pinnedSchemaDefinitionId?: string): Promise<{ schema: JsonSchemaDocument; schemaDefinitionId: string } | null> {
  if (pinnedSchemaDefinitionId) {
    const { data: schemaDef } = await schemaDefinitionsDB.findById(pinnedSchemaDefinitionId);
    if (schemaDef) return { schema: schemaDef.schema as JsonSchemaDocument, schemaDefinitionId: schemaDef.id };
  }
  const { data: schemaDef } = await schemaDefinitionsDB.findLatest(kind);
  return schemaDef ? { schema: schemaDef.schema as JsonSchemaDocument, schemaDefinitionId: schemaDef.id } : null;
}

async function nextHop(kind: SchemaDefinitionEntityKind, fromState: string): Promise<{ verb: string; toState: string } | null> {
  const defs = await listCurrentTransitionDefinitions();
  const match = defs.find((d) => d.entityType === kind && d.isActive && d.fromState === fromState && d.verb);
  return match ? { verb: match.verb!, toState: match.toState } : null;
}

async function renderAuthoringForm(req: Request, res: Response, kind: SchemaDefinitionEntityKind, slug: string, draft: { id: string; code: string; name: string; status: string; content: Record<string, unknown> } | null, prefill?: { content: Record<string, unknown>; parentTemplateId?: string; parentProfileId?: string; parentDeliverableDefinitionId?: string }): Promise<void> {
  const pinnedSchemaDefinitionId = typeof draft?.content?.schemaVersion === "string" ? draft.content.schemaVersion : undefined;
  const resolved = await resolvedSchemaFor(kind, pinnedSchemaDefinitionId);
  const schema = resolved?.schema ?? null;
  if (!schema) return flashError(req, res, backToIndex(slug), `No schema_definitions grammar for ${kind}.`);
  const held = await heldBadges(req);
  const isRoot = held.has("root");
  const canDefine = isRoot || held.has(authoringBadge(kind, "define"));
  const isDraft = !draft || draft.status === "Draft";
  const hop = await nextHop(kind, draft ? draft.status : "Draft");
  const advanceBadges = hop ? await requiredBadgeForRowAction(kind, draft ? draft.status : "Draft", { endpoint: "publish" }) : null;
  const canAdvance = !!hop && (isRoot || (advanceBadges ?? []).some((b) => held.has(b)));
  const possibleNextStates = draft && draft.status !== "Draft" && kind !== "TransitionDefinition" ? (await transitionDefinitionsDB.findPossibleNextStates(kind, draft.status)).data ?? [] : [];
  req.vm.opt.packComments = draft && kind === "Pack" ? (await packsDB.getComments(draft.id)).data ?? [] : [];
  req.vm.opt.packCodeVersions = kind === "Pack" && !draft ? await packCodeVersionSummaries(req.session?.user?.tenant_id ?? (await getPlatformTenantId())) : {};
  req.vm.req.title = draft ? `${kind} Definition — ${draft.status}` : `New ${kind}`;
  req.vm.req.kindLabel = kind;
  req.vm.req.slug = slug;
  req.vm.req.possibleNextStates = possibleNextStates;
  req.vm.req.draft = draft ? { id: draft.id, code: draft.code, name: draft.name, status: draft.status, purpose: typeof draft.content.purpose === "string" ? draft.content.purpose : "" } : null;
  const contentForForm = {
    templateVersion: "1.0.0", profileVersion: "1.0.0", definitionVersion: "1.0.0",
    ...(kind !== "Pack" ? { packVersion: "1.0.0" } : {}),
    ...(draft?.content ?? prefill?.content ?? {}),
  };
  const viewer = { isRoot, tenantId: req.session?.user?.tenant_id ?? null };
  const generatedFields = generateFields(schema, contentForForm);
  if (kind === "Profile") {
    for (const cp of CONFIGURATION_PARAMETER_FIELDS) {
      const field = generatedFields.find((f) => f.name === (cp.field as string));
      if (!field) continue;
      const { data: parameterConcept } = await ontologyDB.findConcept("profile-configuration", cp.parameterCode, viewer);
      field.required = parameterConcept?.is_mandatory === true;
    }
  }
  req.vm.req.groups = groupFieldsForDisplay(schema, generatedFields);
  req.vm.req.contentJson = JSON.stringify(draft?.content ?? {}, null, 2);
  req.vm.req.canEdit = canDefine && isDraft;
  req.vm.req.canPublish = canAdvance;
  req.vm.req.nextState = hop?.toState ?? null;
  req.vm.req.nextVerb = hop?.verb ?? null;
  req.vm.req.inheritingFromTemplateId = prefill?.parentTemplateId ?? null;
  req.vm.req.inheritingFromProfileId = prefill?.parentProfileId ?? null;
  req.vm.req.inheritingFromDeliverableDefinitionId = prefill?.parentDeliverableDefinitionId ?? null;
  req.vm.opt.referentialOptions = {
    ...(await loadReferentialOptions(viewer)),
    ...loadSelfReferentialOptions(schema, contentForForm),
    ...(await loadDerivedPackCapabilityOptions(contentForForm)),
  };
  req.vm.opt.dbSelectOptions = await loadDbSelectOptions(kind);
  req.vm.opt.producingCapabilityPacks = kind === "Template" ? await loadProducingCapabilityPacks(contentForForm) : {};
  req.vm.opt.deliverableLabels = kind === "Template" ? await resolveLabels(viewer.tenantId, "deliverable-name") : {};
  const packCodesCapabilityCoverage: PackCodesCapabilityCoverage =
    kind === "Template" ? await loadPackCodesCapabilityCoverage(contentForForm, viewer.tenantId) : { required: [], gaps: [], excess: [] };
  req.vm.opt.requiredCapabilityNames = packCodesCapabilityCoverage.required;
  req.vm.opt.capabilityCoverageGaps = packCodesCapabilityCoverage.gaps;
  req.vm.opt.capabilityCoverageExcess = packCodesCapabilityCoverage.excess;
  req.vm.opt.exposableParameterRows = kind === "Template" ? await loadExposableParameterRows(contentForForm, viewer.tenantId) : [];
  req.vm.opt.exposedParameterOverrideRows = kind === "Profile" ? await loadProfileParameterOverrideRows(contentForForm, viewer.tenantId) : [];
  const PLATFORM_TENANT_ID = await getPlatformTenantId();
  req.vm.opt.inheritableTemplates = kind === "Template" && !draft && viewer.tenantId && viewer.tenantId !== PLATFORM_TENANT_ID
    ? await listInheritableTemplates(viewer.tenantId)
    : [];
  req.vm.opt.inheritableProfiles = kind === "Profile" && !draft && viewer.tenantId && viewer.tenantId !== PLATFORM_TENANT_ID
    ? await listInheritableProfiles(viewer.tenantId)
    : [];
  req.vm.opt.inheritableDeliverableDefinitions = kind === "Deliverable" && !draft && viewer.tenantId && viewer.tenantId !== PLATFORM_TENANT_ID
    ? await listInheritableDeliverableDefinitions()
    : [];
  req.vm.opt.packDependencyOptions = await loadActivePackDependencyOptions(viewer);
  req.vm.opt.templateOptions = kind === "Profile" ? await loadActiveTemplateOptions() : [];
  req.vm.opt.checklistOptions = kind === "Pack" ? await loadChecklistOptions(String((contentForForm as Record<string, unknown>).code ?? "")) : [];
  req.vm.opt.policyOptions = kind === "Pack" ? await loadPolicyOptions(String((contentForForm as Record<string, unknown>).code ?? "")) : [];
  req.vm.opt.serviceDefinitionOptions = kind === "Pack" ? await loadServiceDefinitionOptions(viewer) : [];
  req.vm.opt.policyDefinitionOptions = kind === "Pack" ? await loadPolicyDefinitionOptions(viewer) : [];
  req.vm.opt.capabilityDeliverableNames = kind === "Pack" ? await loadCapabilityDeliverableNames(viewer) : {};
  const ontologyOptions = await loadOntologyOptions(schema, viewer);
  if (kind === "Profile") {
    const baseTemplateCode = (contentForForm as Record<string, unknown>).baseTemplateCode;
    const baseTemplate = typeof baseTemplateCode === "string" && baseTemplateCode.trim() ? (await templatesDB.findByCode(baseTemplateCode)).data : null;
    if (baseTemplate) {
      const templatePackSelections: PackSelectionsByCategory = await getPackSelectionsByCategory(baseTemplate.id);
      const templatePackCodes = Object.values(templatePackSelections).flatMap((codes) => codes ?? []);
      const templateCapabilityCodes = new Set(await deriveCapabilityCodesFromPackCodes(templatePackCodes));
      ontologyOptions["capability-name"] = (ontologyOptions["capability-name"] || []).filter((opt) => !templateCapabilityCodes.has(opt.code));
    }
  }
  req.vm.opt.ontologyOptions = ontologyOptions;
  req.vm.opt.contributionHelp = CONTRIBUTION_SECTION_HELP;
  req.vm.opt.verifiableFieldHelp = VERIFIABLE_ITEM_FIELD_HELP;
  req.vm.opt.renderMarkdown = renderMarkdown;
  req.vm.opt.flash = getFlash(req);
  return renderView(req, res, "seu/sdk/authoring/edit", req.vm);
}

router.get("/sdk/:slug/new", requireDefineBadge(), attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind || kind === "TransitionDefinition") return next();
  try {
    const parentTemplateId = kind === "Template" && typeof req.query.parentTemplateId === "string" ? req.query.parentTemplateId.trim() : "";
    const parentProfileId = kind === "Profile" && typeof req.query.parentProfileId === "string" ? req.query.parentProfileId.trim() : "";
    const parentDeliverableDefinitionId = kind === "Deliverable" && typeof req.query.parentDeliverableDefinitionId === "string" ? req.query.parentDeliverableDefinitionId.trim() : "";
    const fromPackId = kind === "Pack" && typeof req.query.fromPackId === "string" ? req.query.fromPackId.trim() : "";
    if (fromPackId) {
      const viewerTenantId = req.session?.user?.tenant_id ?? (await getPlatformTenantId());
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

function reconstructExposedParameters(body: Record<string, unknown>): void {
  const rows = body.exposedParamRows;
  if (!rows || typeof rows !== "object") return;
  const rowList = Array.isArray(rows) ? rows : Object.values(rows as Record<string, unknown>);
  const exposedParameters: ExposedParameter[] = rowList
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      sourceType: r.sourceType as ExposedParameter["sourceType"],
      sourceCode: String(r.sourceCode ?? ""),
      parameterName: String(r.parameterName ?? ""),
      value: typeof r.value === "string" && r.value.trim() ? r.value : undefined,
      overridable: r.overridable === "true" || r.overridable === true,
    }))
    .filter((r) => r.sourceCode && r.parameterName);
  body.exposedParameters = JSON.stringify(exposedParameters);
}

function reconstructProfileParameterOverrides(body: Record<string, unknown>): void {
  const rows = body.exposedParamOverrideRows;
  if (!rows || typeof rows !== "object") return;
  const rowList = Array.isArray(rows) ? rows : Object.values(rows as Record<string, unknown>);
  const overrides: ExposedParameterOverride[] = rowList
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      sourceType: r.sourceType as ExposedParameterOverride["sourceType"],
      sourceCode: String(r.sourceCode ?? ""),
      parameterName: String(r.parameterName ?? ""),
      value: typeof r.value === "string" ? r.value.trim() : "",
    }))
    .filter((r) => r.sourceCode && r.parameterName && r.value);
  body.exposedParameterOverrides = JSON.stringify(overrides);
}

router.post("/sdk/:slug", requireDefineBadge(), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  if (kind === "TransitionDefinition") {
    return flashError(req, res, backToIndex(slug), "Transition definitions are authored in the form on this page (noun × verb), not as drafts.");
  }
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, backToIndex(slug), "No actor identity on session.");
  try {
    const pinnedSchemaDefinitionId = typeof req.body?.schemaVersion === "string" && req.body.schemaVersion.trim() ? req.body.schemaVersion.trim() : undefined;
    const resolved = await resolvedSchemaFor(kind, pinnedSchemaDefinitionId);
    if (!resolved) return flashError(req, res, backToIndex(slug), `No schema_definitions grammar for ${kind}.`);
    const schema = resolved.schema;
    if (kind === "Template") reconstructExposedParameters(req.body ?? {});
    if (kind === "Profile") reconstructProfileParameterOverrides(req.body ?? {});
    const content = parseFormBody(schema, req.body ?? {});
    const tenantId = req.session?.user?.tenant_id ?? undefined;
    const parentTemplateId = kind === "Template" && typeof req.body?.parentTemplateId === "string" && req.body.parentTemplateId.trim() ? req.body.parentTemplateId.trim() : undefined;
    const parentProfileId = kind === "Profile" && typeof req.body?.parentProfileId === "string" && req.body.parentProfileId.trim() ? req.body.parentProfileId.trim() : undefined;
    const parentDeliverableDefinitionId = kind === "Deliverable" && typeof req.body?.parentDeliverableDefinitionId === "string" && req.body.parentDeliverableDefinitionId.trim() ? req.body.parentDeliverableDefinitionId.trim() : undefined;
    const held = await heldBadges(req);
    const authorBadge = held.has("root") ? "root" : authoringBadge(kind, "define");
    const result = await createAuthoringDraft({ kind, actorId, authorBadge, tenantId, parentTemplateId, parentProfileId, parentDeliverableDefinitionId, content, schemaDefinitionId: resolved.schemaDefinitionId });
    if (!result.ok) return flashError(req, res, backToIndex(slug), result.errors.join("; "));
    return flashSuccess(req, res, backTo(slug, result.draftId), `Started a new ${kind} draft.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST /sdk/:slug error", err as Error);
    return flashError(req, res, backToIndex(slug), (err as Error).message);
  }
});

router.get("/sdk/:slug/:draftId", requireDraftTenantScope(), attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
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

router.post("/sdk/:slug/:draftId/save", requireDraftTenantScope(), requireDefineBadge(), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  try {
    const draft = await getAuthoringDraft(kind, draftId);
    const pinnedSchemaDefinitionId = typeof draft?.content?.schemaVersion === "string" ? draft.content.schemaVersion : undefined;
    const resolved = await resolvedSchemaFor(kind, pinnedSchemaDefinitionId);
    const schema = resolved?.schema ?? null;
    if (!schema) return flashError(req, res, backTo(slug, draftId), `No schema_definitions grammar for ${kind}.`);
    if (kind === "Template") reconstructExposedParameters(req.body ?? {});
    if (kind === "Profile") reconstructProfileParameterOverrides(req.body ?? {});
    const content = parseFormBody(schema, req.body ?? {});
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const saved = await saveAuthoringDraft({ kind, id: draftId, content, actorId });
    if (!saved.ok) return flashError(req, res, backTo(slug, draftId), saved.errors.join("; "));
    const errors = validateAgainstSchema(schema, content);
    const msg = errors.length ? `Draft saved — ${errors.length} still to resolve before publish: ${errors.join("; ")}` : "Draft saved.";
    return flashSuccess(req, res, backTo(slug, draftId), msg);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../save error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

router.post("/sdk/:slug/:draftId/compose", requireDraftTenantScope(), requireDefineBadge(), async (req: Request, res: Response, next: NextFunction) => {
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

router.post("/sdk/:slug/:draftId/import", requireDraftTenantScope(), requireDefineBadge(), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  const raw = req.body?.importedJson;
  if (typeof raw !== "string" || !raw.trim()) return flashError(req, res, backTo(slug, draftId), "Paste a JSON document to import.");
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const draft = await getAuthoringDraft(kind, draftId);
    const pinnedSchemaDefinitionId = typeof draft?.content?.schemaVersion === "string" ? draft.content.schemaVersion : undefined;
    const resolved = await resolvedSchemaFor(kind, pinnedSchemaDefinitionId);
    const schema = resolved?.schema ?? null;
    if (!schema) return flashError(req, res, backTo(slug, draftId), `No schema_definitions grammar for ${kind}.`);
    const errors = validateAgainstSchema(schema, parsed);
    if (errors.length) return flashError(req, res, backTo(slug, draftId), `Import rejected — invalid against the ${kind} schema: ${errors.join("; ")}`);
    const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
    const saved = await saveAuthoringDraft({ kind, id: draftId, content: parsed, actorId });
    if (!saved.ok) return flashError(req, res, backTo(slug, draftId), saved.errors.join("; "));
    return flashSuccess(req, res, backTo(slug, draftId), "Imported.");
  } catch (err) {
    return flashError(req, res, backTo(slug, draftId), `Invalid JSON: ${(err as Error).message}`);
  }
});

router.post("/sdk/:slug/:draftId/publish", requireDraftTenantScope(), requireRowActionBadge({ endpoint: "publish" }), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, backTo(slug, draftId), "No actor identity on session.");
  try {
    const result = await publishAuthoringDraft({ kind, id: draftId, actorId, actorRole: req.session?.user?.role ?? "general" });
    if (!result.ok) return flashError(req, res, backTo(slug, draftId), result.errors.join("; "));
    const msg = result.status === "Active" ? `${kind} reached Active — published and registered.` : `Advanced to ${result.status}.`;
    return flashSuccess(req, res, backToIndex(slug), msg);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../publish error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

router.post("/sdk/:slug/:draftId/transition", requireDraftTenantScope(), requireRowActionBadge({ endpoint: "transition", targetStateField: "targetState" }), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const draftId = String(req.params.draftId);
  const { targetState, comment } = req.body ?? {};
  const actorRole = req.session?.user?.role ?? "general";
  if (req.session?.user?.id == null) {
    return flashError(req, res, backTo, "You must be logged in to create an Objective.");
  }
  const actorId = String(req.session.user.id);
  try {
    if (kind === "Pack") {
      const result = await transitionPack({ packId: draftId, targetState, actorRole, actorId, comment: typeof comment === "string" ? comment : undefined });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${"detail" in result ? result.detail : result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.appliedTransition.toState}".`);
    }
    if (kind === "Template") {
      const result = await transitionTemplate({ templateId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.template.status}".`);
    }
    if (kind === "Profile") {
      const result = await transitionProfile({ profileId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.profile.status}".`);
    }
    if (kind === "Deliverable") {
      const result = await transitionDeliverableDefinition({ deliverableDefinitionId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.deliverableDefinition.status}".`);
    }
    if (kind === "Service") {
      const result = await transitionServiceDefinition({ serviceDefinitionId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.serviceDefinition.status}".`);
    }
    if (kind === "Policy") {
      const result = await transitionPolicyDefinition({ policyDefinitionId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.policyDefinition.status}".`);
    }
    if (kind === "Capability") {
      const result = await transitionCapabilityDefinition({ capabilityDefinitionId: draftId, targetState: targetState as never, actorRole, actorId });
      if (!result.ok) return flashError(req, res, backTo(slug, draftId), `Transition blocked: ${result.detail ?? result.reason}`);
      return flashSuccess(req, res, backToIndex(slug), `Moved to "${result.capabilityDefinition.status}".`);
    }
    return next();
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../transition error", err as Error);
    return flashError(req, res, backTo(slug, draftId), (err as Error).message);
  }
});

export { router };
