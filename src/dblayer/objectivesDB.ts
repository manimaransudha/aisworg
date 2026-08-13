import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { CapabilityRow, DbResult, ObjectiveRow, ObjectiveStatus, ObjectiveTier } from "./seuTypes.js";

// Also owns the objective_capabilities join table (Ch.1 §10 — MVP declares
// required Capabilities explicitly rather than deriving them from a
// "Capability Pack", a Book 3 concept Ch.5's own taxonomy never defines).
export const objectivesDB = {
  async create(input: {
    statement: string;
    tier?: ObjectiveTier;
    status?: ObjectiveStatus;
    parentObjectiveId?: string | null;
    requestedBy?: number | null;
  }): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `INSERT INTO objectives (statement, tier, status, parent_objective_id, requested_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.statement, input.tier ?? "Engineering", input.status ?? "Active", input.parentObjectiveId ?? null, input.requestedBy ?? null]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[objectivesDB] create error", err as Error);
      return { error: err as Error };
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

  async findAll(): Promise<DbResult<ObjectiveRow[]>> {
    try {
      const { rows } = await query<ObjectiveRow>("SELECT * FROM objectives ORDER BY created_at DESC");
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
  async findRootsPage(opts: { limit: number; offset: number }): Promise<DbResult<{ items: ObjectiveRow[]; total: number }>> {
    try {
      const countRes = await query<{ n: number }>(
        "SELECT count(*)::int AS n FROM objectives WHERE parent_objective_id IS NULL"
      );
      const { rows } = await query<ObjectiveRow>(
        "SELECT * FROM objectives WHERE parent_objective_id IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [opts.limit, opts.offset]
      );
      return { data: { items: rows, total: countRes.rows[0]?.n ?? 0 } };
    } catch (err) {
      logger.error("[objectivesDB] findRootsPage error", err as Error);
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
         SET parent_objective_id = $1, version = version + 1, updated_at = NOW()
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

  async update(id: string, input: { statement?: string; tier?: ObjectiveTier }): Promise<DbResult<ObjectiveRow>> {
    try {
      const { rows } = await query<ObjectiveRow>(
        `UPDATE objectives
         SET statement = COALESCE($1, statement),
             tier = COALESCE($2, tier),
             version = version + 1,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [input.statement ?? null, input.tier ?? null, id]
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
};
