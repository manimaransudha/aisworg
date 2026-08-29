// CR-006 / CR-007 Step 2 — read + write access for the noun × verb authority
// vocabulary. Lifecycle is add + soft-retire only (never delete/rename): a
// retired row stays (existing data + FKs intact) and simply drops out of the
// "add new" pickers. Small bounded config tables — the management lists are
// paged/searched/sorted in memory via paginateList (listQuery.ts).
import { query } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import type { DbResult } from "./seuTypes.js";

// Work outcome — a noun with how many ACTIVE verbs it allows (mapping) and how
// many ACTIVE transitions currently carry a verb.
export interface AuthorityNounRow {
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  verb_count: number;
  transition_count: number;
}

// Work process — a verb with how many ACTIVE nouns allow it.
export interface AuthorityVerbRow {
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  noun_count: number;
}

// Mapping — one row per (noun, verb) pair, so a single pair can be retired.
export interface AuthorityMappingRow {
  noun_code: string;
  noun_label: string;
  verb_code: string;
  verb_label: string;
  is_active: boolean;
  // The trigger chosen on the Allow form (owner: "add a dropdown to choose
  // trigger and pass it in the allow function") — the starting trigger for
  // any Transition Definition added under this (noun, verb) later. Never
  // applied retroactively to a transition that already exists (that would
  // silently overwrite a real, deliberately-set trigger every time Allow is
  // resubmitted for a pair that already exists — the mapping upsert is
  // idempotent).
  default_trigger: "manual" | "governed";
  // CR-072 — the shared, ACTUAL trigger across every transition_definitions
  // row already wired to this (entity_type, verb), the real, entity-agnostic
  // value transitionEngine.evaluate reads. Falls back to default_trigger when
  // no transition is wired yet; null when the wired ones disagree (shouldn't
  // normally happen — surfaced as "mixed" rather than guessing).
  trigger: "manual" | "governed" | null;
  // Whether `trigger` above reflects a REAL wired transition (true) or is
  // just default_trigger showing through because none exists yet (false) —
  // the per-row "Edit" control only means anything (updateTriggerForVerb
  // only ever touches real rows) when this is true; when false, editing the
  // trigger here is exactly what re-submitting Allow now safely does instead.
  has_wired_transitions: boolean;
}

export interface CodeLabel {
  code: string;
  label: string;
}

