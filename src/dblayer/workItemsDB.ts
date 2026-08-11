import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, WorkItemRow, WorkItemStatus } from "./seuTypes.js";

export const workItemsDB = {
  async create(input: { commandId: string }): Promise<DbResult<WorkItemRow>> {
    try {
      const { rows } = await query<WorkItemRow>(
        "INSERT INTO work_items (command_id) VALUES ($1) RETURNING *",
        [input.commandId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[workItemsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async assign(id: string, participantId: string | null, dispatchStrategy: string): Promise<DbResult<WorkItemRow>> {
    try {
      const { rows } = await query<WorkItemRow>(
        "UPDATE work_items SET participant_id = $1, dispatch_strategy = $2, status = 'Assigned', updated_at = NOW() WHERE id = $3 RETURNING *",
        [participantId, dispatchStrategy, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[workItemsDB] assign error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: WorkItemStatus): Promise<DbResult<WorkItemRow>> {
    try {
      const { rows } = await query<WorkItemRow>(
        "UPDATE work_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[workItemsDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<WorkItemRow | null>> {
    try {
      const { rows } = await query<WorkItemRow>("SELECT * FROM work_items WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[workItemsDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // Participant Integration — Plan step 1: the raw VCS reference a Participant
  // returns on completion.
  async setOutputReference(id: string, outputReference: string | null): Promise<DbResult<WorkItemRow>> {
    try {
      const { rows } = await query<WorkItemRow>(
        "UPDATE work_items SET output_reference = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [outputReference, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[workItemsDB] setOutputReference error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCommandIds(commandIds: string[]): Promise<DbResult<WorkItemRow[]>> {
    if (commandIds.length === 0) return { data: [] };
    try {
      const { rows } = await query<WorkItemRow>("SELECT * FROM work_items WHERE command_id = ANY($1::uuid[]) ORDER BY created_at DESC", [commandIds]);
      return { data: rows };
    } catch (err) {
      logger.error("[workItemsDB] findByCommandIds error", err as Error);
      return { error: err as Error };
    }
  },
};
