import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EvidenceRow, EvidenceRelationshipRow, EvidenceValidationAssessment, TransitionEntityType } from "./seuTypes.js";

// Ch.17 EM-002/FR-17.5: Evidence is immutable after acceptance. Deliberately
// no "update content" function here at all — create + lifecycle transition
// + append-only validation-assessment recording only, so immutability holds
// architecturally rather than needing a runtime check on every field.
//
// Ch.17 model cleanup (migration 232) — seu_id retired; SEU membership is
// now just one more evidence_relationships row (related_object_type =
// 'SEU'), same mechanism as everything else Evidence relates to.
export const evidenceDB = {
  async create(input: {
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    seuId: string;
    category: string;
    title: string;
    description?: string | null;
    source?: string | null;
    supersedesEvidenceId?: string | null;
  }): Promise<DbResult<EvidenceRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<EvidenceRow>(
        `INSERT INTO evidence (category, title, description, source, supersedes_evidence_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.category, input.title, input.description ?? null, input.source ?? null, input.supersedesEvidenceId ?? null]
      );
      const evidence = rows[0];
      await client.query(
        `INSERT INTO evidence_relationships (evidence_id, related_object_type, related_object_id) VALUES ($1, 'SEU', $2)`,
        [evidence.id, input.seuId]
      );
      if (input.relatedObjectType !== "SEU" || input.relatedObjectId !== input.seuId) {
        await client.query(
          `INSERT INTO evidence_relationships (evidence_id, related_object_type, related_object_id) VALUES ($1, $2, $3)
           ON CONFLICT ON CONSTRAINT evidence_relationships_unique DO NOTHING`,
          [evidence.id, input.relatedObjectType, input.relatedObjectId]
        );
      }
      await client.query("COMMIT");
      return { data: evidence };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[evidenceDB] create error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
    }
  },

  // Every relationship after the first (or the only relationship, for an
  // Evidence row created before this without one). Idempotent: re-linking
  // the same (evidence, object) pair is a no-op, not an error.
  async addRelationship(evidenceId: string, relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<EvidenceRelationshipRow | undefined>> {
    try {
      const { rows } = await query<EvidenceRelationshipRow>(
        `INSERT INTO evidence_relationships (evidence_id, related_object_type, related_object_id)
         VALUES ($1, $2, $3)
         ON CONFLICT ON CONSTRAINT evidence_relationships_unique DO NOTHING
         RETURNING *`,
        [evidenceId, relatedObjectType, relatedObjectId]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[evidenceDB] addRelationship error", err as Error);
      return { error: err as Error };
    }
  },

  // What one Evidence row currently supports — the display/UI shape.
  async findRelationshipsByEvidenceId(evidenceId: string): Promise<DbResult<EvidenceRelationshipRow[]>> {
    try {
      const { rows } = await query<EvidenceRelationshipRow>(
        "SELECT * FROM evidence_relationships WHERE evidence_id = $1 ORDER BY created_at",
        [evidenceId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findRelationshipsByEvidenceId error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<EvidenceRow | null>> {
    try {
      const { rows } = await query<EvidenceRow>("SELECT * FROM evidence WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[evidenceDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  // Public signature/behaviour unchanged — every existing caller
  // (qualityGateEngine.ts, dependencyDefinitionEngine.ts, traceability.ts)
  // needs no changes.
  async findByRelatedObject(relatedObjectType: TransitionEntityType, relatedObjectId: string): Promise<DbResult<EvidenceRow[]>> {
    try {
      const { rows } = await query<EvidenceRow>(
        `SELECT e.* FROM evidence e
         JOIN evidence_relationships r ON r.evidence_id = e.id
         WHERE r.related_object_type = $1 AND r.related_object_id = $2
         ORDER BY e.created_at`,
        [relatedObjectType, relatedObjectId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findByRelatedObject error", err as Error);
      return { error: err as Error };
    }
  },

  // seu_id retired (migration 232) — SEU membership is a relationship now,
  // same query shape findByRelatedObject already uses.
  async findBySeuId(seuId: string): Promise<DbResult<EvidenceRow[]>> {
    return evidenceDB.findByRelatedObject("SEU", seuId);
  },

  // Reverse lookup: what corrects this row (0 or more; no uniqueness
  // constraint on supersedes_evidence_id).
  async findSupersededBy(evidenceId: string): Promise<DbResult<EvidenceRow[]>> {
    try {
      const { rows } = await query<EvidenceRow>(
        "SELECT * FROM evidence WHERE supersedes_evidence_id = $1 ORDER BY created_at",
        [evidenceId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findSupersededBy error", err as Error);
      return { error: err as Error };
    }
  },

  // Every Evidence Item currently linked to any Deliverable owned by this
  // SEU, regardless of the Evidence's own origin. Needed so a cross-SEU-
  // shared Evidence Item is discoverable as a supersede-predecessor from the
  // CONSUMING SEU's own page, not just the originating one.
  async findLinkedToSeu(seuId: string): Promise<DbResult<EvidenceRow[]>> {
    try {
      const { rows } = await query<EvidenceRow>(
        `SELECT DISTINCT e.* FROM evidence e
         JOIN evidence_relationships r ON r.evidence_id = e.id
         JOIN deliverables d ON d.id = r.related_object_id AND r.related_object_type = 'Deliverable'
         WHERE d.seu_id = $1
         ORDER BY e.created_at`,
        [seuId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findLinkedToSeu error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: string): Promise<DbResult<EvidenceRow>> {
    try {
      const { rows } = await query<EvidenceRow>(
        "UPDATE evidence SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[evidenceDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  // Append-only: pushes one new assessment entry onto validation_dimensions
  // (never overwrites an existing entry) and recomputes confidence_level
  // from the full, updated set. Both happen in the same UPDATE so the two
  // never disagree.
  async appendValidationAssessment(id: string, assessment: EvidenceValidationAssessment, confidenceLevel: string | null): Promise<DbResult<EvidenceRow>> {
    try {
      const { rows } = await query<EvidenceRow>(
        `UPDATE evidence
            SET validation_dimensions = validation_dimensions || $1::jsonb,
                confidence_level = $2,
                updated_at = NOW()
          WHERE id = $3
          RETURNING *`,
        [JSON.stringify([assessment]), confidenceLevel, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[evidenceDB] appendValidationAssessment error", err as Error);
      return { error: err as Error };
    }
  },

  // Engineering Telemetry — Knowledge Telemetry's "Evidence generation."
  async count(seuId?: string): Promise<DbResult<number>> {
    try {
      const { rows } = seuId
        ? await query<{ count: string }>(
            `SELECT COUNT(DISTINCT e.id)::text AS count FROM evidence e
             JOIN evidence_relationships r ON r.evidence_id = e.id
             WHERE r.related_object_type = 'SEU' AND r.related_object_id = $1`,
            [seuId]
          )
        : await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM evidence", []);
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[evidenceDB] count error", err as Error);
      return { error: err as Error };
    }
  },
};
