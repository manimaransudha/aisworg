import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult, PackRow, TemplateDeliverableSeed, TemplateRow } from "./seuTypes.js";

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

  async setMandatoryPacks(templateId: string, packIds: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM template_packs WHERE template_id = $1", [templateId]);
      for (const packId of packIds) {
        await query("INSERT INTO template_packs (template_id, pack_id) VALUES ($1, $2)", [templateId, packId]);
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[templatesDB] setMandatoryPacks error", err as Error);
      return { error: err as Error };
    }
  },

  async getMandatoryPacks(templateId: string): Promise<DbResult<PackRow[]>> {
    try {
      const { rows } = await query<PackRow>(
        `SELECT p.* FROM packs p
         JOIN template_packs tp ON tp.pack_id = p.id
         WHERE tp.template_id = $1
         ORDER BY p.code`,
        [templateId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[templatesDB] getMandatoryPacks error", err as Error);
      return { error: err as Error };
    }
  },
};
