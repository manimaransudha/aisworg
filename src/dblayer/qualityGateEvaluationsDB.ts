import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, QualityGateEvaluationRow, QualityGateLatencyRow, QualityGateOutcomeValue, ReworkRow, TransitionEntityType } from "./seuTypes.js";

export const qualityGateEvaluationsDB = {
  async create(input: {
    qualityGateId: string;
    seuId: string;
    entityType: TransitionEntityType;
    entityId: string;
    outcome: QualityGateOutcomeValue;
    detail?: Record<string, unknown>;
  }): Promise<DbResult<QualityGateEvaluationRow>> {
    try {
      const { rows } = await query<QualityGateEvaluationRow>(
        `INSERT INTO quality_gate_evaluations (quality_gate_id, seu_id, entity_type, entity_id, outcome, detail)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.qualityGateId, input.seuId, input.entityType, input.entityId, input.outcome, JSON.stringify(input.detail ?? {})]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[qualityGateEvaluationsDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async findBySeuId(seuId: string): Promise<DbResult<QualityGateEvaluationRow[]>> {
    try {
      const { rows } = await query<QualityGateEvaluationRow>(
        "SELECT * FROM quality_gate_evaluations WHERE seu_id = $1 ORDER BY evaluated_at DESC",
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateEvaluationsDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.35 §7 Governance Telemetry — "Quality Gate latency": how long a
  // (gate, entity) pair sat Blocked before it finally Passed. Zero when it
  // passed on the first attempt (no friction). Platform-wide by default —
  // Engineering Telemetry — Plan, Build order step 2: seuId narrows to one
  // SEU when passed, a filter on rows that already carried seu_id, not new
  // data collection.
  async findLatencies(seuId?: string): Promise<DbResult<QualityGateLatencyRow[]>> {
    try {
      const { rows } = await query<QualityGateLatencyRow>(
        `SELECT
           qge.quality_gate_id,
           qg.name AS gate_name,
           qge.entity_id,
           qge.seu_id,
           MIN(qge.evaluated_at) FILTER (WHERE qge.outcome = 'Blocked') AS first_blocked_at,
           MIN(qge.evaluated_at) FILTER (WHERE qge.outcome = 'Passed') AS passed_at,
           EXTRACT(EPOCH FROM (
             MIN(qge.evaluated_at) FILTER (WHERE qge.outcome = 'Passed')
             - COALESCE(MIN(qge.evaluated_at) FILTER (WHERE qge.outcome = 'Blocked'), MIN(qge.evaluated_at) FILTER (WHERE qge.outcome = 'Passed'))
           )) AS latency_seconds
         FROM quality_gate_evaluations qge
         JOIN quality_gates qg ON qg.id = qge.quality_gate_id
         WHERE $1::uuid IS NULL OR qge.seu_id = $1
         GROUP BY qge.quality_gate_id, qg.name, qge.entity_id, qge.seu_id
         HAVING MIN(qge.evaluated_at) FILTER (WHERE qge.outcome = 'Passed') IS NOT NULL
         ORDER BY latency_seconds DESC`,
        [seuId ?? null]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[qualityGateEvaluationsDB] findLatencies error", err as Error);
      return { error: err as Error };
    }
  },

  // Engineering Telemetry — Plan, Build order step 6 — Quality Telemetry's
  // "rework rate": how many Blocked evaluations (across any gate) an entity
  // accumulated before its eventual Pass. Only entities that eventually
  // Passed at least one gate are counted — same "only what actually
  // completed the step" discipline findLatencies already uses.
  async findReworkByEntity(seuId?: string): Promise<DbResult<ReworkRow[]>> {
    try {
      const { rows } = await query<{ entity_type: string; entity_id: string; seu_id: string; blocked_count: string }>(
        `SELECT
           entity_type, entity_id, seu_id,
           COUNT(*) FILTER (WHERE outcome = 'Blocked')::text AS blocked_count
         FROM quality_gate_evaluations
         WHERE $1::uuid IS NULL OR seu_id = $1
         GROUP BY entity_type, entity_id, seu_id
         HAVING COUNT(*) FILTER (WHERE outcome = 'Passed') > 0
         ORDER BY blocked_count DESC`,
        [seuId ?? null]
      );
      return { data: rows.map((r) => ({ entity_type: r.entity_type, entity_id: r.entity_id, seu_id: r.seu_id, blocked_count: Number(r.blocked_count) })) };
    } catch (err) {
      logger.error("[qualityGateEvaluationsDB] findReworkByEntity error", err as Error);
      return { error: err as Error };
    }
  },

  // Ch.35 §11 sustained-pattern detection input — scoped to one SEU
  // deliberately (see core/telemetry.ts for why: the resulting Obligation
  // attaches to one SEU/Deliverable, so the count that triggers it must too).
  async countBlocked(qualityGateId: string, seuId: string): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM quality_gate_evaluations WHERE quality_gate_id = $1 AND seu_id = $2 AND outcome = 'Blocked'",
        [qualityGateId, seuId]
      );
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[qualityGateEvaluationsDB] countBlocked error", err as Error);
      return { error: err as Error };
    }
  },
};
