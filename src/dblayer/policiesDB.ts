import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { ConstraintType, DbResult, PolicyRow } from "./seuTypes.js";

export const policiesDB = {
  // CR-061 — Policy's definition is tied to its own Pack, not global (owner:
  // "it is not global so no versioning required similar to checklist") —
  // identity is (originating_pack_id, code), not a bare globally-unique
  // code (migration 106). Upsert keeps a Policy's id stable across every
  // republish of its own Pack, same mechanism checklistsDB.upsert uses.
  async upsert(input: {
    code: string;
    name: string;
    category?: string;
    constraintType?: ConstraintType;
    governedTransition: string;
    condition?: Record<string, unknown>;
    severity?: string;
    originatingPackId: string;
  }): Promise<DbResult<PolicyRow>> {
    try {
      const { rows } = await query<PolicyRow>(
        `INSERT INTO policies (code, name, category, constraint_type, governed_transition, condition, severity, originating_pack_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (originating_pack_id, code) DO UPDATE
           SET name = EXCLUDED.name, category = EXCLUDED.category, constraint_type = EXCLUDED.constraint_type,
               governed_transition = EXCLUDED.governed_transition, condition = EXCLUDED.condition,
               severity = EXCLUDED.severity
         RETURNING *`,
        [
          input.code,
          input.name,
          input.category ?? "Engineering",
          input.constraintType ?? "Policy",
          input.governedTransition,
          JSON.stringify(input.condition ?? { type: "always_true" }),
          input.severity ?? "Medium",
          input.originatingPackId,
        ]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[policiesDB] upsert error", err as Error);
      return { error: err as Error };
    }
  },

  // SDK UI Layer Plan — Transition Definition authoring resolves policy
  // codes to ids at publish time, same pattern as requiredAuthorityRuleCode.
  // CR-061 note, not fixed here (definition-side CR; this call site is
  // execution/authoring-adjacent, out of scope — owner: "we are not
  // addressing this here"): `code` is no longer globally unique
  // (migration 106), so this can now match the wrong row if more than one
  // Pack happens to share the same Policy code. Real, latent risk; left
  // alone deliberately rather than expanded into scope this CR didn't ask
  // for.
  async findByCode(code: string): Promise<DbResult<PolicyRow | null>> {
    try {
      const { rows } = await query<PolicyRow>("SELECT * FROM policies WHERE code = $1", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[policiesDB] findByCode error", err as Error);
      return { error: err as Error };
    }
  },

  async findByIds(ids: string[]): Promise<DbResult<PolicyRow[]>> {
    try {
      if (ids.length === 0) return { data: [] };
      const { rows } = await query<PolicyRow>("SELECT * FROM policies WHERE id = ANY($1::uuid[])", [ids]);
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findByIds error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-061 — cross-Pack picker source, scoped to Policies belonging to a
  // Pack sharing the given Pack `code` (owner: "Similar to checklist, if
  // the pack code matches, that policy has to be visible to all other
  // packs") — same shape as checklistsDB.findByPackCode.
  async findByPackCode(packCode: string): Promise<DbResult<Array<PolicyRow & { pack_name: string; pack_code: string }>>> {
    try {
      const { rows } = await query<PolicyRow & { pack_name: string; pack_code: string }>(
        `SELECT p.*, pk.name AS pack_name, pk.code AS pack_code
         FROM policies p
         JOIN packs pk ON pk.id = p.originating_pack_id
         WHERE pk.code = $1
         ORDER BY pk.name, p.name`,
        [packCode]
      );
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findByPackCode error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-058 — the policy-code referential source for Quality Gate's new
  // requires_active_policy criteria type picker.
  async findAll(): Promise<DbResult<PolicyRow[]>> {
    try {
      const { rows } = await query<PolicyRow>("SELECT * FROM policies ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[policiesDB] findAll error", err as Error);
      return { error: err as Error };
    }
  },
};
