import pool, { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult, ObjectiveCommentRow, ObjectiveRow, ObjectiveStatus, ObjectiveTier, SponsoringAuthority } from "./seuTypes.js";

// version is "n.n.n" (migration 124); every edit bumps the patch segment
// only — the exact same "every edit advances by one" behavior the old bare
// integer column had, just semver-shaped.
const BUMP_PATCH_SQL = "split_part(version, '.', 1) || '.' || split_part(version, '.', 2) || '.' || (split_part(version, '.', 3)::int + 1)::text";

// Also owns the objective_capabilities join table (Ch.1 §10 — MVP declares
// required Capabilities explicitly rather than deriving them from a
// "Capability Pack", a Book 3 concept Ch.5's own taxonomy never defines).
export const objectivesDB = {
  // CR-068 — assigns the new Objective's display_id atomically alongside the
  // INSERT, in the same transaction, so a rolled-back create never leaves a
  // segment issued with no row to show for it:
  //   - a child (has parentObjectiveId): its segment comes from the parent
  //     row's own next_child_seq counter, incremented via a single
  //     UPDATE ... RETURNING — the UPDATE's row lock on the parent is what
  //     serializes two children created under it at the same time, no
  //     SELECT ... FOR UPDATE needed.
  //   - a Strategic root: its segment is tenant-scoped (owner: "use the
  //     tenant_id ... indirectly related ... through the user that proposes
  //     it"), resolved via requestedBy -> users.tenant_id, then issued from
  //     objective_root_sequences (a root has no parent row of its own to hold
  //     a counter on) via the same atomic INSERT ... ON CONFLICT ... RETURNING
  //     idiom.
  //
  // CR-071 — sponsoring_authority is assigned in the same statements, at zero
  // extra query cost: a child copies its parent's own value (same RETURNING
  // clause that already fetches display_id); a root derives it fresh from the
  // same tenantId this function already resolves for its sequence counter.
  async create(input: {
    statement: string;
    tier?: ObjectiveTier;
    status?: ObjectiveStatus;
    parentObjectiveId?: string | null;
    // NOT NULL (migration 127) — required here too, not just on ObjectiveRow.
    requestedBy: number;
  }): Promise<DbResult<ObjectiveRow>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
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
        if (input.requestedBy == null) throw new Error("a Strategic (root) Objective needs a real requestedBy to resolve which tenant's sequence to number it under");
        const { rows: userRows } = await client.query<{ tenant_id: string }>("SELECT tenant_id FROM users WHERE id = $1", [input.requestedBy]);
        const tenantId = userRows[0]?.tenant_id;
        if (!tenantId) throw new Error(`cannot resolve a tenant for requestedBy user ${input.requestedBy}`);
        const { rows: seqRows } = await client.query<{ seq: number }>(
          `INSERT INTO objective_root_sequences (tenant_id, next_seq) VALUES ($1, 2)
           ON CONFLICT (tenant_id) DO UPDATE SET next_seq = objective_root_sequences.next_seq + 1
           RETURNING next_seq - 1 AS seq`,
          [tenantId]
        );
        displayId = String(seqRows[0].seq);
        sponsoringAuthority = { tenant: tenantId };
      }

      const { rows } = await client.query<ObjectiveRow>(
        `INSERT INTO objectives (statement, tier, status, parent_objective_id, requested_by, display_id, sponsoring_authority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.statement, input.tier ?? "Engineering", input.status ?? "Active", input.parentObjectiveId ?? null, input.requestedBy ?? null, displayId, JSON.stringify(sponsoringAuthority)]
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

  // CR-071 — tenantId omitted (undefined) means no filter (root/superuser
  // sees every tenant); a provided value (including null, for a session
  // that somehow resolved no tenant) filters and fails closed — `= NULL`
  // never matches any row in SQL, so that edge case returns zero rows rather
  // than silently falling through to "everything."
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

  // CR-009 — the one-shot commissioning path (commissionFromForm) needs a
  // Strategic root to hang its Engineering Objective under (bare Engineering
  // objectives are no longer allowed). It reuses a single well-known container
  // rather than minting a fresh root per SEU; this finds it by its sentinel
  // statement.
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

  // CR-009 tree — the parentless Strategic roots, one server-side page at a
  // time (there can be many). Browse mode paginates over these; each root is
  // then expanded via findChildren lazily.
  // CR-071 — tenantId omitted (undefined) means no filter (root/superuser
  // sees every tenant); a provided value filters and fails closed on a null
  // tenant, same reasoning as findAll above.
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

  // CR-073 — the proposer's "was rejected" filter/section on the existing
  // Objectives page (owner: "not a standalone page"). Reject is a real,
  // distinct status (owner: "It is Active to Reject"), reachable only via
  // Active -> Reject, which always fires ObjectiveRejected — so status alone
  // is the authoritative marker, no events-table join needed. Same
  // tenant-filter/pagination shape as findRootsPage.
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

  // CR-009 tree — how many direct children each of the given parents has, in a
  // single query. Drives leaf detection (leaf = 0 children → commissionable)
  // and the expand affordance, without an N+1 per node.
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

  // CR-009 re-parenting — every descendant id of `id` (transitive), so a move
  // can reject choosing the node itself or any descendant as its new parent
  // (cycle guard). Recursive CTE; excludes `id` itself.
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

  // CR-009 search — the ancestor chain root→node (exclusive of the node), so a
  // flat search hit can show its breadcrumb/path for context.
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

  // CR-009 re-parenting — moves only this node; its subtree comes with it
  // automatically (descendants already point at it). Accepts null only for a
  // Strategic root (the CHECK constraint enforces that invariant).
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

  // CR-068 — requestedBy heals a legacy null left over from creation
  // (COALESCE only ever fills in a currently-null value, it never overwrites
  // a real original requester with whoever happens to save the next edit).
  // Tier is deliberately not editable here (owner: "Edit should not change
  // the tier. This will cause utter confusion to the hierarchy") — tier is
  // fixed at creation and has no update path at all anymore.
  // bumpVersion (default true) — owner: "add a save without versioning. in
  // which case the current version carries over" — false leaves version
  // untouched instead of advancing its patch segment.
  async update(id: string, input: { statement?: string; requestedBy?: number | null; bumpVersion?: boolean }): Promise<DbResult<ObjectiveRow>> {
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

  async updateStatus(id: string, status: ObjectiveStatus): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        "UPDATE objectives SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] updateStatus error", err as Error);
      return { error: err as Error };
    }
  },

  async addCapabilities(objectiveId: string, capabilityIds: string[]): Promise<DbResult<void>> {
    try {
      for (const capabilityId of capabilityIds) {
        await query(
          `INSERT INTO objective_capabilities (objective_id, capability_id)
           VALUES ($1, $2)
           ON CONFLICT (objective_id, capability_id) DO NOTHING`,
          [objectiveId, capabilityId]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[objectivesDB] addCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  // Replaces the full required-Capability set for an edit (owner: "Allow
  // edit of required capabilities") — delete-then-insert, same "set"
  // idiom as profilesDB.setPackSelection/templatesDB.setMandatoryPacks.
  async setRequiredCapabilities(objectiveId: string, capabilityIds: string[]): Promise<DbResult<void>> {
    try {
      await query("DELETE FROM objective_capabilities WHERE objective_id = $1", [objectiveId]);
      for (const capabilityId of capabilityIds) {
        await query(
          `INSERT INTO objective_capabilities (objective_id, capability_id)
           VALUES ($1, $2)
           ON CONFLICT (objective_id, capability_id) DO NOTHING`,
          [objectiveId, capabilityId]
        );
      }
      return { data: undefined };
    } catch (err) {
      logger.error("[objectivesDB] setRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-012 — hard delete of a Proposed leaf Objective. Only ever called for an
  // Objective with no children and no SEU (the core enforces both), so the only
  // dependent rows are its objective_capabilities links; remove those first,
  // then the row. Idempotent-safe (a missing id deletes nothing).
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

  async getRequiredCapabilities(objectiveId: string): Promise<DbResult<CapabilityRow[]>> {
    try {
      const { rows } = await query<CapabilityRow>(
        `SELECT c.* FROM capabilities c
         JOIN objective_capabilities oc ON oc.capability_id = c.id
         WHERE oc.objective_id = $1
         ORDER BY c.code`,
        [objectiveId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[objectivesDB] getRequiredCapabilities error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-073 — general-purpose, append-only comment thread. Never updated or
  // deleted at the application layer; oldest first (a narrative history, not
  // an activity feed).
  async addComment(objectiveId: string, actorId: number | null, commentText: string): Promise<DbResult<ObjectiveCommentRow>> {
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
