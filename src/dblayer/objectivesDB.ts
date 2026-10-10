import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult, ObjectiveCommentRow, ObjectiveRow, ObjectiveStatus, ObjectiveTier, SponsoringAuthority } from "./seuTypes.js";

const BUMP_PATCH_SQL = "split_part(version, '.', 1) || '.' || split_part(version, '.', 2) || '.' || (split_part(version, '.', 3)::int + 1)::text";

export const objectivesDB = {
  async create(input: {
    statement: string;
    tier?: ObjectiveTier;
    status?: ObjectiveStatus;
    parentObjectiveId?: string | null;
    requestedBy: string;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<ObjectiveRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (input.requestedBy == null) throw new Error("an Objective must be attributed to a real requestedBy — this can never be null");
      if (!input.authorBadge) throw new Error("creating an Objective requires authorBadge — this can never be null");
      let displayId: string;
      let sponsoringAuthority: SponsoringAuthority;

      if (input.parentObjectiveId) {
        const { rows: parentRows } = await client.query<{ seq: number; parent_display_id: string | null; parent_sponsoring_authority: SponsoringAuthority | null }>(
          `UPDATE objectives SET next_child_seq = next_child_seq + 1
           WHERE id = $1
           RETURNING next_child_seq - 1 AS seq, display_id AS parent_display_id, sponsoring_authority AS parent_sponsoring_authority`,
          [input.parentObjectiveId]
        );
        const parent = parentRows[0];
        if (!parent) throw new Error(`parent Objective not found: ${input.parentObjectiveId}`);
        if (!parent.parent_display_id) throw new Error(`parent Objective ${input.parentObjectiveId} has no display_id of its own yet (predates CR-068 — run db:clean-slate to reseed)`);
        displayId = `${parent.parent_display_id}.${parent.seq}`;
        sponsoringAuthority = parent.parent_sponsoring_authority ?? { tenant: null };
      } else {
        if (!input.authorId || !input.authorBadge) throw new Error("creating a root Objective requires authorId/authorBadge — this can never be null");
        const { rows: participantRows } = await client.query<{ tenant_id: string }>("SELECT tenant_id FROM participants_master WHERE id = $1", [input.requestedBy]);
        const tenantId = participantRows[0]?.tenant_id;
        if (!tenantId) throw new Error(`cannot resolve a tenant for requestedBy participant ${input.requestedBy}`);
        const { rows: seqRows } = await client.query<{ seq: number }>(
          `INSERT INTO objective_root_sequences (tenant_id, next_seq, author_id, author_badge) VALUES ($1, 2, $2, $3)
           ON CONFLICT (tenant_id) DO UPDATE SET next_seq = objective_root_sequences.next_seq + 1, author_id = $2, author_badge = $3
           RETURNING next_seq - 1 AS seq`,
          [tenantId, input.authorId, input.authorBadge]
        );
        displayId = String(seqRows[0].seq);
        sponsoringAuthority = { tenant: tenantId };
      }

      const { rows } = await client.query<ObjectiveRow>(
        `INSERT INTO objectives (statement, tier, status, parent_objective_id, requested_by, display_id, sponsoring_authority, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [input.statement, input.tier ?? "Engineering", input.status ?? "Active", input.parentObjectiveId ?? null, input.requestedBy, displayId, JSON.stringify(sponsoringAuthority), input.authorBadge]
      );
      await client.query("COMMIT");
      return { data: rows[0] };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[objectivesDB] create error", err as Error);
      return { error: err as Error };
    } finally {
      client.release();
    }
  },

  async findById(id: string): Promise<DbResult<ObjectiveRow | null>> {
    try {
      const { rows } = await query<ObjectiveRow>("SELECT * FROM objectives WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[objectivesDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async findAll(tenantId?: string | null): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } =
        tenantId === undefined
          ? await query<ObjectiveRow>("SELECT * FROM objectives ORDER BY created_at DESC")
          : await query<ObjectiveRow>("SELECT * FROM objectives WHERE sponsoring_authority->>'tenant' = $1 ORDER BY created_at DESC", [tenantId]);
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findStrategicByStatement(statement: string): Promise<DbResult<ObjectiveRow | null>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "SELECT * FROM objectives WHERE tier = 'Strategic' AND statement = $1 ORDER BY created_at LIMIT 1",
        [statement]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[objectivesDB] findStrategicByStatement error", err as Error);
      return { error: err as Error };
    }
  },

  async findByStatuses(statuses: ObjectiveStatus[]): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "SELECT * FROM objectives WHERE status = ANY($1::text[]) ORDER BY created_at DESC",
        [statuses]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findByStatuses error", err as Error);
      return { error: err as Error };
    }
  },

  async findChildren(parentObjectiveId: string): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "SELECT * FROM objectives WHERE parent_objective_id = $1 ORDER BY created_at",
        [parentObjectiveId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findChildren error", err as Error);
      return { error: err as Error };
    }
  },

  async findRootsPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<DbResult<{ items: ObjectiveRow[]; total: number }>> {
    try {
      const noFilter = opts.tenantId === undefined;
      const countRes = noFilter
        ? await query<{ n: number }>("SELECT count(*)::int AS n FROM objectives WHERE parent_objective_id IS NULL")
        : await query<{ n: number }>("SELECT count(*)::int AS n FROM objectives WHERE parent_objective_id IS NULL AND sponsoring_authority->>'tenant' = $1", [opts.tenantId]);
      const { rows } = noFilter
        ? await query<ObjectiveRow>("SELECT * FROM objectives WHERE parent_objective_id IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2", [opts.limit, opts.offset])
        : await query<ObjectiveRow>(
            "SELECT * FROM objectives WHERE parent_objective_id IS NULL AND sponsoring_authority->>'tenant' = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            [opts.tenantId, opts.limit, opts.offset]
          );
      return { data: { items: rows, total: countRes.rows[0]?.n ?? 0 } };
    } catch (err) {
      logger.error("[objectivesDB] findRootsPage error", err as Error);
      return { error: err as Error };
    }
  },

  async findRejectedPage(opts: { limit: number; offset: number; tenantId?: string | null }): Promise<DbResult<{ items: ObjectiveRow[]; total: number }>> {
    try {
      const noFilter = opts.tenantId === undefined;
      const countRes = noFilter
        ? await query<{ n: number }>("SELECT count(*)::int AS n FROM objectives WHERE status = 'Reject'")
        : await query<{ n: number }>("SELECT count(*)::int AS n FROM objectives WHERE status = 'Reject' AND sponsoring_authority->>'tenant' = $1", [opts.tenantId]);
      const { rows } = noFilter
        ? await query<ObjectiveRow>("SELECT * FROM objectives WHERE status = 'Reject' ORDER BY updated_at DESC LIMIT $1 OFFSET $2", [opts.limit, opts.offset])
        : await query<ObjectiveRow>(
            "SELECT * FROM objectives WHERE status = 'Reject' AND sponsoring_authority->>'tenant' = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
            [opts.tenantId, opts.limit, opts.offset]
          );
      return { data: { items: rows, total: countRes.rows[0]?.n ?? 0 } };
    } catch (err) {
      logger.error("[objectivesDB] findRejectedPage error", err as Error);
      return { error: err as Error };
    }
  },

  async childCounts(parentIds: string[]): Promise<DbResult<Map<string, number>>> {
    try {
      const map = new Map<string, number>();
      if (parentIds.length === 0) return { data: map };
      const { rows } = await query<{ parent_objective_id: string; n: number }>(
        `SELECT parent_objective_id, count(*)::int AS n
         FROM objectives
         WHERE parent_objective_id = ANY($1::uuid[])
         GROUP BY parent_objective_id`,
        [parentIds]
      );
      for (const r of rows) map.set(r.parent_objective_id, r.n);
      return { data: map };
    } catch (err) {
      logger.error("[objectivesDB] childCounts error", err as Error);
      return { error: err as Error };
    }
  },

  async findDescendantIds(id: string): Promise<DbResult<string[]>> {
    try {
      const { rows } = await query<{ id: string }>(
        `WITH RECURSIVE subtree AS (
           SELECT id FROM objectives WHERE parent_objective_id = $1
           UNION ALL
           SELECT o.id FROM objectives o JOIN subtree s ON o.parent_objective_id = s.id
         )
         SELECT id FROM subtree`,
        [id]
      );
      return { data: rows.map((r) => r.id) };
    } catch (err) {
      logger.error("[objectivesDB] findDescendantIds error", err as Error);
      return { error: err as Error };
    }
  },

  async findAncestorPath(id: string): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow & { depth: number }>(
        `WITH RECURSIVE chain AS (
           SELECT o.*, 0 AS depth FROM objectives o WHERE o.id = $1
           UNION ALL
           SELECT p.*, c.depth + 1 FROM objectives p JOIN chain c ON p.id = c.parent_objective_id
         )
         SELECT * FROM chain WHERE id <> $1 ORDER BY depth DESC`,
        [id]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] findAncestorPath error", err as Error);
      return { error: err as Error };
    }
  },

  async updateParent(id: string, parentObjectiveId: string | null): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `UPDATE objectives
         SET parent_objective_id = $1, version = ${BUMP_PATCH_SQL}, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [parentObjectiveId, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] updateParent error", err as Error);
      return { error: err as Error };
    }
  },

  async update(id: string, input: { statement?: string; requestedBy: string; bumpVersion?: boolean }): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `UPDATE objectives
         SET statement = COALESCE($1, statement),
             requested_by = COALESCE(requested_by, $2),
             version = ${input.bumpVersion === false ? "version" : BUMP_PATCH_SQL},
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [input.statement ?? null, input.requestedBy ?? null, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] update error", err as Error);
      return { error: err as Error };
    }
  },

  async updateStatus(id: string, status: ObjectiveStatus, supersedingObjectiveId?: string): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "UPDATE objectives SET status = $1, superseding_objective_id = COALESCE($3, superseding_objective_id), updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id, supersedingObjectiveId ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async addCapabilities(objectiveId: string, capabilityCodes: string[], authorId?: string, authorBadge?: string): Promise<DbResult<void>> {
    try {
      if (capabilityCodes.length > 0 && (!authorId || !authorBadge)) {
        throw new Error("addCapabilities: authorId/authorBadge are required when capabilityCodes is non-empty");
      }
      for (const code of capabilityCodes) {
        await query(
          `INSERT INTO objective_capabilities (objective_id, capability_code, author_id, author_badge)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (objective_id, capability_code) DO NOTHING`,
          [objectiveId, code, authorId, authorBadge]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[objectivesDB] addCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async setRequiredCapabilities(objectiveId: string, capabilityCodes: string[], authorId?: string, authorBadge?: string): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM objective_capabilities WHERE objective_id = $1", [objectiveId]);
      if (capabilityCodes.length > 0 && (!authorId || !authorBadge)) {
        throw new Error("setRequiredCapabilities: authorId/authorBadge are required when capabilityCodes is non-empty");
      }
      for (const code of capabilityCodes) {
        await query(
          `INSERT INTO objective_capabilities (objective_id, capability_code, author_id, author_badge)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (objective_id, capability_code) DO NOTHING`,
          [objectiveId, code, authorId, authorBadge]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[objectivesDB] setRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async delete(id: string): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM objective_capabilities WHERE objective_id = $1", [id]);
      await query("DELETE FROM objectives WHERE id = $1", [id]);
      return { data: undefined };
    } catch (err) {
      logger.error("[objectivesDB] delete error", err as Error);
      return { error: err as Error };
    }
  },

  async getRequiredCapabilities(objectiveId: string): Promise<DbResult<{ code: string }[]>> {
    try {
      const { rows } = await query<{ code: string }>(
        `SELECT capability_code AS code FROM objective_capabilities WHERE objective_id = $1 ORDER BY capability_code`,
        [objectiveId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] getRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  async addComment(objectiveId: string, actorId: string, commentText: string): Promise<DbResult<ObjectiveCommentRow>> {
    try {
      const { rows } = await query<ObjectiveCommentRow>(
        `INSERT INTO objective_comments (objective_id, actor_id, comment_text)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [objectiveId, actorId, commentText]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] addComment error", err as Error);
      return { error: err as Error };
    }
  },

  async getComments(objectiveId: string): Promise<DbResult<ObjectiveCommentRow[]>> {
    try {
      const { rows } = await query<ObjectiveCommentRow>(
        "SELECT * FROM objective_comments WHERE objective_id = $1 ORDER BY created_at",
        [objectiveId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] getComments error", err as Error);
      return { error: err as Error };
    }
  },
};
