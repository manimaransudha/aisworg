import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { userDB } from "./userDB.js";
import type { DbResult, ParticipantRow, ParticipantType } from "./seuTypes.js";

export const participantsDB = {
  async create(input: { seuId: string; type: ParticipantType; displayName: string; participantId?: string | null }): Promise<DbResult<ParticipantRow>> {
    try {
      const { actorId, actorBadge } = await userDB.getSuperuserId();
      const { rows } = await query<ParticipantRow>(
        `INSERT INTO participants (seu_id, type, display_name, participant_id, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.seuId, input.type, input.displayName, input.participantId ?? null, actorId, actorBadge]
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

  async findByParticipantMasterId(participantMasterId: string): Promise<DbResult<ParticipantRow[]>> {
    try {
      const { rows } = await query<ParticipantRow>("SELECT * FROM participants WHERE participant_id = $1 ORDER BY created_at DESC", [participantMasterId]);
      return { data: rows };
    } catch (err) {
      logger.error("[participantsDB] findByParticipantMasterId error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuIdAndParticipantMasterId(seuId: string, participantMasterId: string): Promise<DbResult<ParticipantRow | null>> {
    try {
      const { rows } = await query<ParticipantRow>(
        "SELECT * FROM participants WHERE seu_id = $1 AND participant_id = $2 ORDER BY created_at DESC LIMIT 1",
        [seuId, participantMasterId]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[participantsDB] findBySeuIdAndParticipantMasterId error", err as Error);
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
