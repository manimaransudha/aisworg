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

/** POST /aisworg/seu/sdk/schema-registry — a new, additive version (never edits an existing one). */
router.post("/sdk/schema-registry", requirePlatformBadge("root"), async (req: Request, res: Response) => {
  const { entityKind, schemaJson } = req.body ?? {};
  if (typeof entityKind !== "string" || !entityKind.trim() || typeof schemaJson !== "string" || !schemaJson.trim()) {
    return flashError(req, res, backTo, "Entity kind and schema JSON are both required.");
  }
  try {
    const result = await createSchemaVersion({ entityKind: entityKind.trim(), schemaJson });
    if (!result.ok) return flashError(req, res, backTo, result.errors.join("; "));
    return flashSuccess(req, res, `${backTo}/${result.schema.id}`, `${result.schema.entity_kind} schema v${result.schema.version} created.`);
  } catch (err) {
    logger.error("[web/seu/schemaRegistry] POST /sdk/schema-registry error", err as Error);
    return flashError(req, res, backTo, (err as Error).message);
  }
});

export { router };
