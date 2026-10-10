import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, DeliverableAuthoringContentRow } from "./seuTypes.js";

export const deliverableAuthoringContentDB = {
  async create(input: { deliverableId: string; schemaDefinitionId: string; content: Record<string, unknown>; authorId: string; authorBadge: string }): Promise<DbResult<DeliverableAuthoringContentRow>> {
    try {
      const { rows } = await query<DeliverableAuthoringContentRow>(
        `INSERT INTO deliverable_authoring_content (deliverable_id, schema_definition_id, content, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.deliverableId, input.schemaDefinitionId, JSON.stringify(input.content), input.authorId, input.authorBadge]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableAuthoringContentDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findByDeliverableId(deliverableId: string): Promise<DbResult<DeliverableAuthoringContentRow | null>> {
    try {
      const { rows } = await query<DeliverableAuthoringContentRow>(
        "SELECT * FROM deliverable_authoring_content WHERE deliverable_id = $1",
        [deliverableId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[deliverableAuthoringContentDB] findByDeliverableId error", err as Error);
      return { error: err as Error };
    }
  },

  async updateContent(deliverableId: string, content: Record<string, unknown>): Promise<DbResult<DeliverableAuthoringContentRow>> {
    try {
      const { rows } = await query<DeliverableAuthoringContentRow>(
        `UPDATE deliverable_authoring_content SET content = $1, updated_at = NOW() WHERE deliverable_id = $2 RETURNING *`,
        [JSON.stringify(content), deliverableId]
      );
      if (!rows[0]) return { error: new Error(`no authoring content row for deliverable ${deliverableId}`) };
      return { data: rows[0] };
    } catch (err) {
      logger.error("[deliverableAuthoringContentDB] updateContent error", err as Error);
      return { error: err as Error };
    }
  },
};
