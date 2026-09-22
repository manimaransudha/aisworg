// CR-110 — Route Authority: which badge(s)/role(s) a route requires, as data
// instead of a literal baked into the route file. See
// design/change-requests/CR-110-route-authority-table.md.
//
// This module is the one real write path for the route_authority table
// (the CRUD screen in web/routeAuthorityRegistry.ts is its only caller) —
// no other code should write to this table directly.
import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";

export interface RouteAuthorityRow {
  id: string;
  method: string;
  path: string;
  badges: string[];
  roles: string[];
  match_mode: "all" | "any";
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type DbResult<T> = { data?: T; error?: Error };

export const routeAuthorityDB = {
  async findAll(): Promise<DbResult<RouteAuthorityRow[]>> {
    try {
      const { rows } = await query<RouteAuthorityRow>("SELECT * FROM route_authority ORDER BY path, method");
      return { data: rows };
    } catch (err) {
      logger.error("[routeAuthorityDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },

  async findById(id: string): Promise<DbResult<RouteAuthorityRow | null>> {
    try {
      const { rows } = await query<RouteAuthorityRow>("SELECT * FROM route_authority WHERE id = $1", [id]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[routeAuthorityDB] findById error", err as Error);
      return { error: err as Error };
    }
  },

  async create(input: { method: string; path: string; badges: string[]; roles: string[]; matchMode: "all" | "any"; description: string | null }): Promise<DbResult<RouteAuthorityRow>> {
    try {
      const { rows } = await query<RouteAuthorityRow>(
        `INSERT INTO route_authority (method, path, badges, roles, match_mode, description)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [input.method, input.path, input.badges, input.roles, input.matchMode, input.description]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[routeAuthorityDB] create error", err as Error);
      return { error: err as Error };
    }
  },

  async update(id: string, input: { method: string; path: string; badges: string[]; roles: string[]; matchMode: "all" | "any"; description: string | null }): Promise<DbResult<RouteAuthorityRow>> {
    try {
      const { rows } = await query<RouteAuthorityRow>(
        `UPDATE route_authority SET method = $2, path = $3, badges = $4, roles = $5, match_mode = $6, description = $7, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, input.method, input.path, input.badges, input.roles, input.matchMode, input.description]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[routeAuthorityDB] update error", err as Error);
      return { error: err as Error };
    }
  },

  async delete(id: string): Promise<DbResult<null>> {
    try {
      await query("DELETE FROM route_authority WHERE id = $1", [id]);
      return { data: null };
    } catch (err) {
      logger.error("[routeAuthorityDB] delete error", err as Error);
      return { error: err as Error };
    }
  },
};