export const authorityVocabularyDB = {
  async listNouns(): Promise<DbResult<AuthorityNounRow[]>> {
    try {
      const { rows } = await query<AuthorityNounRow>(
        `SELECT n.code, n.label, n.description, n.is_active,
                (SELECT count(*)::int FROM authority_noun_verbs nv WHERE nv.noun_code = n.code AND nv.is_active) AS verb_count,
                (SELECT count(*)::int FROM transition_definitions td WHERE td.entity_type = n.code AND td.verb IS NOT NULL AND td.is_active) AS transition_count
         FROM authority_nouns n
         ORDER BY n.code`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[authorityVocabularyDB] listNouns error", err as Error);
      return { error: err as Error };
    }
  },

  async listVerbs(): Promise<DbResult<AuthorityVerbRow[]>> {
    try {
      const { rows } = await query<AuthorityVerbRow>(
        `SELECT v.code, v.label, v.description, v.is_active,
                (SELECT count(*)::int FROM authority_noun_verbs nv WHERE nv.verb_code = v.code AND nv.is_active) AS noun_count
         FROM authority_verbs v
         ORDER BY v.code`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[authorityVocabularyDB] listVerbs error", err as Error);
      return { error: err as Error };
    }
  },

  async listMapping(): Promise<DbResult<AuthorityMappingRow[]>> {
    try {
      const { rows } = await query<AuthorityMappingRow>(
        `SELECT nv.noun_code, n.label AS noun_label, nv.verb_code, v.label AS verb_label, nv.is_active, nv.default_trigger,
                CASE
                  WHEN td_agg.cnt = 0 THEN nv.default_trigger
                  WHEN td_agg.distinct_cnt = 1 THEN td_agg.only_trigger
                  ELSE NULL
                END AS trigger,
                (td_agg.cnt > 0) AS has_wired_transitions
         FROM authority_noun_verbs nv
         JOIN authority_nouns n ON n.code = nv.noun_code
         JOIN authority_verbs v ON v.code = nv.verb_code
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS cnt, COUNT(DISTINCT td.trigger) AS distinct_cnt, MIN(td.trigger) AS only_trigger
           FROM transition_definitions td WHERE td.entity_type = nv.noun_code AND td.verb = nv.verb_code
         ) td_agg ON TRUE
         ORDER BY nv.noun_code, nv.verb_code`
      );
      return { data: rows };
    } catch (err) {
      logger.error("[authorityVocabularyDB] listMapping error", err as Error);
      return { error: err as Error };
    }
  },

  // The mapping's own starting trigger (owner: "add a dropdown to choose
  // trigger and pass it in the allow function") — used by
  // core/transitionDefinitions.ts's addTransitionDefinition so a NEW edge
  // under this (noun, verb) starts at the chosen value instead of the
  // column's hardcoded 'manual' default. Falls back to 'manual' when no
  // mapping row exists yet (matches the column's own DB default).
  async findDefaultTrigger(nounCode: string, verbCode: string): Promise<DbResult<"manual" | "governed">> {
    try {
      const { rows } = await query<{ default_trigger: "manual" | "governed" }>(
        "SELECT default_trigger FROM authority_noun_verbs WHERE noun_code = $1 AND verb_code = $2",
        [nounCode, verbCode]
      );
      return { data: rows[0]?.default_trigger ?? "manual" };
    } catch (err) {
      logger.error("[authorityVocabularyDB] findDefaultTrigger error", err as Error);
      return { error: err as Error };
    }
  },

  // Called alongside updateTriggerForVerb (core's updateMappingTrigger) so an
  // explicit correction to already-wired transitions also updates what the
  // NEXT new transition under this pair will start at.
  async setDefaultTrigger(nounCode: string, verbCode: string, trigger: "manual" | "governed"): Promise<DbResult<{ noun_code: string } | null>> {
    try {
      const { rows } = await query<{ noun_code: string }>(
        "UPDATE authority_noun_verbs SET default_trigger = $1 WHERE noun_code = $2 AND verb_code = $3 RETURNING noun_code",
        [trigger, nounCode, verbCode]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[authorityVocabularyDB] setDefaultTrigger error", err as Error);
      return { error: err as Error };
    }
  },

  // CR-072 — edits every transition_definitions row sharing this exact
  // (entity_type, verb) at once, e.g. Objective's own "archive" (used by 3
  // separate from_states, all -> Archived) gets updated together in one
  // action, keeping them consistent by construction rather than by
  // discipline. No-op (0 rows) is a real, valid outcome — a mapping entry
  // with no wired transition yet (nothing to update).
  async updateTriggerForVerb(nounCode: string, verbCode: string, trigger: "manual" | "governed"): Promise<DbResult<number>> {
    try {
      const { rowCount } = await query("UPDATE transition_definitions SET trigger = $1 WHERE entity_type = $2 AND verb = $3", [trigger, nounCode, verbCode]);
      return { data: rowCount ?? 0 };
    } catch (err) {
      logger.error("[authorityVocabularyDB] updateTriggerForVerb error", err as Error);
      return { error: err as Error };
    }
  },

  // Active-only vocab for the "add new" pickers.
  async listActiveNouns(): Promise<DbResult<CodeLabel[]>> {
    try {
      const { rows } = await query<CodeLabel>("SELECT code, label FROM authority_nouns WHERE is_active ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[authorityVocabularyDB] listActiveNouns error", err as Error);
      return { error: err as Error };
    }
  },

  async listActiveVerbs(): Promise<DbResult<CodeLabel[]>> {
    try {
      const { rows } = await query<CodeLabel>("SELECT code, label FROM authority_verbs WHERE is_active ORDER BY code");
      return { data: rows };
    } catch (err) {
      logger.error("[authorityVocabularyDB] listActiveVerbs error", err as Error);
      return { error: err as Error };
    }
  },

  // Active (noun, verb) pairs — used to constrain the verb a transition may
  // pick to its noun's allowed set.
  async listActiveMappingPairs(): Promise<DbResult<{ noun_code: string; verb_code: string }[]>> {
    try {
      const { rows } = await query<{ noun_code: string; verb_code: string }>(
        "SELECT noun_code, verb_code FROM authority_noun_verbs WHERE is_active ORDER BY noun_code, verb_code"
      );
      return { data: rows };
    } catch (err) {
      logger.error("[authorityVocabularyDB] listActiveMappingPairs error", err as Error);
      return { error: err as Error };
    }
  },

  // ── add (re-adding a retired row reactivates it) ──────────────────────────
  async addNoun(code: string, label: string, description: string | null): Promise<DbResult<{ code: string }>> {
    try {
      const { rows } = await query<{ code: string }>(
        `INSERT INTO authority_nouns (code, label, description) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, is_active = TRUE
         RETURNING code`,
        [code, label, description]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[authorityVocabularyDB] addNoun error", err as Error);
      return { error: err as Error };
    }
  },

  async addVerb(code: string, label: string, description: string | null): Promise<DbResult<{ code: string }>> {
    try {
      const { rows } = await query<{ code: string }>(
        `INSERT INTO authority_verbs (code, label, description) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, is_active = TRUE
         RETURNING code`,
        [code, label, description]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[authorityVocabularyDB] addVerb error", err as Error);
      return { error: err as Error };
    }
  },

  // defaultTrigger is stored on the mapping itself (never applied
  // retroactively to an already-wired transition — that's what made the
  // Allow form's trigger choice unsafe before this column existed). A
  // resubmit of Allow for a pair that already exists updates its own default
  // going forward, same as it already reactivates is_active.
  async addMapping(nounCode: string, verbCode: string, defaultTrigger: "manual" | "governed" = "manual"): Promise<DbResult<{ noun_code: string }>> {
    try {
      const { rows } = await query<{ noun_code: string }>(
        `INSERT INTO authority_noun_verbs (noun_code, verb_code, default_trigger) VALUES ($1, $2, $3)
         ON CONFLICT (noun_code, verb_code) DO UPDATE SET is_active = TRUE, default_trigger = EXCLUDED.default_trigger
         RETURNING noun_code`,
        [nounCode, verbCode, defaultTrigger]
      );
      return { data: rows[0] };
    } catch (err) {
      logger.error("[authorityVocabularyDB] addMapping error", err as Error);
      return { error: err as Error };
    }
  },

  // ── retire (soft; never delete) ───────────────────────────────────────────
  async retireNoun(code: string): Promise<DbResult<{ code: string } | null>> {
    try {
      const { rows } = await query<{ code: string }>("UPDATE authority_nouns SET is_active = FALSE WHERE code = $1 RETURNING code", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[authorityVocabularyDB] retireNoun error", err as Error);
      return { error: err as Error };
    }
  },

  async retireVerb(code: string): Promise<DbResult<{ code: string } | null>> {
    try {
      const { rows } = await query<{ code: string }>("UPDATE authority_verbs SET is_active = FALSE WHERE code = $1 RETURNING code", [code]);
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[authorityVocabularyDB] retireVerb error", err as Error);
      return { error: err as Error };
    }
  },

  async retireMapping(nounCode: string, verbCode: string): Promise<DbResult<{ noun_code: string } | null>> {
    try {
      const { rows } = await query<{ noun_code: string }>(
        "UPDATE authority_noun_verbs SET is_active = FALSE WHERE noun_code = $1 AND verb_code = $2 RETURNING noun_code",
        [nounCode, verbCode]
      );
      return { data: rows[0] ?? null };
    } catch (err) {
      logger.error("[authorityVocabularyDB] retireMapping error", err as Error);
      return { error: err as Error };
    }
  },
};
