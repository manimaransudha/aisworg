import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, TransitionDefinitionRow, TransitionEntityType } from "./seuTypes.js";

// CR-007: a readable view of a live transition_definitions row — the authority
// rule resolved to its code + required badge/role, and policy/quality-gate
// counts, for the "current definitions" surface.
export interface TransitionDefinitionListRow {
  id: string;
  entity_type: string;
  from_state: string;
  to_state: string;
  verb: string | null;
  is_active: boolean;
  retired_at: string | null;
  authority_rule_code: string | null;
  required_badge_type: string | null;
  authorised_role: string | null;
  policy_count: number;
  quality_gate_count: number;
  creates_obligation: string | null;
  category: string | null;
}

export const transitionDefinitionsDB = {
  // CR-007: every current Transition Definition, with its authority rule
  // resolved, for the Transition Definition Authoring "current state" view.
  async listAll(): Promise<DbResult<TransitionDefinitionListRow[]>> {
    try {
      const { rows } = await query<TransitionDefinitionListRow>(
        `SELECT td.id, td.entity_type, td.from_state, td.to_state, td.verb, td.is_active, td.retired_at,
                ar.code AS authority_rule_code,
                ar.required_badge_type,
                ar.authorised_role,
                COALESCE(array_length(td.required_policy_ids, 1), 0) AS policy_count,
                COALESCE(array_length(td.required_quality_gate_ids, 1), 0) AS quality_gate_count,
                td.creates_obligation, td.category
         FROM transition_definitions td
         LEFT JOIN authority_rules ar ON ar.id = td.required_authority_rule_id
         ORDER BY td.entity_type, td.from_state, td.to_state`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] listAll error", err as Error);
      return { error: err as Error };
    }
  },

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
  //
  // NOTE (CR-007 Step 2, owner 2026-08-13): retiring a transition currently
  // only marks it (is_active + retired_at) for the management view — the actual
  // traversal semantics (grandfathering an SEU whose creation predates
  // retired_at; excluding retired edges here and in find) are DEFERRED, since
  // that refinement also touches Template/Profile cleanup. So this still lists
  // all declared edges for now; retired_at is captured for that later work.
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

  // CR-071 — findPossibleNextStates only names the target state, not the verb
  // that gates it, so a caller that needs to check "does the viewer hold the
  // noun_verb badge for this specific option" (transitionEngine's own
  // `${entityType}_${verb}` convention) can't derive it from that alone. A new,
  // additive function — findPossibleNextStates itself is used by 16+ callers
  // across most entity types; widening its return type there risks all of
  // them for a need only Objective's own detail page has today.
  // CR-072 — also returns trigger/submitVerb: a manual transition with a
  // defined submit_verb needs its own from_state submitted (triggerEngine)
  // before it's a real option, not just the viewer's own badge.
  async findPossibleNextTransitions(entityType: TransitionEntityType, fromState: string): Promise<DbResult<Array<{ toState: string; verb: string | null; trigger: "manual" | "governed"; submitVerb: string | null }>>> {
    try {
      const { rows } = await query<{ to_state: string; verb: string | null; trigger: "manual" | "governed"; submit_verb: string | null }>(
        "SELECT to_state, verb, trigger, submit_verb FROM transition_definitions WHERE entity_type = $1 AND from_state = $2 ORDER BY to_state",
        [entityType, fromState]
      );
      return { data: rows.map((r) => ({ toState: r.to_state, verb: r.verb, trigger: r.trigger, submitVerb: r.submit_verb })) };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] findPossibleNextTransitions error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-007 Step 2 — full detail of one transition definition (resolved policy
  // & quality-gate codes, authority rule code, verb), for the view-detail page.
  async findDetailById(id: string): Promise<DbResult<TransitionDefinitionDetailRow | null>> {
    try {
      const { rows } = await query<TransitionDefinitionDetailRow>(
        `SELECT td.id, td.entity_type, td.from_state, td.to_state, td.verb, td.is_active, td.retired_at,
                td.creates_obligation, td.category,
                ar.code AS authority_rule_code,
                COALESCE((SELECT array_agg(p.code ORDER BY p.code) FROM policies p WHERE p.id = ANY(td.required_policy_ids)), '{}') AS policy_codes,
                COALESCE((SELECT array_agg(q.code ORDER BY q.code) FROM quality_gates q WHERE q.id = ANY(td.required_quality_gate_ids)), '{}') AS quality_gate_codes
         FROM transition_definitions td
         LEFT JOIN authority_rules ar ON ar.id = td.required_authority_rule_id
         WHERE td.id = $1`,
        [id]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] findDetailById error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-007 Step 2 — add a transition definition (a new noun/from/to edge with a
  // verb). Re-adding a retired triple reactivates it and updates its verb —
  // trigger is deliberately NOT in that DO UPDATE SET list, so reactivating
  // an existing row never overwrites whatever trigger it already carries;
  // `trigger` here only ever seeds a genuinely NEW row (the mapping's own
  // default_trigger, resolved by the caller).
  async insertDefinition(input: {
    entityType: string;
    fromState: string;
    toState: string;
    verb: string;
    trigger?: "manual" | "governed";
    requiredAuthorityRuleId?: string | null;
    requiredPolicyIds?: string[];
  }): Promise<DbResult<{ id: string }>> {
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO transition_definitions (entity_type, from_state, to_state, verb, trigger, required_authority_rule_id, required_policy_ids, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[], TRUE)
         ON CONFLICT (entity_type, from_state, to_state) DO UPDATE
           SET verb = EXCLUDED.verb, is_active = TRUE, retired_at = NULL
         RETURNING id`,
        [input.entityType, input.fromState, input.toState, input.verb, input.trigger ?? "manual", input.requiredAuthorityRuleId ?? null, input.requiredPolicyIds ?? []]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] insertDefinition error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-007 Step 2 — soft-retire (never delete). The row stays; it drops out of
  // the add-pickers and is greyed in the management view. retired_at records
  // WHEN, for the later SEU-creation-date grandfathering refinement (traversal
  // semantics deferred — see findPossibleNextStates note).
  async retireById(id: string): Promise<DbResult<{ id: string } | null>> {
    try {
      const { rows } = await query<{ id: string }>(
        "UPDATE transition_definitions SET is_active = FALSE, retired_at = NOW() WHERE id = $1 RETURNING id",
        [id]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] retireById error", err as Error);
      return { error: err as Error };
    }
  },

  // Edit action (list had View/Retire/Add but no way to change an existing
  // row) — deliberately narrow: entity_type/from_state/to_state are this
  // row's identity (never renamed, same "never delete/rename" convention as
  // Add/Retire) and verb is governed by the Mapping tab, not this. Touches
  // only the two fields that are still live, freely-editable metadata —
  // creates_obligation and category — leaving required_authority_rule_id/
  // required_policy_ids/required_quality_gate_ids (the retiring CR-006
  // mechanism, display-only per detail.ejs's own "(legacy)" label) untouched
  // rather than risk clearing them via a lossy round trip through upsert()'s
  // resolved-code-to-id path.
  async updateMetadata(id: string, input: { createsObligation: string | null; category: string | null }): Promise<DbResult<{ id: string } | null>> {
    try {
      const { rows } = await query<{ id: string }>(
        "UPDATE transition_definitions SET creates_obligation = $2, category = $3 WHERE id = $1 RETURNING id",
        [id, input.createsObligation, input.category]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[transitionDefinitionsDB] updateMetadata error", err as Error);
      return { error: err as Error };
    }
  },
};

// CR-007 Step 2 — full detail shape for the view-detail page.
export interface TransitionDefinitionDetailRow {
  id: string;
  entity_type: string;
  from_state: string;
  to_state: string;
  verb: string | null;
  is_active: boolean;
  retired_at: string | null;
  creates_obligation: string | null;
  category: string | null;
  authority_rule_code: string | null;
  policy_codes: string[];
  quality_gate_codes: string[];
}
