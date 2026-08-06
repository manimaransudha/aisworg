import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, TransitionDefinitionRow, TransitionEntityType } from "./seuTypes.js";

export const transitionDefinitionsDB = {
  // SDK UI Layer Plan — a Transition Definition authored (or re-published)
  // through the SDK targets an (entityType, fromState, toState) triple by
  // this same upsert. Collision risk, not yet reconciled: seedSeu.ts's own
  // seedTransitionDefinitions re-asserts every triple listed in
  // transitionDefinitions.json on every `pnpm seed:seu` run — authoring a
  // Transition Definition for a triple that JSON file also seeds would get
  // silently reverted by the next reseed, the same class of bug already
  // found and fixed once for Deliverable's badge-model authority repoint
  // (see 014_sdk_authoring.sql's header / Open Design Questions.md). Safe
  // for any triple the JSON file doesn't cover; logged, not solved, for one
  // that collides.
  async upsert(input: {
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    requiredAuthorityRuleId?: string | null;
    requiredPolicyIds?: string[];
    requiredQualityGateIds?: string[];
    createsObligation?: string | null;
    category?: string | null;
  }): Promise<DbResult<TransitionDefinitionRow>> {
    try {
      const { rows } = await query<TransitionDefinitionRow>(
        `INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, required_quality_gate_ids, creates_obligation, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (entity_type, from_state, to_state) DO UPDATE
           SET required_authority_rule_id = EXCLUDED.required_authority_rule_id,
               required_policy_ids = EXCLUDED.required_policy_ids,
               required_quality_gate_ids = EXCLUDED.required_quality_gate_ids,
               creates_obligation = EXCLUDED.creates_obligation,
               category = EXCLUDED.category
         RETURNING *`,
        [
          input.entityType,
          input.fromState,
          input.toState,
          input.requiredAuthorityRuleId ?? null,
          input.requiredPolicyIds ?? [],
          input.requiredQualityGateIds ?? [],
          input.createsObligation ?? null,
          input.category ?? null,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async find(entityType: TransitionEntityType, fromState: string, toState: string): Promise<DbResult<TransitionDefinitionRow | null>> {
    try {
      const { rows } = await query<TransitionDefinitionRow>(
        "SELECT * FROM transition_definitions WHERE entity_type = $1 AND from_state = $2 AND to_state = $3",
        [entityType, fromState, toState]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] find error", err as Error);
      return { error: err as Error };
    }
  },

  // Drives the transition dropdown in the SEU detail page — every state a
  // Deliverable/SEU could move to from here, per what's actually declared in
  // the data, not hardcoded state names in a view.
  async findPossibleNextStates(entityType: TransitionEntityType, fromState: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ to_state: string }>(
        "SELECT to_state FROM transition_definitions WHERE entity_type = $1 AND from_state = $2 ORDER BY to_state",
        [entityType, fromState]
      );
      return { data: rows.map((r) => r.to_state) };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] findPossibleNextStates error", err as Error);
      return { error: err as Error };
    }
  },
};
