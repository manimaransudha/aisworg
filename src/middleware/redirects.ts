import type { Request, Response } from "express";
import { flashError, flashSuccess } from "../utils/flash.js";

// The only module that calls flashError / flashSuccess. A destination is declared once per page, keyed by
// the longest request-path prefix that matches the request. Patterns use ":name" for path parameters, which
// are filled from the request path. The optional `path` argument overrides the destination of a single call.

const HOME = "/aisworg";
const LOGIN = "/aisworg/login";

type Params = Record<string, string>;

interface PageSpec {
  prefix: string;
  error: string;
  success?: string;
  deny?: string;
  badgefail?: string;
  tenantfail?: string;
}

export interface PageRedirects {
  readonly prefix: string;
  error(req: Request, res: Response, msg: string, path?: string): void;
  success(req: Request, res: Response, msg: string, path?: string): void;
  authfail(req: Request, res: Response, msg: string): void;
  rolefail(req: Request, res: Response, msg: string): void;
  badgefail(req: Request, res: Response, msg: string): void;
  tenantfail(req: Request, res: Response, msg: string): void;
}

const segments = (p: string): string[] => p.split("/").filter(Boolean);
const requestPath = (req: Request): string => req.originalUrl.split("?")[0] ?? "";

function prefixParams(prefix: string, path: string): Params {
  const pre = segments(prefix);
  const got = segments(path);
  const params: Params = {};
  pre.forEach((seg, i) => {
    if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(got[i] ?? "");
  });
  return params;
}

function fill(pattern: string, params: Params): string {
  return pattern.replace(/:(\w+)/g, (_m, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`redirects: pattern "${pattern}" needs parameter "${name}", which the page prefix does not carry.`);
    return encodeURIComponent(value);
  });
}

const registry: PageRedirects[] = [];

function page(spec: PageSpec): PageRedirects {
  const success = spec.success ?? spec.error;
  const deny = spec.deny ?? HOME;
  const go = (flash: typeof flashError, req: Request, res: Response, msg: string, pattern: string, path?: string): void => {
    flash(req, res, path ?? fill(pattern, prefixParams(spec.prefix, requestPath(req))), msg);
  };
  const entry: PageRedirects = {
    prefix: spec.prefix,
    error: (req, res, msg, path) => go(flashError, req, res, msg, spec.error, path),
    success: (req, res, msg, path) => go(flashSuccess, req, res, msg, success, path),
    authfail: (req, res, msg) => go(flashError, req, res, msg, LOGIN),
    rolefail: (req, res, msg) => go(flashError, req, res, msg, deny),
    badgefail: (req, res, msg) => go(flashError, req, res, msg, spec.badgefail ?? deny),
    tenantfail: (req, res, msg) => go(flashError, req, res, msg, spec.tenantfail ?? deny),
  };
  registry.push(entry);
  return entry;
}

// The page for a request: the registered prefix with the most segments, literal segments breaking a tie.
export function redirectsFor(req: Request): PageRedirects {
  const got = segments(requestPath(req));
  let best: PageRedirects | null = null;
  let bestKey: [number, number] = [-1, -1];
  for (const entry of registry) {
    const pre = segments(entry.prefix);
    if (pre.length > got.length) continue;
    if (!pre.every((seg, i) => seg.startsWith(":") || seg === got[i])) continue;
    const key: [number, number] = [pre.length, pre.filter((seg) => !seg.startsWith(":")).length];
    if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      best = entry;
      bestKey = key;
    }
  }
  if (!best) throw new Error(`redirects: no page is registered for ${requestPath(req)}.`);
  return best;
}

