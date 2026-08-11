import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CommandRow, CommandStatus, DbResult, TransitionEntityType } from "./seuTypes.js";

export const commandsDB = {
  async create(input: {
    seuId: string;
    entityType: TransitionEntityType;
    entityId: string;
    commandType: string;
    fromState: string;
    toState: string;
    requestedBy: number | null;
    // Participant Integration & Attestation — Plan step 2: the authority that
    // drove this transition, resolved at dispatch and carried so the acceptance
    // attestation can record who certified the state (completeWorkItem).
    actingBadgeGrantId?: string | null;
    correlationId: string;
  }): Promise<DbResult<CommandRow>> {
    try {
      const { rows } = await query<CommandRow>(
        `INSERT INTO commands (seu_id, entity_type, entity_id, command_type, from_state, to_state, requested_by, acting_badge_grant_id, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [input.seuId, input.entityType, input.entityId, input.commandType, input.fromState, input.toState, input.requestedBy, input.actingBadgeGrantId ?? null, input.correlationId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[commandsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: CommandStatus): Promise<DbResult<CommandRow>> {
    try {
      const { rows } = await query<CommandRow>(
        "UPDATE commands SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[commandsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<CommandRow | null>> {
    try {
      const { rows } = await query<CommandRow>("SELECT * FROM commands WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[commandsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<CommandRow[]>> {
    try {
      const { rows } = await query<CommandRow>("SELECT * FROM commands WHERE seu_id = $1 ORDER BY created_at DESC", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[commandsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },
};
