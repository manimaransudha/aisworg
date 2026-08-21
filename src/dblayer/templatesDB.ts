import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { PLATFORM_TENANT_ID } from "./constants.js";
import type { CapabilityRow, DbResult, TemplateDeliverableSeed, TemplateRow } from "./seuTypes.js";

// Also owns template_capabilities (required Capabilities) and template_packs
// (mandatory Packs only — see Build Plan §5 item 6 for the Template/Profile split).
export const templatesDB = {
  // CR-024: (code, template_version) is the unique identity now, not code
  // alone (migration 059) — the ON CONFLICT target moved to match. templateVersion
  // defaults to "1.0.0" so every existing seed-script caller (which never
  // knew versions existed) keeps its exact same idempotent-reseed behaviour:
  // re-running the same seed still upserts the same (code, "1.0.0") row.
  // CR-026: (code, template_version, tenant_id) is the real identity now
  // (migration 062) — the ON CONFLICT target moved to match again.
  // tenantId defaults to Platform (packsDB.create's own pattern) — every
  // seed-script caller predates tenant ownership and gets exactly the same
  // idempotent-reseed row it always has.
  async upsert(input: {
    code: string;
    name: string;
    templateVersion?: string;
    deliverableCatalogue?: TemplateDeliverableSeed[];
    tenantId?: string;
  }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        `INSERT INTO templates (code, name, template_version, deliverable_catalogue, tenant_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code, template_version, tenant_id) DO UPDATE
           SET name = EXCLUDED.name, deliverable_catalogue = EXCLUDED.deliverable_catalogue
         RETURNING *`,
        [input.code, input.name, input.templateVersion ?? "1.0.0", JSON.stringify(input.deliverableCatalogue ?? []), input.tenantId ?? PLATFORM_TENANT_ID]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  // Entity-direct authoring (bug fix correcting CR-014): a Draft Template row is
  // the authoring document. draft_content holds the raw authored form content
  // (materialised into the real columns/join tables at publish). authored_by is
  // the real author.
  // CR-024: templateVersion defaults to "1.0.0" (the column's own DB
  // DEFAULT covers callers that don't pass one, e.g. existing tests) —
  // explicit here so reactivateAsNewVersion (core/templates.ts) can create a
  // row at a specific bumped version, the same way packsDB.create always
  // takes packVersion explicitly.
  // CR-026: tenantId — the real author's own tenant (Platform for a Platform
  // author), same pattern as packsDB.create; defaults to Platform for
  // callers with no author context (mirrors upsert above). parentTemplateId
  // (Ch.6 §9 Template Inheritance) is set once at Draft creation via the
  // "Inherit" control and never revisited by Save — an inherited Draft's
  // identity (code locked to its parent's, tenant its own) is fixed from
  // the moment it's chosen.
  async createDraft(input: { code: string; name: string; templateVersion?: string; authoredBy?: number | null; draftContent?: Record<string, unknown>; tenantId?: string; parentTemplateId?: string | null }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        `INSERT INTO templates (code, name, template_version, status, deliverable_catalogue, authored_by, draft_content, tenant_id, parent_template_id)
         VALUES ($1, $2, $3, 'Draft', '[]', $4, $5, $6, $7)
         RETURNING *`,
        [input.code, input.name, input.templateVersion ?? "1.0.0", input.authoredBy ?? null, JSON.stringify(input.draftContent ?? {}), input.tenantId ?? PLATFORM_TENANT_ID, input.parentTemplateId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-021: `code` is now a real, editable form field (template-categories
  // Ontology, not a hidden UUID) — a Draft's code needs to be correctable on
  // Save the same way Pack's category/packVersion already are (VM-002's
  // immutability applies once a version leaves Draft, not to the working
  // draft). Previously this only ever touched name/draft_content; a code
  // edit on the form was silently dropped. CR-024: templateVersion is now
  // correctable on Save the same way, for the same reason.
  async updateDraftContent(id: string, input: { code: string; name: string; templateVersion: string; draftContent: Record<string, unknown> }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        `UPDATE templates SET code = $2, name = $3, template_version = $4, draft_content = $5 WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.code, input.name, input.templateVersion, JSON.stringify(input.draftContent)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] updateDraftContent error", err as Error);
      return { error: err as Error };
    }
  },

  // Publish-time materialisation of a Draft's authored deliverable catalogue
  // onto its real column (the join tables are set separately). Status-agnostic:
  // called while the row is still Draft, just before the governed Draft->Active
  // transition.
  async setDeliverableCatalogue(id: string, deliverableCatalogue: TemplateDeliverableSeed[]): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        "UPDATE templates SET deliverable_catalogue = $2 WHERE id = $1 RETURNING *",
        [id, JSON.stringify(deliverableCatalogue)]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] setDeliverableCatalogue error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: TemplateRow["status"]): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>("UPDATE templates SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, per-verb tabs — see packsDB.findByStatusActedBy for the
  // full rationale (Templates only have `define` + `publish`, so this is
  // reached for the `publish` verb only, but generic for future growth).
  async findByStatusActedBy(status: TemplateRow["status"], authorityBadge: string, actorId: number | null): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = actorId == null
        ? await query<TemplateRow>(
            `SELECT DISTINCT t.* FROM templates t
             JOIN events e ON e.originating_object_type = 'Template' AND e.originating_object_id = t.id
             WHERE t.status = $1 AND e.authority_badge = $2
             ORDER BY t.created_at DESC`,
            [status, authorityBadge]
          )
        : await query<TemplateRow>(
            `SELECT DISTINCT t.* FROM templates t
             JOIN events e ON e.originating_object_type = 'Template' AND e.originating_object_id = t.id
             WHERE t.status = $1 AND e.authority_badge = $2 AND e.actor_id = $3
             ORDER BY t.created_at DESC`,
            [status, authorityBadge, String(actorId)]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findByStatusActedBy error", err as Error);
      return { error: err as Error };
    }
  },

  async findDrafts(authoredBy?: number | null): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = authoredBy == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE status IN ('Draft', 'Validated') ORDER BY created_at DESC")
        : await query<TemplateRow>("SELECT * FROM templates WHERE status IN ('Draft', 'Validated') AND authored_by = $1 ORDER BY created_at DESC", [authoredBy]);
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findDrafts error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-024: code alone is no longer unique (multiple versions can share it)
  // — "latest published" by created_at, same convention and same caveat
  // packsDB.findByCode already documents ("this MVP publishes versions in
  // order and doesn't need out-of-order backfill"). Before this migration a
  // bare `code` really was unique, so this returned the same single row
  // either way; now it matters.
  async findByCode(code: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 ORDER BY created_at DESC LIMIT 1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-026: scoped to a tenant when given (packsDB.findByCodeAndVersion's own
  // pattern) — (code, template_version) alone stopped being unique the
  // moment a second tenant could own a row of the same code+version.
  // Omitted = unscoped (Profile's baseTemplateCode-style legacy callers).
  async findByCodeAndVersion(code: string, templateVersion: string, tenantId?: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND template_version = $2", [code, templateVersion])
        : await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND template_version = $2 AND tenant_id = $3", [code, templateVersion, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findByCodeAndVersion error", err as Error);
      return { error: err as Error };
    }
  },

  // The one row (if any) currently Active for a code — reactivateAsNewVersion's
  // supersede step (core/templates.ts) uses this to find what a newly-activated
  // version replaces, same as packsDB.findActiveByCode. CR-026: "one Active per
  // code" is now per (code, tenant_id) — a tenant's own inherited Template and
  // its Platform parent (same code, different tenant_id) don't supersede each
  // other. tenantId omitted = unscoped (findCandidateTemplates/compositionEngine
  // predate any tenant concept here and keep their original behaviour).
  async findActiveByCode(code: string, tenantId?: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = tenantId == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND status = 'Active' ORDER BY created_at DESC LIMIT 1", [code])
        : await query<TemplateRow>("SELECT * FROM templates WHERE code = $1 AND status = 'Active' AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1", [code, tenantId]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findActiveByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findAllActive(): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE status = 'Active' ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findAllActive error", err as Error);
      return { error: err as Error };
    }
  },

  // Template ownership visibility (CR-026, mirroring packsDB.findAllVisibleTo/
  // findActiveVisibleTo exactly): every Version of every Template this viewer
  // Template Registry listing (owner, 2026-08-19), mirroring packsDB.findAll
  // exactly — every Version of every Template, unscoped by tenant. Root/admin
  // "see everything" view; callers needing visibility scoping use
  // findAllVisibleTo below.
  async findAll(): Promise<DbResult<TemplateRow[]>> {
    try {
      // No separate `category` column on templates — `code` IS the category
      // (CR-021's own shortcut, Ch.6 §20.1/§20.14), so this orders by that
      // instead of Pack's own findAll's `category, code`.
      const { rows } = await query<TemplateRow>("SELECT * FROM templates ORDER BY code, created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  // is allowed to see — Platform's own plus this viewer's own tenant's. Feeds
  // the Template Inheritance dropdown (Platform published + tenant published).
  async findAllVisibleTo(viewerTenantId: string): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = await query<TemplateRow>(
        "SELECT * FROM templates WHERE tenant_id = $1 OR tenant_id = $2 ORDER BY code, created_at DESC",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findAllVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  async findActiveVisibleTo(viewerTenantId: string): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = await query<TemplateRow>(
        "SELECT * FROM templates WHERE status = 'Active' AND (tenant_id = $1 OR tenant_id = $2) ORDER BY code",
        [PLATFORM_TENANT_ID, viewerTenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findActiveVisibleTo error", err as Error);
      return { error: err as Error };
    }
  },

  // Authoring surface, the "Queue" tabs (owner: "add a tab to show what is
  // the queue applicable to the badge you hold") — every Template currently
  // sitting in an arbitrary `status`, full stop. Added 2026-08-18 alongside
  // Template's six-hop lifecycle seed change: findDrafts (Draft/Validated
  // only) stopped being able to answer "what's waiting in Published /
  // Deprecated / Retired" once those states became reachable. CR-026: now that
  // Template has Pack's tenant-ownership model, scoped the same way
  // packsDB.findByStatus is — viewerTenantId null = unscoped (root).
  async findByStatus(status: TemplateRow["status"], viewerTenantId: string | null): Promise<DbResult<TemplateRow[]>> {
    try {
      const { rows } = viewerTenantId == null
        ? await query<TemplateRow>("SELECT * FROM templates WHERE status = $1 ORDER BY created_at DESC", [status])
        : await query<TemplateRow>(
            "SELECT * FROM templates WHERE status = $1 AND (tenant_id = $2 OR tenant_id = $3) ORDER BY created_at DESC",
            [status, PLATFORM_TENANT_ID, viewerTenantId]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] findByStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async setRequiredCapabilities(templateId: string, capabilityIds: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM template_capabilities WHERE template_id = $1", [templateId]);
      for (const capabilityId of capabilityIds) {
        await query(
          "INSERT INTO template_capabilities (template_id, capability_id) VALUES ($1, $2)",
          [templateId, capabilityId]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[templatesDB] setRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async getRequiredCapabilities(templateId: string): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>(
        `SELECT c.* FROM capabilities c
         JOIN template_capabilities tc ON tc.capability_id = c.id
         WHERE tc.template_id = $1
         ORDER BY c.code`,
        [templateId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] getRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  // Stores the Pack's *code*, not a specific row id — bug fix, see
  // 013_template_profile_pack_by_code.sql. A Template names which Pack
  // codes it requires; which Version that resolves to is decided fresh at
  // every commissioning (compositionEngine.compose), not frozen here.
  //
  // CR-038 — a thin wrapper over setPackSelection's own 'mandatory' slot
  // (mirrors profilesDB.setOptionalPacks's identical relationship to its own
  // setPackSelection), not a separate unfiltered-delete implementation —
  // scoping the delete to list_kind='mandatory' is what stops this from
  // wiping out the six category-specific slots below when both are ever
  // touched for the same Template.
  async setMandatoryPacks(templateId: string, packCodes: string[]): Promise<DbResult<void>> {
    return templatesDB.setPackSelection(templateId, "mandatory", packCodes);
  },

  async getMandatoryPackCodes(templateId: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM template_packs WHERE template_id = $1 ORDER BY pack_code",
        [templateId]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[templatesDB] getMandatoryPackCodes error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-038 — Template's mandatory Packs get the same category-scoped slots
  // Profile's own Pack selections already have (profilesDB.setPackSelection/
  // getPackSelection, migration 067) — same join table, disambiguated by
  // list_kind (migration 077) rather than six new tables. Scoped writes/reads
  // — unlike setMandatoryPacks/getMandatoryPackCodes above (still real,
  // still used by callers that only care about the flat "every mandatory
  // Pack regardless of category" set, e.g. compositionEngine), these only
  // touch their own list_kind slot.
  async setPackSelection(templateId: string, listKind: string, packCodes: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM template_packs WHERE template_id = $1 AND list_kind = $2", [templateId, listKind]);
      for (const packCode of packCodes) {
        await query("INSERT INTO template_packs (template_id, pack_code, list_kind) VALUES ($1, $2, $3)", [templateId, packCode, listKind]);
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[templatesDB] setPackSelection error", err as Error);
      return { error: err as Error };
    }
  },

  async getPackSelection(templateId: string, listKind: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ pack_code: string }>(
        "SELECT pack_code FROM template_packs WHERE template_id = $1 AND list_kind = $2 ORDER BY pack_code",
        [templateId, listKind]
      );
      return { data: rows.map((r) => r.pack_code) };
    } catch (err) {
      logger.error("[templatesDB] getPackSelection error", err as Error);
      return { error: err as Error };
    }
  },
};
