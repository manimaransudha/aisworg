import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ParticipantRow, ParticipantType } from "./seuTypes.js";

export const participantsDB = {
  // Participant Lifecycle Governance — Plan, Build order step 1: relies on
  // the column's own DEFAULT 'Available' instead of a hardcoded literal —
  // matching evidenceDB.create/obligationsDB.create's shape, neither of
  // which lists status/state in its own INSERT column list either. A
  // Participant becomes eligible for a Capability (fulfilCapability, Ch.12)
  // at Available, per Ch.13 §10 — not pre-assigned to anything; the real
  // Assigned transition belongs to dispatchEngine (step 3).
  async create(input: { seuId: string; type: ParticipantType; displayName: string; userId?: number | null }): Promise<DbResult<ParticipantRow>> {
    try {
      const { rows } = await query<ParticipantRow>(
        `INSERT INTO participants (seu_id, type, display_name, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.seuId, input.type, input.displayName, input.userId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[participantsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<ParticipantRow | null>> {
    try {
      const { rows } = await query<ParticipantRow>("SELECT * FROM participants WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[participantsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<ParticipantRow[]>> {
    try {
      const { rows } = await query<ParticipantRow>("SELECT * FROM participants WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[participantsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, state: string): Promise<DbResult<ParticipantRow>> {
    try {
      const { rows } = await query<ParticipantRow>(
        "UPDATE participants SET state = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [state, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[participantsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },
};
