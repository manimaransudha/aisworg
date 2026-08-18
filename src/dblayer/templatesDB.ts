import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult, TemplateDeliverableSeed, TemplateRow } from "./seuTypes.js";

// Also owns template_capabilities (required Capabilities) and template_packs
// (mandatory Packs only — see Build Plan §5 item 6 for the Template/Profile split).
export const templatesDB = {
  async upsert(input: {
    code: string;
    name: string;
    deliverableCatalogue?: TemplateDeliverableSeed[];
  }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        `INSERT INTO templates (code, name, deliverable_catalogue)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name, deliverable_catalogue = EXCLUDED.deliverable_catalogue
         RETURNING *`,
        [input.code, input.name, JSON.stringify(input.deliverableCatalogue ?? [])]
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
  async createDraft(input: { code: string; name: string; authoredBy?: number | null; draftContent?: Record<string, unknown> }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        `INSERT INTO templates (code, name, status, deliverable_catalogue, authored_by, draft_content)
         VALUES ($1, $2, 'Draft', '[]', $3, $4)
         RETURNING *`,
        [input.code, input.name, input.authoredBy ?? null, JSON.stringify(input.draftContent ?? {})]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[templatesDB] createDraft error", err as Error);
      return { error: err as Error };
    }
  },

  async updateDraftContent(id: string, input: { name: string; draftContent: Record<string, unknown> }): Promise<DbResult<TemplateRow>> {
    try {
      const { rows } = await query<TemplateRow>(
        `UPDATE templates SET name = $2, draft_content = $3 WHERE id = $1 AND status = 'Draft' RETURNING *`,
        [id, input.name, JSON.stringify(input.draftContent)]
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

  async findByCode(code: string): Promise<DbResult<TemplateRow | null>> {
    try {
      const { rows } = await query<TemplateRow>("SELECT * FROM templates WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[templatesDB] findByCode error", err as Error);
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
  async setMandatoryPacks(templateId: string, packCodes: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM template_packs WHERE template_id = $1", [templateId]);
      for (const packCode of packCodes) {
        await query("INSERT INTO template_packs (template_id, pack_code) VALUES ($1, $2)", [templateId, packCode]);
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[templatesDB] setMandatoryPacks error", err as Error);
      return { error: err as Error };
    }
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
};
