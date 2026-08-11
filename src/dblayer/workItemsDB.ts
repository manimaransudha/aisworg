import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, OutstandingWorkItemDetail, WorkItemRow, WorkItemStatus } from "./seuTypes.js";

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

  // Participant Integration & Attestation — Plan step 4: the deadline handed to
  // the Participant at assignment. The DEFAULT is NOW() + the Capability's
  // turnaround SLA (seconds); computed in the DB so it uses the server clock.
  async setTargetCompletion(id: string, slaSeconds: number): Promise<DbResult<WorkItemRow>> {
    try {
      const { rows } = await query<WorkItemRow>(
        "UPDATE work_items SET target_completion_at = NOW() + ($1 * INTERVAL '1 second'), updated_at = NOW() WHERE id = $2 RETURNING *",
        [slaSeconds, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[workItemsDB] setTargetCompletion error", err as Error);
      return { error: err as Error };
    }
  },

  // The assigner may OVERRIDE the SLA-derived default with an explicit target
  // date/time at assignment.
  async setTargetCompletionAt(id: string, at: Date): Promise<DbResult<WorkItemRow>> {
    try {
      const { rows } = await query<WorkItemRow>(
        "UPDATE work_items SET target_completion_at = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [at, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[workItemsDB] setTargetCompletionAt error", err as Error);
      return { error: err as Error };
    }
  },

  // Participant Integration & Attestation — Plan step 4: the stall sweep, as one
  // set-based query. Returns only outstanding (Dispatched) Work Items whose
  // committed target has already passed — nothing else is scanned (partial
  // index on target_completion_at). `now` is a parameter so tests are
  // deterministic; `seuId` optionally bounds it to one SEU.
  async findOverdue(now: Date, seuId?: string): Promise<DbResult<WorkItemRow[]>> {
    try {
      const { rows } = seuId
        ? await query<WorkItemRow>(
            `SELECT wi.* FROM work_items wi
             JOIN commands c ON c.id = wi.command_id
             WHERE wi.status = 'Dispatched' AND wi.target_completion_at IS NOT NULL
               AND wi.target_completion_at < $1 AND c.seu_id = $2
             ORDER BY wi.target_completion_at ASC`,
            [now, seuId]
          )
        : await query<WorkItemRow>(
            `SELECT * FROM work_items
             WHERE status = 'Dispatched' AND target_completion_at IS NOT NULL AND target_completion_at < $1
             ORDER BY target_completion_at ASC`,
            [now]
          );
      return { data: rows };
    } catch (err) {
      logger.error("[workItemsDB] findOverdue error", err as Error);
      return { error: err as Error };
    }
  },

  // Participant Integration — Plan step 5: the outstanding Work Items in a SEU,
  // enriched with the Deliverable + transition they drive, for the human-on-UI
  // work queue. Bounded to one SEU.
  async findOutstandingBySeuDetailed(seuId: string): Promise<DbResult<OutstandingWorkItemDetail[]>> {
    try {
      const { rows } = await query<OutstandingWorkItemDetail>(
        `SELECT wi.id, c.seu_id, d.id AS deliverable_id, d.name AS deliverable_name,
                d.producing_capability_id, c.from_state, c.to_state,
                wi.participant_id, wi.target_completion_at, wi.created_at
         FROM work_items wi
         JOIN commands c ON c.id = wi.command_id AND c.entity_type = 'Deliverable'
         JOIN deliverables d ON d.id = c.entity_id
         WHERE wi.status = 'Dispatched' AND c.seu_id = $1
         ORDER BY wi.created_at DESC`,
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[workItemsDB] findOutstandingBySeuDetailed error", err as Error);
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
