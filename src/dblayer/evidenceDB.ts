import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, EvidenceRow, EvidenceRelationshipRow, TransitionEntityType } from "./seuTypes.js";

// Ch.17 EM-002/FR-17.5: Evidence is immutable after acceptance. Deliberately
// no "update content" function here at all — create + lifecycle transition
// only, so immutability holds architecturally rather than needing a runtime
// check on every field.
//
// CR-051 item 1 (Ch.17 §20.2/§20.8) — related_object_type/id moved off
// `evidence` onto `evidence_relationships`: one Evidence Item may support
// many engineering artefacts, not just one. `create`'s own public shape is
// unchanged (still takes a single relatedObjectType/relatedObjectId — the
// common case, one relationship at creation time); `addRelationship` is the
// new entry point for every relationship after the first.
export const evidenceDB = {
  async create(input: {
    seuId: string;
    relatedObjectType: TransitionEntityType;
    relatedObjectId: string;
    category: string;
    title: string;
    description?: string | null;
    source?: string | null;
    confidenceLevel?: string;
    originatingDeliverableId?: string | null;
    originatingParticipantId?: string | null;
    originatingCapabilityId?: string | null;
    originatingDecisionId?: string | null;
    originatingActivity?: string | null;
    supersedesEvidenceId?: string | null;
  }): Promise<DbResult<EvidenceRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<EvidenceRow>(
        `INSERT INTO evidence (seu_id, category, title, description, source, confidence_level, originating_deliverable_id, originating_participant_id, originating_capability_id, originating_decision_id, originating_activity, supersedes_evidence_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.seuId,
          input.category,
          input.title,
          input.description ?? null,
          input.source ?? null,
          input.confidenceLevel ?? "Medium",
          input.originatingDeliverableId ?? null,
          input.originatingParticipantId ?? null,
          input.originatingCapabilityId ?? null,
          input.originatingDecisionId ?? null,
          input.originatingActivity ?? null,
          input.supersedesEvidenceId ?? null,
        ]
      );
      const evidence = rows[0];
      await client.query(
        `INSERT INTO evidence_relationships (evidence_id, related_object_type, related_object_id) VALUES ($1, $2, $3)`,
        [evidence.id, input.relatedObjectType, input.relatedObjectId]
      );
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

  // CR-051 item 1 — every relationship after the first (or the only
  // relationship, for an Evidence row created before this without one — not
  // expected in practice, but not assumed either). Idempotent: re-linking
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

  // CR-051 item 1 — reimplemented as a join; public signature/behaviour
  // unchanged, so every existing caller (qualityGateEngine.ts,
  // dependencyDefinitionEngine.ts, traceability.ts) needs no changes at all.
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

  async findBySeuId(seuId: string): Promise<DbResult<EvidenceRow[]>> {
    try {
      const { rows } = await query<EvidenceRow>("SELECT * FROM evidence WHERE seu_id = $1 ORDER BY created_at", [seuId]);
      return { data: rows };
    } catch (err) {
      logger.error("[evidenceDB] findBySeuId error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-051 item 4 (Ch.17 §15/§20.13) — reverse lookup: what corrects this
  // row (0 or more; no uniqueness constraint on supersedes_evidence_id).
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

  // CR-051 item 4 — every Evidence Item currently linked to any Deliverable
  // owned by this SEU, regardless of the Evidence's own origin (seu_id).
  // Needed so a cross-SEU-shared Evidence Item (item 2) is discoverable as a
  // supersede-predecessor from the CONSUMING SEU's own page, not just the
  // originating one — findBySeuId alone can't see it, since it filters by
  // origin, not by relationship.
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

  // Engineering Telemetry — Plan, Build order step 4 — Knowledge Telemetry's
  // "Evidence generation."
  async count(seuId?: string): Promise<DbResult<number>> {
    try {
      const { rows } = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM evidence WHERE $1::uuid IS NULL OR seu_id = $1",
        [seuId ?? null]
      );
      return { data: Number(rows[0]?.count ?? 0) };
    } catch (err) {
      logger.error("[evidenceDB] count error", err as Error);
      return { error: err as Error };
    }
  },
};
