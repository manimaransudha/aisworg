# Knowledge Model — session notes (2026-09-19)

Captured so this session's conversation can be `/clear`ed without losing the thread. Only Knowledge-related content kept.

## Files touched

- `design/foundations/01_Book 1 (Refined)/02_Part 2/Chapter 16.md` — added `## 16.16 Implementation Specifics` at the end (no other section edited). Covers: generic transitionEngine realisation, lifecycle-name divergence from §16.7, the authority-badge situation, Acquisition Scope promotion, Engineering Capital query surface, partial feedback loop, partial relationships (§16.10), narrower live category set, and the not-built Observation/Reasoning/Governance three-engine split (§16.14).

  **Known stale spot in that file:** §16.16.3 currently says Knowledge/KnowledgeScope transitions have no badge wired. That was based on checking only `transitionDefinitions.json`'s legacy `requiredAuthorityRuleCode` field. Later, direct DB verification (below) showed this is wrong — real badges are live. §16.16.3 has **not yet been corrected** to match; do that before relying on it again.

- `design/foundations/03_Book 3 (Refined)/03_Part 3/Chapter 16.md` — rewrote `# 20. Implementation Status & Gaps` in full, live-verified against the running Postgres instance. This is the accurate, current version.

## `knowledge_items` table (live-confirmed, unchanged since migration 007/008)

```sql
CREATE TABLE knowledge_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  deliverable_id     UUID NOT NULL REFERENCES deliverables(id),
  evidence_id        UUID REFERENCES evidence(id),
  category           TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  acquisition_scope  TEXT NOT NULL DEFAULT 'SEU'
                        CHECK (acquisition_scope IN ('SEU','Capability','Enterprise','Platform')),
  status             TEXT NOT NULL DEFAULT 'Observed',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- indexes: deliverable_id, seu_id, acquisition_scope. No tenant_id column.
```

No later migration alters this table. `status` has no CHECK — governed dynamically via `transition_definitions`.

## DB connection (for future sessions)

- `.env` line 39 (uncommented) is the live one: `DATABASE_URL=postgresql://weirdo:...@127.0.0.1:5433/aisworg` — **port 5433**, not the Postgres default 5432. Checking `pg_isready` on 5432 will wrongly report "no response."
- No applied-migrations ledger exists (`src/dblayer/migrations/run.ts` just replays every `NNN_*.sql` file in order, unconditionally, every time). A migration file's *current* source content and what's actually live in a given database can diverge until migrations are re-run against it.

## Live DB state at time of audit (2026-09-19)

Zero rows in every Knowledge-adjacent transactional table: `seus`, `deliverables`, `knowledge_items`, `evidence`, `decisions`, `obligations`. Only reference data live: 132 `packs` rows, 608 `events` (Pack lifecycle events).

Key corrected findings (now reflected in Book 3 Ch.16 §20):

1. **Authority badges are real and live**, correcting an earlier (2026-08-22) audit's wrong badge name. `transition_definitions.verb` is populated for every Knowledge/KnowledgeScope hop — `knowledge_propose`/`validate`/`accept`/`publish`/`deprecate`/`archive`, `knowledgescope_promote_to_capability`/`_enterprise`/`_platform`. The legacy `required_authority_rule_id` field (source of the old wrong badge name `authority-transition-knowledge`) is `NULL` on every row — CR-006's `noun_verb` mechanism fully replaced it and the engine no longer reads it.
2. **`category:knowledge` vocabulary is live-stale**: only 4 rows exist (`Domain Knowledge`, `Technical Knowledge` Active; `Technical`, `Test` Retired). The chapter's other 4 categories (Architectural, Operational, Governance, Process Knowledge) are declared in migration `030_ontology.sql`'s current source but were never (re-)applied to this database — a Knowledge Item authored here today can only pick 2 of the chapter's 6 categories.
3. **`decisions.knowledge_id` → `decisions.knowledge_ids UUID[]`** (migration 231) — Decision's link to Knowledge is now plural, wired through `createDecision`/API, but still one-directional (Knowledge has no back-reference) and not FK-enforced. Untested by live data since `decisions` is empty.
4. **Engineering Capital / Organisational Learning Obligations / Knowledge events / Quality Gate content** — all mechanically real code paths, all live-confirmed **zero occurrences** right now (empty tables, not "not yet verified").
5. **No `tenant_id`** on `knowledge_items` — confirmed live via `\d knowledge_items`.
6. **Pack-to-Ontology contribution** (`ontology_concepts.contributed_by_pack`) — confirmed live 0 non-null rows, platform-wide, not Knowledge-specific.

## Open follow-up

- Fix Book 1 Ch.16 §16.16.3 to match the corrected badge finding (item 1 above).
