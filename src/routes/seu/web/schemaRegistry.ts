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
import { requirePlatformBadge } from "../../../middleware/requirePlatformBadge.js";
import { logger } from "../../../utils/logger.js";
import { parseListParams, paginateList } from "../../../utils/listQuery.js";
import { SCHEMA_ENTITY_KINDS, createSchemaVersion, getSchemaDefinition, listSchemaDefinitions } from "../core/schemaRegistry.js";
import { generateFields, parseFormBody, validateAgainstSchema, type JsonSchemaDocument } from "../../../domain/sdk/formGenerator.js";
import { META_SCHEMA, fieldListToJsonSchema, jsonSchemaToFieldList, SCHEMA_KINDS, type AuthoredSchema } from "../../../domain/sdk/schemaCompiler.js";
import { schemaDefinitionsDB } from "../../../dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind } from "../../../dblayer/seuTypes.js";

const backTo = "/aisworg/seu/sdk/schema-registry";

/** GET /aisworg/seu/sdk/schema-registry — every (entity kind, version) row. */
router.get("/sdk/schema-registry", requirePlatformBadge("root"), attachVM("seu/sdk/schema-registry/index"), async (req: Request, res: Response, next: NextFunction) => {
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

/** GET /aisworg/seu/sdk/schema-registry/new — CR-017 form-based authoring (generated from the meta-schema). */
router.get("/sdk/schema-registry/new", requirePlatformBadge("root"), attachVM("seu/sdk/schema-registry/new"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityKind = typeof req.query.entityKind === "string" ? req.query.entityKind : "";
    let fields: AuthoredSchema["fields"] = [];
    if (SCHEMA_KINDS.includes(entityKind as (typeof SCHEMA_KINDS)[number])) {
      // Start from the kind's current version so the author evolves it (immutable — save makes a new version).
      const { data: latest } = await schemaDefinitionsDB.findLatest(entityKind as SchemaDefinitionEntityKind);
      if (latest) fields = jsonSchemaToFieldList(latest.schema as JsonSchemaDocument);
    }
    req.vm.req.title = entityKind ? `New ${entityKind} schema version` : "New schema version";
    req.vm.req.fields = generateFields(META_SCHEMA, { entityKind, fields });
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/schema-registry/new", req.vm);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] GET /sdk/schema-registry/new error", err as Error);
    next(err);
  }
});

/** GET /aisworg/seu/sdk/schema-registry/:id — one version's schema, readably rendered. */
router.get("/sdk/schema-registry/:id", requirePlatformBadge("root"), attachVM("seu/sdk/schema-registry/detail"), async (req: Request, res: Response, next: NextFunction) => {
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
    };
    req.vm.opt.flash = getFlash(req);
    return renderView(req, res, "seu/sdk/schema-registry/detail", req.vm);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] GET /sdk/schema-registry/:id error", err as Error);
    next(err);
  }
});

/** POST /aisworg/seu/sdk/schema-registry — a new, additive version (never edits an existing one).
 *  CR-017: the form path (compile a field list) is primary; the raw-JSON path is the advanced fallback. */
router.post("/sdk/schema-registry", requirePlatformBadge("root"), async (req: Request, res: Response) => {
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
      // Form path — parse the field list against the meta-schema, validate, compile.
      const authored = parseFormBody(META_SCHEMA, body) as unknown as AuthoredSchema;
      const errors = validateAgainstSchema(META_SCHEMA, authored as unknown as Record<string, unknown>);
      if (errors.length) return flashError(req, res, `${backTo}/new?entityKind=${encodeURIComponent(String(authored.entityKind ?? ""))}`, errors.join("; "));
      if (!(authored.fields ?? []).some((f) => (f.name ?? "").trim())) {
        return flashError(req, res, `${backTo}/new?entityKind=${encodeURIComponent(String(authored.entityKind ?? ""))}`, "At least one named field is required.");
      }
      entityKind = String(authored.entityKind).trim();
      schemaJson = JSON.stringify(fieldListToJsonSchema(authored));
    }

    const result = await createSchemaVersion({ entityKind, schemaJson });
    if (!result.ok) return flashError(req, res, backTo, result.errors.join("; "));
    return flashSuccess(req, res, `${backTo}/${result.schema.id}`, `${result.schema.entity_kind} schema v${result.schema.version} created.`);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] POST /sdk/schema-registry error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
