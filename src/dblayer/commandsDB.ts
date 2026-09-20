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
    // CR-109 §6.2 — governanceOutcomeRef: the governance_evaluation_outcomes
    // row the passing evaluation built (executionEngine.execute() inserts
    // it first, then passes its id here). Null for command types that don't
    // route through evaluateDeliverableTransition.
    governanceOutcomeId?: string | null;
    // Ch.12 §9 / CR-109 §6.2 — eligibleParticipantPoolRef: the
    // capability_fulfilment_pools snapshot execute() took of the real
    // eligible-Participant pool for this Command's producing Capability.
    // Null when no producing Capability was declared at all.
    eligibleParticipantPoolId?: string | null;
  }): Promise<DbResult<CommandRow>> {
    try {
      const { rows } = await query<CommandRow>(
        `INSERT INTO commands (seu_id, entity_type, entity_id, command_type, from_state, to_state, requested_by, acting_badge_grant_id, correlation_id, governance_outcome_id, eligible_participant_pool_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [input.seuId, input.entityType, input.entityId, input.commandType, input.fromState, input.toState, input.requestedBy, input.actingBadgeGrantId ?? null, input.correlationId, input.governanceOutcomeId ?? null, input.eligibleParticipantPoolId ?? null]
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

  // Duplicate-dispatch guard: a re-attempt of the same (entityType, entityId,
  // fromState, toState) hop while an earlier attempt is still non-terminal
  // (Generated/Dispatched/Deferred) would otherwise generate a second
  // Command/Work Item/Dispatch for work already underway. Completed/
  // Cancelled/Failed are terminal — a new attempt after one of those is a
  // genuinely new hop, not a duplicate.
  async findInFlight(entityType: TransitionEntityType, entityId: string, fromState: string, toState: string): Promise<DbResult<CommandRow | null>> {
    try {
      const { rows } = await query<CommandRow>(
        `SELECT * FROM commands
         WHERE entity_type = $1 AND entity_id = $2 AND from_state = $3 AND to_state = $4
           AND status IN ('Generated', 'Dispatched', 'Deferred')
         ORDER BY created_at DESC LIMIT 1`,
        [entityType, entityId, fromState, toState]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[commandsDB] findInFlight error", err as Error);
      return { error: err as Error };
    }
  },
};
