import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { ChecklistItem, ChecklistRow, DbResult } from "./seuTypes.js";

// CR-060 — Checklist has no version/lifecycle of its own (Ch.47 §16, as the
// owner edited it: "nothing outside its own Pack ever holds a stable
// reference to a specific Checklist" describes model reach, not a ban on a
// real table). upsert keeps the row's own `id` stable across every republish
// of its originating Pack, keyed by (originating_pack_id, name) — owner:
// "It stays... Someone wants to update the checklist with a new item, they
// can without a version change." No deactivate-old/insert-new-version
// dance like qualityGatesDB/reviewGatesDB — just update in place.
export const checklistsDB = {
  async upsert(input: {
    name: string;
    description?: string;
    asset?: string;
    items: ChecklistItem[];
    originatingPackId: string;
  }): Promise<DbResult<ChecklistRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<ChecklistRow>(
        `INSERT INTO checklists (name, description, asset, items, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (originating_pack_id, name)
         DO UPDATE SET description = EXCLUDED.description, asset = EXCLUDED.asset, items = EXCLUDED.items, updated_at = NOW()
         RETURNING *`,
        [input.name, input.description ?? null, input.asset ?? null, JSON.stringify(input.items), input.originatingPackId]
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

  // Corrected reach (owner, catching the original build's over-broad
  // reading of "same reach as Policy": "any Pack's gate can point at any
  // Pack's checklist - i thought we said this is if the pack codes match.
  // If checklists are global, then we would have created a registry?").
  // Policy's reach is genuinely unconstrained AND has its own global,
  // registry-like code namespace (policiesDB.findByCode); Checklist has
  // neither — deliberately no registry (Ch.47 §16/§20). So the real scope
  // is narrower: every Checklist belonging to a Pack sharing the SAME
  // `code` as the Pack being authored — different versions/tenant
  // instances of what's conceptually one Pack, not the whole platform.
  // `packs.code` is not unique on its own (CR-026's own
  // (code, pack_version, tenant_id) constraint) — that recurrence across
  // rows is exactly why matching by code is the right, natural scope here.
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