export const redirects = {
  auth: {
    forgotPassword: page({ prefix: "/aisworg/auth/forgot-password", error: "/aisworg/auth/forgot-password" }),
    login: page({ prefix: "/aisworg/auth/login", error: "/aisworg/login" }),
    resetPassword: page({ prefix: "/aisworg/auth/reset-password", error: "/aisworg/login" }),
    users: page({ prefix: "/aisworg/auth/users", error: "/aisworg/auth/users" }),
    verify: page({ prefix: "/aisworg/auth/verify", error: "/aisworg/login" }),
  },
  home: {
    index: page({ prefix: "/aisworg", error: "/aisworg" }),
    quickview: page({ prefix: "/aisworg/quickview", error: "/aisworg/quickview" }),
  },
  seu: {
    attentionTransition: page({ prefix: "/aisworg/seu/attention/:id/transition", error: "/aisworg/seu/attention" }),
    authorityMapping: page({ prefix: "/aisworg/seu/authority/mapping", error: "/aisworg/seu/authority/mapping" }),
    authorityNouns: page({ prefix: "/aisworg/seu/authority/nouns", error: "/aisworg/seu/authority/nouns" }),
    authorityTransitionDefinitions: page({ prefix: "/aisworg/seu/authority/transition-definitions", error: "/aisworg/seu/sdk/transition-definition-authoring" }),
    authorityTransitionDefinitionsUpdate: page({ prefix: "/aisworg/seu/authority/transition-definitions/:id/update", error: "/aisworg/seu/authority/transition-definitions/:id" }),
    authorityVerbs: page({ prefix: "/aisworg/seu/authority/verbs", error: "/aisworg/seu/authority/verbs" }),
    capabilityDefinitionsCopy: page({ prefix: "/aisworg/seu/capability-definitions/:id/copy", error: "/aisworg/seu/capability-definitions" }),
    dataMigrationsRun: page({ prefix: "/aisworg/seu/data-migrations/run", error: "/aisworg/seu/data-migrations" }),
    deliverableDefinitionsCopy: page({ prefix: "/aisworg/seu/deliverable-definitions/:id/copy", error: "/aisworg/seu/deliverable-definitions" }),
    demo: page({ prefix: "/aisworg/seu/demo", error: "/aisworg/seu/demo", tenantfail: "/aisworg/seu" }),
    demoRootScenariosEnabled: page({ prefix: "/aisworg/seu/demo/root/scenarios/:code/enabled", error: "/aisworg/seu/demo/root", tenantfail: "/aisworg/seu" }),
    devActAs: page({ prefix: "/aisworg/seu/dev/act-as", error: "/aisworg" }),
    identityBadgesUpdate: page({ prefix: "/aisworg/seu/identity/badges/:id/update", error: "/aisworg/seu/identity/badges" }),
    identityTenants: page({ prefix: "/aisworg/seu/identity/tenants", error: "/aisworg/seu/identity/tenants" }),
    identityUsers: page({ prefix: "/aisworg/seu/identity/users", error: "/aisworg/seu/identity/users" }),
    objectives: page({ prefix: "/aisworg/seu/objectives", error: "/aisworg/seu/objectives", tenantfail: "/aisworg/seu/objectives" }),
    objectivesById: page({ prefix: "/aisworg/seu/objectives/:id", error: "/aisworg/seu/objectives", tenantfail: "/aisworg/seu/objectives" }),
    objectivesComments: page({ prefix: "/aisworg/seu/objectives/:id/comments", error: "/aisworg/seu/objectives/:id/edit", tenantfail: "/aisworg/seu/objectives" }),
    objectivesCommission: page({ prefix: "/aisworg/seu/objectives/:id/commission", error: "/aisworg/seu/seus/new?objectiveId=:id", tenantfail: "/aisworg/seu/objectives" }),
    objectivesComposeEbm: page({ prefix: "/aisworg/seu/objectives/:id/compose-ebm", error: "/aisworg/seu/objectives/:id/compose-ebm", tenantfail: "/aisworg/seu/objectives" }),
    objectivesDelete: page({ prefix: "/aisworg/seu/objectives/:id/delete", error: "/aisworg/seu/objectives/:id", tenantfail: "/aisworg/seu/objectives" }),
    objectivesEdit: page({ prefix: "/aisworg/seu/objectives/:id/edit", error: "/aisworg/seu/objectives", tenantfail: "/aisworg/seu/objectives" }),
    objectivesMove: page({ prefix: "/aisworg/seu/objectives/:id/move", error: "/aisworg/seu/objectives/:id", tenantfail: "/aisworg/seu/objectives" }),
    objectivesNew: page({ prefix: "/aisworg/seu/objectives/new", error: "/aisworg/seu/objectives", tenantfail: "/aisworg/seu/objectives" }),
    objectivesRetire: page({ prefix: "/aisworg/seu/objectives/:id/retire", error: "/aisworg/seu/objectives/:id", tenantfail: "/aisworg/seu/objectives" }),
    objectivesUpdate: page({ prefix: "/aisworg/seu/objectives/:id/update", error: "/aisworg/seu/objectives/:id/edit", success: "/aisworg/seu/objectives", tenantfail: "/aisworg/seu/objectives" }),
    objectivesValidateCommission: page({ prefix: "/aisworg/seu/objectives/:id/validate-commission", error: "/aisworg/seu/seus/new?objectiveId=:id", tenantfail: "/aisworg/seu/objectives" }),
    policyDefinitionsCopy: page({ prefix: "/aisworg/seu/policy-definitions/:id/copy", error: "/aisworg/seu/policy-definitions" }),
    profilesCopy: page({ prefix: "/aisworg/seu/profiles/:id/copy", error: "/aisworg/seu/profiles" }),
    routeAuthority: page({ prefix: "/aisworg/seu/route-authority", error: "/aisworg/seu/route-authority/new", success: "/aisworg/seu/route-authority" }),
    routeAuthorityById: page({ prefix: "/aisworg/seu/route-authority/:id", error: "/aisworg/seu/route-authority" }),
    routeAuthorityUpdate: page({ prefix: "/aisworg/seu/route-authority/:id/update", error: "/aisworg/seu/route-authority/:id/edit", success: "/aisworg/seu/route-authority" }),
    sdk: page({ prefix: "/aisworg/seu/sdk/:slug", error: "/aisworg/seu/sdk/:slug", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug" }),
    sdkById: page({ prefix: "/aisworg/seu/sdk/:slug/:draftId", error: "/aisworg/seu/sdk/:slug", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug/:draftId" }),
    sdkCompose: page({ prefix: "/aisworg/seu/sdk/:slug/:draftId/compose", error: "/aisworg/seu/sdk/:slug/:draftId", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug/:draftId" }),
    sdkImport: page({ prefix: "/aisworg/seu/sdk/:slug/:draftId/import", error: "/aisworg/seu/sdk/:slug/:draftId", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug/:draftId" }),
    sdkNew: page({ prefix: "/aisworg/seu/sdk/:slug/new", error: "/aisworg/seu/sdk/:slug", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug" }),
    sdkOntologyAdd: page({ prefix: "/aisworg/seu/sdk/ontology/add", error: "/aisworg/seu/sdk/ontology" }),
    sdkOntologyApprovals: page({ prefix: "/aisworg/seu/sdk/ontology/approvals", error: "/aisworg/seu/sdk/ontology/approvals" }),
    sdkOntologyArchive: page({ prefix: "/aisworg/seu/sdk/ontology/archive", error: "/aisworg/seu/sdk/ontology" }),
    sdkOntologyCompose: page({ prefix: "/aisworg/seu/sdk/ontology/compose", error: "/aisworg/seu/sdk/ontology" }),
    sdkOntologyDeprecate: page({ prefix: "/aisworg/seu/sdk/ontology/deprecate", error: "/aisworg/seu/sdk/ontology" }),
    sdkOntologyQuickRetire: page({ prefix: "/aisworg/seu/sdk/ontology/quick-retire", error: "/aisworg/seu/sdk/ontology/metadata" }),
    sdkOntologyRetire: page({ prefix: "/aisworg/seu/sdk/ontology/retire", error: "/aisworg/seu/sdk/ontology" }),
    sdkOntologyUpdateMeta: page({ prefix: "/aisworg/seu/sdk/ontology/update-meta", error: "/aisworg/seu/sdk/ontology/metadata" }),
    sdkPublish: page({ prefix: "/aisworg/seu/sdk/:slug/:draftId/publish", error: "/aisworg/seu/sdk/:slug/:draftId", success: "/aisworg/seu/sdk/:slug", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug/:draftId" }),
    sdkSave: page({ prefix: "/aisworg/seu/sdk/:slug/:draftId/save", error: "/aisworg/seu/sdk/:slug/:draftId", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug/:draftId" }),
    sdkSchemaRegistry: page({ prefix: "/aisworg/seu/sdk/schema-registry", error: "/aisworg/seu/sdk/schema-registry" }),
    sdkSchemaRegistryById: page({ prefix: "/aisworg/seu/sdk/schema-registry/:id", error: "/aisworg/seu/sdk/schema-registry" }),
    sdkSchemaRegistryPublish: page({ prefix: "/aisworg/seu/sdk/schema-registry/publish", error: "/aisworg/seu/sdk/schema-registry" }),
    sdkSchemaRegistryTransition: page({ prefix: "/aisworg/seu/sdk/schema-registry/:id/transition", error: "/aisworg/seu/sdk/schema-registry/:id" }),
    sdkSchemaRegistryPublishById: page({ prefix: "/aisworg/seu/sdk/schema-registry/:id/publish", error: "/aisworg/seu/sdk/schema-registry/:id" }),
    sdkSchemaRegistryReject: page({ prefix: "/aisworg/seu/sdk/schema-registry/:id/reject", error: "/aisworg/seu/sdk/schema-registry/:id" }),
    sdkTransition: page({ prefix: "/aisworg/seu/sdk/:slug/:draftId/transition", error: "/aisworg/seu/sdk/:slug/:draftId", success: "/aisworg/seu/sdk/:slug", tenantfail: "/aisworg/seu/sdk/:slug", badgefail: "/aisworg/seu/sdk/:slug/:draftId" }),
    serviceDefinitionsCopy: page({ prefix: "/aisworg/seu/service-definitions/:id/copy", error: "/aisworg/seu/service-definitions" }),
    seus: page({ prefix: "/aisworg/seu/seus/:id", error: "/aisworg/seu/seus" }),
    seusAttentionItems: page({ prefix: "/aisworg/seu/seus/:id/attention-items", error: "/aisworg/seu/seus/:id" }),
    seusAttentionItemsTransition: page({ prefix: "/aisworg/seu/seus/:id/attention-items/:attentionItemId/transition", error: "/aisworg/seu/seus/:id" }),
    seusCapabilities: page({ prefix: "/aisworg/seu/seus/:id/capabilities/:capabilityId", error: "/aisworg/seu/seus/:id?tab=capabilities" }),
    seusComplianceWaivers: page({ prefix: "/aisworg/seu/seus/:id/compliance/waivers", error: "/aisworg/seu/seus/:id/compliance" }),
    seusDecisions: page({ prefix: "/aisworg/seu/seus/:id/decisions", error: "/aisworg/seu/seus/:id" }),
    seusDecisionsTransition: page({ prefix: "/aisworg/seu/seus/:id/decisions/:decisionId/transition", error: "/aisworg/seu/seus/:id" }),
    seusDeliverablesTransition: page({ prefix: "/aisworg/seu/seus/:id/deliverables/:deliverableId/transition", error: "/aisworg/seu/seus/:id" }),
    seusEbm: page({ prefix: "/aisworg/seu/seus/:id/ebm", error: "/aisworg/seu/seus" }),
    seusEbmTransition: page({ prefix: "/aisworg/seu/seus/:id/ebm/transition", error: "/aisworg/seu/seus/:id" }),
    seusEvidence: page({ prefix: "/aisworg/seu/seus/:id/evidence", error: "/aisworg/seu/seus/:id" }),
    seusEvidenceLink: page({ prefix: "/aisworg/seu/seus/:id/evidence/:evidenceId/link", error: "/aisworg/seu/seus/:id" }),
    seusEvidenceTransition: page({ prefix: "/aisworg/seu/seus/:id/evidence/:evidenceId/transition", error: "/aisworg/seu/seus/:id" }),
    seusEvidenceValidate: page({ prefix: "/aisworg/seu/seus/:id/evidence/:evidenceId/validate", error: "/aisworg/seu/seus/:id" }),
    seusExternalInteractions: page({ prefix: "/aisworg/seu/seus/:id/external-interactions", error: "/aisworg/seu/seus/:id" }),
    seusExternalInteractionsTransition: page({ prefix: "/aisworg/seu/seus/:id/external-interactions/:interactionId/transition", error: "/aisworg/seu/seus/:id" }),
    seusFindingsConvert: page({ prefix: "/aisworg/seu/seus/:id/findings/:findingId/convert", error: "/aisworg/seu/seus/:id/reviews" }),
    seusFindingsTransition: page({ prefix: "/aisworg/seu/seus/:id/findings/:findingId/transition", error: "/aisworg/seu/seus/:id/reviews" }),
    seusKnowledge: page({ prefix: "/aisworg/seu/seus/:id/knowledge", error: "/aisworg/seu/seus/:id" }),
    seusKnowledgePromoteScope: page({ prefix: "/aisworg/seu/seus/:id/knowledge/:knowledgeItemId/promote-scope", error: "/aisworg/seu/seus/:id" }),
    seusKnowledgeTransition: page({ prefix: "/aisworg/seu/seus/:id/knowledge/:knowledgeItemId/transition", error: "/aisworg/seu/seus/:id" }),
    seusNew: page({ prefix: "/aisworg/seu/seus/new", error: "/aisworg/seu/objectives" }),
    seusObligationsRevise: page({ prefix: "/aisworg/seu/seus/:id/obligations/:obligationId/revise", error: "/aisworg/seu/seus/:id" }),
    seusObligationsTransition: page({ prefix: "/aisworg/seu/seus/:id/obligations/:obligationId/transition", error: "/aisworg/seu/seus/:id" }),
    seusReviews: page({ prefix: "/aisworg/seu/seus/:id/reviews", error: "/aisworg/seu/seus/:id/reviews" }),
    seusReviewsFindings: page({ prefix: "/aisworg/seu/seus/:id/reviews/:reviewId/findings", error: "/aisworg/seu/seus/:id/reviews" }),
    seusReviewsTransition: page({ prefix: "/aisworg/seu/seus/:id/reviews/:reviewId/transition", error: "/aisworg/seu/seus/:id/reviews" }),
    seusWorkItemsComplete: page({ prefix: "/aisworg/seu/seus/:id/work-items/:workItemId/complete", error: "/aisworg/seu/seus/:id/work-queue" }),
    templatesCopy: page({ prefix: "/aisworg/seu/templates/:id/copy", error: "/aisworg/seu/templates" }),
    tenantAdminUsersBadges: page({ prefix: "/aisworg/seu/tenant-admin/users/:id/badges", error: "/aisworg/seu/tenant-admin/users" }),
  },
};
