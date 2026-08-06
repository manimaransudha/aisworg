// SDK UI Layer Plan — the four authoring surfaces' UI (Build order steps
// 3-5; Transition Definition — step 6 — isn't in KIND_BY_SLUG yet, since it
// needs the transitionEngine/qualityGateEngine generalisation first). One
// generic, kind-parametrized set of routes and views, not four hand-built
// copies — "this is where the generator actually pays for itself" (the
// plan's Build order, step 4).
//
// Access control per 014_sdk_authoring.sql's header comment: two flat,
// Platform-scoped badges (sdk_creator/sdk_approver) gate these routes via
// the existing requirePlatformBadge — root bypasses both, same as every
// other Platform-badge check.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require("express");
const router = express.Router();

import type { Request, Response, NextFunction } from "express";
import { attachVM } from "../../../middleware/attachVM.js";
import { renderView } from "../../../utils/viewModel.js";
import { getFlash, flashError, flashSuccess } from "../../../utils/flash.js";
import { requirePlatformBadge } from "../../../middleware/requirePlatformBadge.js";
import { logger } from "../../../utils/logger.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { deliverableAuthoringContentDB } from "../../../dblayer/deliverableAuthoringContentDB.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { generateFields, parseFormBody, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { AUTHORING_CATEGORY, startAuthoring, saveAuthoringContent, submitForReview, publishAuthoredContent } from "../core/sdkAuthoring.js";
import type { SchemaDefinitionEntityKind } from "../../../dblayer/seuTypes.js";

const KIND_BY_SLUG: Record<string, SchemaDefinitionEntityKind> = {
  "pack-authoring": "Pack",
  "template-authoring": "Template",
  "profile-authoring": "Profile",
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

function requireAnySdkBadge(req: Request, res: Response, next: NextFunction): void {
  const held: string[] = req.session?.user?.platformBadges ?? [];
  if (held.includes("root") || held.includes("sdk_creator") || held.includes("sdk_approver")) return next();
  if (req.session) {
    (req.session as unknown as { flash?: { type: string; message: string } }).flash = {
      type: "error",
      message: `You don't have the required Platform badge ("sdk_creator" or "sdk_approver") for that.`,
    };
  }
  res.redirect(req.headers.referer || "/aisworg");
}

/** GET /aisworg/seu/sdk/:slug — every in-progress and completed authoring session for this kind. */
router.get("/sdk/:slug", requireAnySdkBadge, attachVM("seu/sdk/authoring/index"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  try {
    const { data: deliverables } = await deliverablesDB.findByCategory(AUTHORING_CATEGORY[kind]);
    const held: string[] = req.session?.user?.platformBadges ?? [];
    req.vm.req.title = `${kind} Authoring`;
    req.vm.req.kindLabel = kind;
    req.vm.req.slug = slug;
    req.vm.req.sessions = (deliverables ?? []).map((d) => ({
      deliverableId: d.id,
      lifecycleState: d.lifecycle_state,
      createdAt: d.created_at,
    }));
    req.vm.req.canCreate = held.includes("root") || held.includes("sdk_creator");
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authoring/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /sdk/:slug error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/:slug — "Create": commissions the bootstrap SEU and starts authoring. */
router.post("/sdk/:slug", requirePlatformBadge("sdk_creator"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  const actorName = req.session?.user?.name || req.session?.user?.email || "Unknown";
  if (!actorId) return flashError(req, res, backToIndex(slug), "No actor identity on session.");
  try {
    const result = await startAuthoring({ kind, actorId, actorName, actorRole: req.session?.user?.role ?? "general" });
    return flashSuccess(req, res, backTo(slug, result.deliverable.id), `Started authoring a new ${kind} Definition.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST /sdk/:slug error", err as Error);
    return flashError(req, res, backToIndex(slug), (err as Error).message);
  }
});

// Registry-backed options for referential-select/referential-list fields,
// keyed by the same x-referential-source string a grammar declares — every
// kind shares one lookup, since referring to a Pack code or a Template code
// means the same thing regardless of which of the four is being authored.
async function loadReferentialOptions(): Promise<Record<string, string[]>> {
  const [{ data: packs }, { data: templates }] = await Promise.all([packsDB.findAll(), templatesDB.findAllActive()]);
  return {
    "pack-code": [...new Set((packs ?? []).map((p) => p.code))].sort(),
    "template-code": [...new Set((templates ?? []).map((t) => t.code))].sort(),
  };
}

/** GET /aisworg/seu/sdk/:slug/:deliverableId — the generated form. */
router.get("/sdk/:slug/:deliverableId", requireAnySdkBadge, attachVM("seu/sdk/authoring/edit"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  try {
    const { data: deliverable } = await deliverablesDB.findById(String(req.params.deliverableId));
    if (!deliverable) return flashError(req, res, backToIndex(slug), "Authoring session not found.");

    const { data: content } = await deliverableAuthoringContentDB.findByDeliverableId(deliverable.id);
    if (!content) return flashError(req, res, backToIndex(slug), "No authoring content found for this session.");

    const { data: schemaDef } = await schemaDefinitionsDB.findById(content.schema_definition_id);
    if (!schemaDef) return flashError(req, res, backToIndex(slug), "Authoring content references a schema version that no longer exists.");

    const referentialOptions = await loadReferentialOptions();

    const held: string[] = req.session?.user?.platformBadges ?? [];
    const isCreator = held.includes("root") || held.includes("sdk_creator");
    const isApprover = held.includes("root") || held.includes("sdk_approver");

    req.vm.req.title = `${kind} Definition — ${deliverable.lifecycle_state}`;
    req.vm.req.kindLabel = kind;
    req.vm.req.slug = slug;
    req.vm.req.deliverable = { id: deliverable.id, lifecycleState: deliverable.lifecycle_state, seuId: deliverable.seu_id, schemaVersion: schemaDef.version };
    req.vm.req.fields = generateFields(schemaDef.schema as JsonSchemaDocument, content.content);
    req.vm.req.contentJson = JSON.stringify(content.content, null, 2);
    req.vm.req.canEdit = isCreator && deliverable.lifecycle_state === "In Progress";
    req.vm.req.canApprove = isApprover && deliverable.lifecycle_state === "In Progress";
    req.vm.req.canPublish = isApprover && deliverable.lifecycle_state === "Approved";
    req.vm.opt.referentialOptions = referentialOptions;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/authoring/edit", req.vm);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] GET /sdk/:slug/:id error", err as Error);
    next(err);
  }
});

async function loadSchemaFor(deliverableId: string): Promise<JsonSchemaDocument | null> {
  const { data: content } = await deliverableAuthoringContentDB.findByDeliverableId(deliverableId);
  if (!content) return null;
  const { data: schemaDef } = await schemaDefinitionsDB.findById(content.schema_definition_id);
  return (schemaDef?.schema as JsonSchemaDocument) ?? null;
}

/** POST /aisworg/seu/sdk/:slug/:deliverableId/save — generated-form fields, reassembled per the schema. */
router.post("/sdk/:slug/:deliverableId/save", requirePlatformBadge("sdk_creator"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  if (!resolveKind(slug)) return next();
  const deliverableId = String(req.params.deliverableId);
  try {
    const schema = await loadSchemaFor(deliverableId);
    if (!schema) return flashError(req, res, backTo(slug, deliverableId), "No schema found for this authoring session.");
    const content = parseFormBody(schema, req.body ?? {});
    await saveAuthoringContent(deliverableId, content);
    return flashSuccess(req, res, backTo(slug, deliverableId), "Draft saved.");
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../save error", err as Error);
    return flashError(req, res, backTo(slug, deliverableId), (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/:slug/:deliverableId/import — replace the whole document with pasted/uploaded JSON. */
router.post("/sdk/:slug/:deliverableId/import", requirePlatformBadge("sdk_creator"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  if (!resolveKind(slug)) return next();
  const deliverableId = String(req.params.deliverableId);
  const raw = req.body?.importedJson;
  if (typeof raw !== "string" || !raw.trim()) return flashError(req, res, backTo(slug, deliverableId), "Paste a JSON document to import.");
  try {
    const parsed = JSON.parse(raw);
    await saveAuthoringContent(deliverableId, parsed);
    return flashSuccess(req, res, backTo(slug, deliverableId), "Imported.");
  } catch (err) {
    return flashError(req, res, backTo(slug, deliverableId), `Invalid JSON: ${(err as Error).message}`);
  }
});

/** POST /aisworg/seu/sdk/:slug/:deliverableId/approve — "Review" (In Progress -> Approved). */
router.post("/sdk/:slug/:deliverableId/approve", requirePlatformBadge("sdk_approver"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const deliverableId = String(req.params.deliverableId);
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, backTo(slug, deliverableId), "No actor identity on session.");
  try {
    const result = await submitForReview({ deliverableId, kind, actorId, actorRole: req.session?.user?.role ?? "general" });
    if (!result.ok) return flashError(req, res, backTo(slug, deliverableId), (result.errors ?? []).join("; "));
    return flashSuccess(req, res, backTo(slug, deliverableId), "Approved.");
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../approve error", err as Error);
    return flashError(req, res, backTo(slug, deliverableId), (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/:slug/:deliverableId/publish — "Publish" (Approved -> Baselined, then the kind's own publish glue). */
router.post("/sdk/:slug/:deliverableId/publish", requirePlatformBadge("sdk_approver"), async (req: Request, res: Response, next: NextFunction) => {
  const slug = String(req.params.slug);
  const kind = resolveKind(slug);
  if (!kind) return next();
  const deliverableId = String(req.params.deliverableId);
  const actorId = req.session?.user?.id != null ? String(req.session.user.id) : undefined;
  if (!actorId) return flashError(req, res, backTo(slug, deliverableId), "No actor identity on session.");
  try {
    const result = await publishAuthoredContent({ deliverableId, kind, actorId, actorRole: req.session?.user?.role ?? "general" });
    if (!result.ok) return flashError(req, res, backTo(slug, deliverableId), (result.errors ?? []).join("; "));
    return flashSuccess(req, res, PUBLISH_REDIRECT_BY_KIND[kind], `${kind} published and registered.`);
  } catch (err) {
    logger.error("[web/seu/sdkAuthoring] POST .../publish error", err as Error);
    return flashError(req, res, backTo(slug, deliverableId), (err as Error).message);
  }
});

export { router };
