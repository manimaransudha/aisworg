-- Post-MVP Phase 4 — Governance depth: Obligation Model (Ch.23) + Quality Gate
-- Model (Ch.26). The Constraint Type distinction (Policy vs Standard, Ch.24)
-- is already real — policies.constraint_type has existed since the original
-- MVP schema (002_seu_platform.sql) and transitionEngine already branches on
-- it; this migration only adds what was actually missing: Obligation and
-- Quality Gate as real persistent objects.

-- Ch.23. status deliberately has NO CHECK constraint, same precedent as
-- deliverables.lifecycle_state (002_seu_platform.sql) — validity is enforced
-- dynamically by transitionEngine against transition_definitions, not a
-- migration-gated CHECK. category stays free TEXT, not a CHECK enum, matching
-- policies.category/capabilities.category — Ch.23 §7 says "Additional
-- categories may be introduced through Packs," same as those two.
-- deliverable_id is a single required FK (not Ch.23 §8's plural "Related
-- Deliverables") — MVP scope per Post-MVP Build Sequence.md Phase 4's own
-- "Done when": block *a* Deliverable, not model many-to-many yet.
CREATE TABLE IF NOT EXISTS obligations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id          UUID NOT NULL REFERENCES seus(id),
  deliverable_id  UUID NOT NULL REFERENCES deliverables(id),
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  severity        TEXT NOT NULL DEFAULT 'Medium',
  status          TEXT NOT NULL DEFAULT 'Identified',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guarded: 011_polymorphic_governance_objects.sql later drops deliverable_id
-- once related_object_type/related_object_id replace it — on a rerun against
-- an already-migrated database, this file's own CREATE INDEX would otherwise
-- fail against a column that no longer exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'deliverable_id') THEN
    CREATE INDEX IF NOT EXISTS idx_obligations_deliverable ON obligations (deliverable_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_obligations_seu ON obligations (seu_id);

-- Extend the generic transitionEngine's entity types (Ch.29 §10) to admit
-- Obligation's own governed lifecycle (Ch.23 §9) — same mechanism SEU/
-- Deliverable/Objective already use, per Build Plan §2.2's "small core" split.
-- Post-MVP Phase 5 fix: kept as the full final union (see 003's updated
-- comment) so this DROP+ADD stays a true no-op no matter what order
-- migrations run in against an already-seeded database.
-- CR-059 build-time fix — superseded by migration 036 (CR-006, "the
-- constraint stays dropped"); this transient re-add was breaking replay
-- against real accumulated 'Template'/'Profile' rows. See 003's own note.

-- Ch.26. A gate is scoped to one specific governed transition, same shape as
-- transition_definitions. category stays free TEXT for the same "Pack-
-- extensible, illustrative list" reason as obligations.category (Ch.26 §7).
-- criteria stays JSONB/declarative (Ch.26 §9) so richer criteria (Evidence/
-- Decision/Review-based) are additive once Phase 5 exists, not a rewrite —
-- MVP implements exactly one criteria type, interpreted by qualityGateEngine:
-- { "type": "no_unresolved_obligations" } (Ch.23 §11's own worked example).
CREATE TABLE IF NOT EXISTS quality_gates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'Exit',
  entity_type           TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation')),
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  criteria              JSONB NOT NULL DEFAULT '{"type":"no_unresolved_obligations"}',
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, from_state, to_state)
);

-- Ch.26 FR-26.5/FR-26.6: outcomes are immutable, evaluations fully traceable —
-- an append-only log, same discipline as `events` and `commands`. outcome's
-- CHECK models the full Ch.26 §11 enum even though MVP's one criteria type
-- only ever produces 'Passed' or 'Blocked' — same precedent as
-- seus.lifecycle_state modelling states no seed data path reaches yet.
CREATE TABLE IF NOT EXISTS quality_gate_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_gate_id   UUID NOT NULL REFERENCES quality_gates(id),
  seu_id            UUID NOT NULL REFERENCES seus(id),
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  outcome           TEXT NOT NULL
                       CHECK (outcome IN ('Passed', 'Passed with Conditions', 'Blocked', 'Waived', 'Deferred', 'Not Applicable')),
  detail            JSONB NOT NULL DEFAULT '{}',
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_evaluations_entity ON quality_gate_evaluations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_quality_gate_evaluations_seu ON quality_gate_evaluations (seu_id);
