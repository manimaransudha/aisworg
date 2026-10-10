import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { AttentionItemRow, DbResult } from "./seuTypes.js";

export const attentionItemsDB = {
  async create(input: {
    seuId: string;
    category: string;
    priority?: string;
    title: string;
    description?: string | null;
    relatedObjectType?: string | null;
    relatedObjectId?: string | null;
    triggeringEventId?: string | null;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<AttentionItemRow>> {
    try {
      const { rows } = await query<AttentionItemRow>(
        `INSERT INTO attention_items (seu_id, category, priority, title, description, related_object_type, related_object_id, triggering_event_id, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.seuId,
          input.category,
          input.priority ?? "Medium",
          input.title,
          input.description ?? null,
          input.relatedObjectType ?? null,
          input.relatedObjectId ?? null,
          input.triggeringEventId ?? null,
          input.authorId,
          input.authorBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[attentionItemsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<AttentionItemRow | null>> {
    try {
      const { rows } = await query<AttentionItemRow>("SELECT * FROM attention_items WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[attentionItemsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<AttentionItemRow[]>> {
    try {
      const { rows } = await query<AttentionItemRow>("SELECT * FROM attention_items WHERE seu_id = $1 ORDER BY created_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[attentionItemsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<AttentionItemRow[]>> {
    try {
      const { rows } = await query<AttentionItemRow>("SELECT * FROM attention_items ORDER BY created_at DESC");
      return { data: rows };
    } catch (err) {
      logger.error("[attentionItemsDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findOpenByRelatedObject(seuId: string, category: string, relatedObjectType: string, relatedObjectId: string): Promise<DbResult<AttentionItemRow | null>> {
    try {
      const { rows } = await query<AttentionItemRow>(
        `SELECT * FROM attention_items
         WHERE seu_id = $1 AND category = $2 AND related_object_type = $3 AND related_object_id = $4
           AND status NOT IN ('Resolved', 'Closed')
         ORDER BY created_at DESC LIMIT 1`,
        [seuId, category, relatedObjectType, relatedObjectId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[attentionItemsDB] findOpenByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  async findOpenByRelatedObjectAny(relatedObjectType: string, relatedObjectId: string): Promise<DbResult<AttentionItemRow[]>> {
    try {
      const { rows } = await query<AttentionItemRow>(
        `SELECT * FROM attention_items
         WHERE related_object_type = $1 AND related_object_id = $2 AND status NOT IN ('Resolved', 'Closed')
         ORDER BY created_at DESC`,
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[attentionItemsDB] findOpenByRelatedObjectAny error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<AttentionItemRow>> {
    try {
      const { rows } = await query<AttentionItemRow>(
        "UPDATE attention_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[attentionItemsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
