import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateRow, TransitionEntityType } from "./seuTypes.js";

// CR-058 — a Quality Gate's identity is `code`, versioned exactly like
// Pack/Template/Profile's own (code, version) identity: a new row per
// version, never an in-place update, so history is preserved. version
// starts at "1.0" and bumps the minor component on every real content
// change (owner's own example: "moves to 1.4").
function bumpVersion(version: string): string {
  const [major, minor] = version.split(".").map((n) => parseInt(n, 10) || 0);
  return `${major}.${minor + 1}`;
}

export const qualityGatesDB = {
  // Transactional: reads the current active row for this code, decides
  // whether anything actually changed, and either no-ops, inserts the first
  // version, or deactivates the old row + inserts the next version — all in
  // one commit (same discipline as evidenceDB.create's 2-insert commit).
  // A genuine slot collision (a DIFFERENT code trying to become the active
  // gate for a (entity_type, from_state, to_state, category) tuple another
  // code already occupies) surfaces as a real constraint-violation error
  // here, not a silent overwrite — the partial unique index
  // quality_gates_active_scope_category_key enforces it.
  async upsert(input: {
    code: string;
    name: string;
    category?: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    criteria?: Record<string, unknown>;
    originatingPackId: string;
  }): Promise<DbResult<QualityGateRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const category = input.category ?? "Exit";
      const criteria = input.criteria ?? { type: "no_unresolved_obligations" };
      const { rows: currentRows } = await client.query<QualityGateRow>(
        "SELECT * FROM quality_gates WHERE code = $1 AND is_active = true",
        [input.code]
      );
      const current = currentRows[0];
      const unchanged =
        current &&
        current.name === input.name &&
        current.category === category &&
        current.entity_type === input.entityType &&
        current.from_state === input.fromState &&
        current.to_state === input.toState &&
        JSON.stringify(current.criteria) === JSON.stringify(criteria);
      if (unchanged) {
        await client.query("COMMIT");
        return { data: current };
      }
      const nextVersion = current ? bumpVersion(current.version) : "1.0";
      if (current) {
        await client.query("UPDATE quality_gates SET is_active = false WHERE id = $1", [current.id]);
      }
      const { rows } = await client.query<QualityGateRow>(
        `INSERT INTO quality_gates (code, name, category, entity_type, from_state, to_state, criteria, originating_pack_id, version, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         RETURNING *`,
        [input.code, input.name, category, input.entityType, input.fromState, input.toState, JSON.stringify(criteria), input.originatingPackId, nextVersion]
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
  // Resolves to the CURRENT active version of the code.
  //
  // CR-058 known limitation: an id captured this way (into
  // transition_definitions.required_quality_gate_ids) is a specific row —
  // if that gate is later superseded by a new version, the old row's
  // is_active flips false but the captured id still points at it, so this
  // reference path does not automatically pick up the new version. Real for
  // the ~4 synthetic rows that currently exercise this path (Ch.26 §19.7);
  // not solved here — the same class of "shell materialized once" question
  // CR-057 already flags as open, deliberately not re-opened by this CR.
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
