import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

export interface DemoStepRow {
  id: string;
  tenant_id: string;
  code: string;
  kind: string;
  area: string;
  title: string;
  description: string | null;
  annotation: string | null;
  target: Record<string, unknown>;
  payload: Record<string, unknown>;
  enabled: boolean;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export const demoStepsDB = {
  async upsert(input: {
    tenantId: string;
    code: string;
    kind: string;
    area: string;
    title: string;
    description?: string | null;
    annotation?: string | null;
    target?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    enabled?: boolean;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DemoStepRow>> {
    try {
      const { rows } = await query<DemoStepRow>(
        `INSERT INTO demo_steps (tenant_id, code, kind, area, title, description, annotation, target, payload, enabled, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (code, tenant_id) DO UPDATE
           SET kind = EXCLUDED.kind, area = EXCLUDED.area, title = EXCLUDED.title, description = EXCLUDED.description, annotation = EXCLUDED.annotation,
               target = EXCLUDED.target, payload = EXCLUDED.payload, enabled = EXCLUDED.enabled, updated_at = NOW()
         RETURNING *`,
        [
          input.tenantId, input.code, input.kind, input.area, input.title, input.description ?? null, input.annotation ?? null,
          JSON.stringify(input.target ?? {}), JSON.stringify(input.payload ?? {}),
          input.enabled ?? true, input.authorId, input.authorBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[demoStepsDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  async insertMany(rows: Array<{
    tenantId: string;
    code: string;
    kind: string;
    area: string;
    title: string;
    description?: string | null;
    annotation?: string | null;
    target?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    enabled?: boolean;
    authorId: string;
    authorBadge: string;
  }>): Promise<DbResult<DemoStepRow[]>> {
    if (rows.length === 0) return { data: [] };
    try {
      const values: unknown[] = [];
      const tuples = rows.map((r, i) => {
        values.push(r.tenantId, r.code, r.kind, r.area, r.title, r.description ?? null, r.annotation ?? null,
          JSON.stringify(r.target ?? {}), JSON.stringify(r.payload ?? {}), r.enabled ?? true, r.authorId, r.authorBadge);
        const o = i * 12;
        return `(${Array.from({ length: 12 }, (_, j) => `$${o + j + 1}`).join(", ")})`;
      });
      const { rows: inserted } = await query<DemoStepRow>(
        `INSERT INTO demo_steps (tenant_id, code, kind, area, title, description, annotation, target, payload, enabled, author_id, author_badge)
         VALUES ${tuples.join(", ")} RETURNING *`,
        values
      );
      return { data: inserted };
    } catch (err) {
      logger.error("[demoStepsDB] insertMany error", err as Error);
      return { error: err as Error };
    }
  },

  async findByTenant(tenantId: string, opts: { enabledOnly?: boolean } = {}): Promise<DbResult<DemoStepRow[]>> {
    try {
      const { rows } = await query<DemoStepRow>(
        `SELECT * FROM demo_steps WHERE tenant_id = $1 ${opts.enabledOnly ? "AND enabled = TRUE" : ""} ORDER BY code`,
        [tenantId]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[demoStepsDB] findByTenant error", err as Error);
      return { error: err as Error };
    }
  },

  async findByCode(tenantId: string, code: string): Promise<DbResult<DemoStepRow | null>> {
    try {
      const { rows } = await query<DemoStepRow>("SELECT * FROM demo_steps WHERE tenant_id = $1 AND code = $2", [tenantId, code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoStepsDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async setEnabled(tenantId: string, code: string, enabled: boolean): Promise<DbResult<DemoStepRow | null>> {
    try {
      const { rows } = await query<DemoStepRow>(
        "UPDATE demo_steps SET enabled = $3, updated_at = NOW() WHERE tenant_id = $1 AND code = $2 RETURNING *",
        [tenantId, code, enabled]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoStepsDB] setEnabled error", err as Error);
      return { error: err as Error };
    }
  },

  async insert(input: {
    tenantId: string;
    code: string;
    kind: string;
    area: string;
    title: string;
    description: string | null;
    annotation: string | null;
    target: Record<string, unknown>;
    payload: Record<string, unknown>;
    authorId: string;
    authorBadge: string;
  }): Promise<DbResult<DemoStepRow>> {
    try {
      const { rows } = await query<DemoStepRow>(
        `INSERT INTO demo_steps (tenant_id, code, kind, area, title, description, annotation, target, payload, author_id, author_badge)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          input.tenantId, input.code, input.kind, input.area, input.title, input.description, input.annotation,
          JSON.stringify(input.target), JSON.stringify(input.payload),
          input.authorId, input.authorBadge,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[demoStepsDB] insert error", err as Error);
      return { error: err as Error };
    }
  },

  async update(tenantId: string, code: string, input: {
    code: string;
    kind: string;
    title: string;
    description: string | null;
    annotation: string | null;
    target: Record<string, unknown>;
    payload: Record<string, unknown>;
  }): Promise<DbResult<DemoStepRow | null>> {
    try {
      const { rows } = await query<DemoStepRow>(
        `UPDATE demo_steps SET kind = $3, title = $4, description = $5, annotation = $6,
                target = $7, payload = $8, code = $9, updated_at = NOW()
         WHERE tenant_id = $1 AND code = $2 RETURNING *`,
        [
          tenantId, code, input.kind, input.title, input.description, input.annotation,
          JSON.stringify(input.target), JSON.stringify(input.payload), input.code,
        ]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[demoStepsDB] update error", err as Error);
      return { error: err as Error };
    }
  },
};
