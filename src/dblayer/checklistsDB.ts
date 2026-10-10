import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { ChecklistItem, ChecklistRow, DbResult } from "./seuTypes.js";

export const checklistsDB = {
  async upsert(input: {
    name: string;
    description?: string;
    items: ChecklistItem[];
    originatingPackId: string;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<ChecklistRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<ChecklistRow>(
        `INSERT INTO checklists (name, description, items, originating_pack_id, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (originating_pack_id, name)
         DO UPDATE SET description = EXCLUDED.description, items = EXCLUDED.items, updated_at = NOW()
         RETURNING *`,
        [input.name, input.description ?? null, JSON.stringify(input.items), input.originatingPackId, input.authorId, input.authorBadge]
      );
      await client.query("COMMIT");
      return { data: rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[checklistsDB] upsert error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
    }
  },

  async findById(id: string): Promise<DbResult<ChecklistRow | null>> {
    try {
      const { rows } = await query<ChecklistRow>("SELECT * FROM checklists WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[checklistsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<ChecklistRow[]>> {
    if (ids.length === 0) return { data: [] };
    try {
      const { rows } = await query<ChecklistRow>("SELECT * FROM checklists WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[checklistsDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findByPackCode(packCode: string): Promise<DbResult<Array<ChecklistRow & { pack_name: string; pack_code: string }>>> {
    try {
      const { rows } = await query<ChecklistRow & { pack_name: string; pack_code: string }>(
        `SELECT c.*, p.name AS pack_name, p.code AS pack_code
         FROM checklists c
         JOIN packs p ON p.id = c.originating_pack_id
         WHERE p.code = $1
         ORDER BY p.name, c.name`,
        [packCode]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[checklistsDB] findByPackCode error", err as Error);
      return { error: err as Error };
    }
  },

  async deleteByOriginatingPackIds(packIds: string[]): Promise<DbResult<number>> {
    if (packIds.length === 0) return { data: 0 };
    try {
      const result = await query("DELETE FROM checklists WHERE originating_pack_id = ANY($1::uuid[])", [packIds]);
      return { data: result.rowCount ?? 0 };
    } catch (err) {
      logger.error("[checklistsDB] deleteByOriginatingPackIds error", err as Error);
      return { error: err as Error };
    }
  },
};
