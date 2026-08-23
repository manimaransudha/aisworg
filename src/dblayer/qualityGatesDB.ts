import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateRow, TransitionEntityType } from "./seuTypes.js";

// CR-058 follow-up 2 — a Quality Gate's `code` always mirrors its
// `category` (owner: "the code isn't a UUID or a freeform Pack-specific
// string — it's the category identifier itself"). The real versioning
// identity is therefore the full slot: (entity_type, from_state, to_state,
// category). version starts at "1.0" and bumps the minor component on
// every real content change (owner's own example: "moves to 1.4").
function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const qualityGatesDB = {
  // Transactional: reads the current active row for this exact slot
  // (entity_type, from_state, to_state, category), decides whether anything
  // actually changed, and either no-ops, inserts the first version, or
  // deactivates the old row + inserts the next version — all in one commit
  // (same discipline as evidenceDB.create's 2-insert commit). The partial
  // unique index quality_gates_active_scope_category_key is what makes this
  // lookup unambiguous: at most one active row can ever exist per slot.
  async upsert(input: {
    name: string;
    category?: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    criteria?: Record<string, unknown>;
    originatingPackId: string;
    // CR-060 — real ids of Checklists this gate requires (AND across the
    // list). Not part of the change-detection identity below (a Checklist's
    // own content can change in place without bumping the referencing
    // gate's version — CR-060's own "it stays" decision), but real content
    // still needs to be written whenever it differs.
    checklistIds?: string[];
    // CR-060, revised same day — advisory Checklists; see
    // PackContributions.qualityGates' own recommendedChecklistIds comment.
    recommendedChecklistIds?: string[];
  }): Promise<DbResult<QualityGateRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const category = input.category ?? "Exit";
      const code = category;
      const criteria = input.criteria ?? { type: "no_unresolved_obligations" };
      const checklistIds = input.checklistIds ?? [];
      const recommendedChecklistIds = input.recommendedChecklistIds ?? [];
      const { rows: currentRows } = await client.query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3 AND category = $4 AND is_active = true",
        [input.entityType, input.fromState, input.toState, category]
      );
      const current = currentRows[0];
      const unchanged =
        current &&
        current.name === input.name &&
        JSON.stringify(current.criteria) === JSON.stringify(criteria) &&
        JSON.stringify([...current.checklist_ids].sort()) === JSON.stringify([...checklistIds].sort()) &&
        JSON.stringify([...current.recommended_checklist_ids].sort()) === JSON.stringify([...recommendedChecklistIds].sort());
      if (unchanged) {
        await client.query("COMMIT");
        return { data: current };
      }
      const nextVersion = current ? bumpVersion(current.version) : "1.0";
      if (current) {
        await client.query("UPDATE quality_gates SET is_active = false WHERE id = $1", [current.id]);
      }
      const { rows } = await client.query<QualityGateRow>(
        `INSERT INTO quality_gates (code, name, category, entity_type, from_state, to_state, criteria, originating_pack_id, version, is_active, checklist_ids, recommended_checklist_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
         RETURNING *`,
        [code, input.name, category, input.entityType, input.fromState, input.toState, JSON.stringify(criteria), input.originatingPackId, nextVersion, checklistIds, recommendedChecklistIds]
      );
      await client.query("COMMIT");
      return { data: rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[qualityGatesDB] upsert error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
    }
  },

  // CR-058 — a transition may now have several active gates (one per
  // category, owner: "one gate per category"), evaluated as an AND — same
  // first-blocking-wins semantics evaluateByIds already has for explicit
  // gate-id references.
  async findAllActive(entityType: TransitionEntityType, fromState: string, toState: string): Promise<DbResult<QualityGateRow[]>> {
    try {
      const { rows } = await query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE entity_type = $1 AND from_state = $2 AND to_state = $3 AND is_active = true",
        [entityType, fromState, toState]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findAllActive error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(): Promise<DbResult<QualityGateRow[]>> {
    try {
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates WHERE is_active = true ORDER BY name");
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  // SDK UI Layer Plan — Transition Definition's requiredQualityGateCodes[]
  // resolves codes to ids at publish time (findByCode), and
  // qualityGateEngine.evaluateByIds resolves those ids back at evaluation
  // time (findByIds) — explicit reference replacing the coincidental
  // (entityType, fromState, toState) match, per the plan's "Schema" decision.
  //
  // CR-058 follow-up 2 known limitation: `code` now mirrors `category`, which
  // is NOT globally unique (a "Review Evidence" gate can legitimately exist
  // on many different transitions) — this resolves to whichever ACTIVE gate
  // with that category happens to match first, ambiguous when more than one
  // does. Not solved here: per the Ch.26 §19.7 audit this whole reference
  // path (transition_definitions.required_quality_gate_ids) is already
  // barely used (~4 synthetic test rows, zero real production transitions —
  // the live enforcement path is qualityGateEngine.evaluate's own
  // findAllActive, scoped by transition automatically, no cross-reference
  // needed). Same "not re-opened by this CR" treatment as the version-
  // tracking limitation above.
  async findByCode(code: string): Promise<DbResult<QualityGateRow | null>> {
    try {
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates WHERE code = $1 AND is_active = true", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[qualityGatesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<QualityGateRow[]>> {
    try {
      if (ids.length === 0) return { data: [] };
      const { rows } = await query<QualityGateRow>("SELECT * FROM quality_gates WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGatesDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },
};
