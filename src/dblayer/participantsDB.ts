import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ParticipantRow, ParticipantType } from "./seuTypes.js";

export const participantsDB = {
  async create(input: { seuId: string; type: ParticipantType; displayName: string }): Promise<DbResult<ParticipantRow>> {
    try {
      const { rows } = await query<ParticipantRow>(
        `INSERT INTO participants (seu_id, type, display_name, state)
         VALUES ($1, $2, $3, 'Assigned')
         RETURNING *`,
        [input.seuId, input.type, input.displayName]
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
};
