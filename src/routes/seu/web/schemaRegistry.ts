// SDK UI Layer Plan — "Schema Registry" section, the one piece of Build
// order step 1 not shipped alongside Pack/Template/Profile authoring. Root
// only — a wrong schema affects every future authoring session of a kind,
// more platform-administrative than the sdk_creator/sdk_approver badges
// that gate authoring itself, so this reuses the same root-only convention
// Identity Management and the Pack Registry's lifecycle controls already use.
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
import { SCHEMA_ENTITY_KINDS, createSchemaVersion, reviewSchemaVersion, getSchemaDefinition, listSchemaDefinitions } from "../core/schemaRegistry.js";
import type { JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { SCHEMA_KINDS, TOP_LEVEL_WIDGET_KINDS, ITEM_WIDGET_KINDS, blankDocument, blankWidget, jsonSchemaToWidgetTree, widgetTreeToJsonSchema, parseAuthoredDocumentFromBody } from "../../../domain/sdk/schemaCompiler.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind } from "../../../dblayer/seuTypes.js";

const backTo = "/aisworg/seu/sdk/schema-registry";

/** GET /aisworg/seu/sdk/schema-registry — every (entity kind, version) row. */
router.get("/sdk/schema-registry", attachVM("seu/sdk/schema-registry/index"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schemas = (await listSchemaDefinitions()).map((s) => ({ id: s.id, entityKind: s.entity_kind, version: s.version, createdAt: s.created_at }));
    req.vm.req.title = "Schema Registry";
    req.vm.req.kinds = SCHEMA_ENTITY_KINDS;
    const params = parseListParams(req.query, { sortable: ["kind", "version", "created"], defaultSort: "kind", defaultDir: "asc" });
    req.vm.req.list = paginateList(schemas, params, {
      searchFields: [(s) => s.entityKind],
      sortFields: { kind: (s) => s.entityKind, version: (s) => s.version, created: (s) => s.createdAt },
    });
    req.vm.opt.listBasePath = "/aisworg/seu/sdk/schema-registry";
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/schema-registry/index", req.vm);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] GET /sdk/schema-registry error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/sdk/schema-registry/new — CR-114 widget-tree authoring form. */
router.get("/sdk/schema-registry/new", attachVM("seu/sdk/schema-registry/new"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityKind = typeof req.query.entityKind === "string" ? req.query.entityKind : "";
    const validKind = SCHEMA_KINDS.includes(entityKind as (typeof SCHEMA_KINDS)[number]);
    let doc = blankDocument();
    if (validKind) {
      // Start from the kind's current version so the author evolves it (immutable — save makes a new version).
      const { data: latest } = await schemaDefinitionsDB.findLatest(entityKind as SchemaDefinitionEntityKind);
      if (latest) doc = jsonSchemaToWidgetTree(latest.schema as JsonSchemaDocument);
    }
    req.vm.req.title = entityKind ? `New ${entityKind} schema version` : "New schema version";
    req.vm.req.entityKind = entityKind;
    // Reached only via a kind-specific "New <kind> version" button (schema-
    // registry/index.ejs) — the kind is locked to whichever one launched
    // this form, not hand-editable inside it.
    req.vm.req.entityKindLocked = validKind;
    req.vm.req.doc = doc;
    req.vm.req.topLevelKinds = TOP_LEVEL_WIDGET_KINDS;
    req.vm.req.itemKinds = ITEM_WIDGET_KINDS;
    req.vm.req.blankWidget = blankWidget();
    req.vm.req.allKinds = SCHEMA_KINDS;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/schema-registry/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] GET /sdk/schema-registry/new error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/sdk/schema-registry/:id — one version's schema, readably rendered. */
router.get("/sdk/schema-registry/:id", attachVM("seu/sdk/schema-registry/detail"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = await getSchemaDefinition(String(req.params.id));
    if (!schema) return flashError(req, res, backTo, "Schema version not found.");
    req.vm.req.title = `${schema.entity_kind} schema v${schema.version}`;
    req.vm.req.schema = {
      id: schema.id,
      entityKind: schema.entity_kind,
      version: schema.version,
      schemaJson: JSON.stringify(schema.schema, null, 2),
      createdAt: schema.created_at,
      compatibleVersions: schema.compatible_versions ?? [],
      incompatibleVersions: schema.incompatible_versions ?? [],
    };
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/schema-registry/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] GET /sdk/schema-registry/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/schema-registry — CR-114 Compatibility feature: no longer writes
 *  directly. Builds the draft schema (form or raw-JSON path) and renders a compatibility
 *  review against every existing version of the kind; nothing is created until Publish. */
router.post("/sdk/schema-registry", attachVM("seu/sdk/schema-registry/review"), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  try {
    let entityKind: string;
    let schemaJson: string;

    if (typeof body.schemaJson === "string" && body.schemaJson.trim()) {
      // Advanced raw-JSON path.
      entityKind = String(body.entityKind ?? "").trim();
      schemaJson = body.schemaJson;
      if (!entityKind) return flashError(req, res, backTo, "Entity kind is required.");
    } else {
      // Form path — the widget tree posted by the CR-114 recursive editor.
      entityKind = String(body.entityKind ?? "").trim();
      const backToNew = `${backTo}/new?entityKind=${encodeURIComponent(entityKind)}`;
      if (!entityKind) return flashError(req, res, backTo, "Entity kind is required.");
      const doc = parseAuthoredDocumentFromBody(body);
      if (!doc.widgets.length) return flashError(req, res, backToNew, "At least one named field is required.");
      schemaJson = JSON.stringify(widgetTreeToJsonSchema(doc));
    }

    const result = await reviewSchemaVersion({ entityKind, schemaJson });
    if (!result.ok) {
      const backToNew = `${backTo}/new?entityKind=${encodeURIComponent(entityKind)}`;
      return flashError(req, res, backToNew, result.errors.join("; "));
    }

    req.vm.req.title = `Review ${result.entityKind} schema changes`;
    req.vm.req.entityKind = result.entityKind;
    req.vm.req.schemaJson = result.schemaJson;
    req.vm.req.report = result.report;
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/schema-registry/review", req.vm);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] POST /sdk/schema-registry error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

/** POST /aisworg/seu/sdk/schema-registry/publish — commits the reviewed draft as a new,
 *  additive version. Re-runs the compatibility check server-side (never trusts the client)
 *  and persists the recomputed compatible/incompatible version lists on the new row. */
router.post("/sdk/schema-registry/publish", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  try {
    const entityKind = String(body.entityKind ?? "").trim();
    const schemaJson = String(body.schemaJson ?? "");
    if (!entityKind || !schemaJson) return flashError(req, res, backTo, "Entity kind and schema are required.");

    const result = await createSchemaVersion({ entityKind, schemaJson });
    if (!result.ok) return flashError(req, res, backTo, result.errors.join("; "));
    return flashSuccess(req, res, `${backTo}/${result.schema.id}`, `${result.schema.entity_kind} schema v${result.schema.version} created.`);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] POST /sdk/schema-registry/publish error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
