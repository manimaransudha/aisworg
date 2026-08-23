import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ReviewGateRow, TransitionEntityType } from "./seuTypes.js";

// CR-059 — a Review Gate's identity is (entity_type, from_state, to_state,
// code), `code` being the deliverable type it's for (owner: "the review
// gate's key collapses to (deliverable-type code, entity_type, from_state,
// to_state) — the same materialization key everything else uses"). No
// category, no criteria — unlike Quality Gate, there's nothing to
// union-compose across Packs (a Review is one reviewer's verdict on one
// deliverable version, not several competing kinds of it). version starts
// at "1.0" and bumps the minor component on every real content change, same
// discipline qualityGatesDB.upsert already established.
function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const reviewGatesDB = {
  // Transactional: reads the current active row for this exact slot
  // (entity_type, from_state, to_state, code), decides whether anything
  // actually changed, and either no-ops, inserts the first version, or
  // deactivates the old row + inserts the next version — all in one commit,
  // same shape as qualityGatesDB.upsert. The partial unique index
  // review_gates_active_scope_key is what makes this lookup unambiguous.
  async upsert(input: {
    code: string;
    name: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    originatingPackId: string;
    // CR-060 — see qualityGatesDB.upsert's own checklistIds comment.
    checklistIds?: string[];
    // CR-060, revised same day — see qualityGatesDB.upsert's own
    // recommendedChecklistIds comment.
    recommendedChecklistIds?: string[];
  }): Promise<DbResult<ReviewGateRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const checklistIds = input.checklistIds ?? [];
      const recommendedChecklistIds = input.recommendedChecklistIds ?? [];
      const { rows: currentRows } = await client.query<ReviewGateRow>(
        "SELECT * FROM review_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3 AND code = $4 AND is_active = true",
        [input.entityType, input.fromState, input.toState, input.code]
      );
      const current = currentRows[0];
      const unchanged =
        current &&
        current.name === input.name &&
        JSON.stringify([...current.checklist_ids].sort()) === JSON.stringify([...checklistIds].sort()) &&
        JSON.stringify([...current.recommended_checklist_ids].sort()) === JSON.stringify([...recommendedChecklistIds].sort());
      if (unchanged) {
        await client.query("COMMIT");
        return { data: current };
      }
      const nextVersion = current ? bumpVersion(current.version) : "1.0";
      if (current) {
        await client.query("UPDATE review_gates SET is_active = false WHERE id = $1", [current.id]);
      }
      const { rows } = await client.query<ReviewGateRow>(
        `INSERT INTO review_gates (code, name, entity_type, from_state, to_state, originating_pack_id, version, is_active, checklist_ids, recommended_checklist_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
         RETURNING *`,
        [input.code, input.name, input.entityType, input.fromState, input.toState, input.originatingPackId, nextVersion, checklistIds, recommendedChecklistIds]
      );
      await client.query("COMMIT");
      return { data: rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[reviewGatesDB] upsert error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
    }
  },

  async findById(id: string): Promise<DbResult<ReviewGateRow | null>> {
    try {
      const { rows } = await query<ReviewGateRow>("SELECT * FROM review_gates WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[reviewGatesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<ReviewGateRow[]>> {
    try {
      const { rows } = await query<ReviewGateRow>("SELECT * FROM review_gates WHERE is_active = true ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[reviewGatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
