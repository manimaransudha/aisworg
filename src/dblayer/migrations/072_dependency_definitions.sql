-- CR-039 — Dependency Engine: canonical (entity_type, name?, state) node form,
-- Template-scoped, replacing the per-SEU-instance dependency_edges model
-- (Ch.9 §19's own review, 2026-08-20). Designed in conversation with the
-- owner before any code was written — see CR-039's own file for the full
-- design rationale.
--
-- A row is one canonical fact: "FROM this (type, name?, state) UNLOCKS this
-- (type, name, state)" — true for every SEU commissioned from template_id,
-- never re-derived or re-stored per SEU. No reference to deliverables.id or
-- seus.id anywhere in this table; that would make it a transaction log, not
-- a recipe (the owner's own framing).
--
-- from_name / to_name: required for entity types with a stable, pre-declared
-- identity a Template's own catalogue enumerates ahead of time (Deliverable —
-- an Ontology deliverable-name concept code; Capability — a Service code).
-- NULL on from_name for entity types that are inherently ad hoc, never
-- pre-planned in a catalogue (Decision, Obligation, Evidence, Knowledge,
-- ExternalInteraction) — a NULL-name FROM node means "any instance of this
-- type attached to the gated (to_*) Deliverable, currently in from_state."
-- This is deliberately the same mechanism qualityGateEngine's
-- no_unresolved_obligations / requires_accepted_evidence_or_approved_decision
-- criteria already implement in a separate engine — this table (and the
-- evaluator built on it) subsumes them, not duplicates them.
--
-- to_name is NOT NULL — the gated side is always a specific, Template-
-- catalogue-declared thing (a Deliverable, today; kept generic rather than
-- hardcoded to allow a future gated Capability/Service).
--
-- entity_type is plain TEXT, deliberately with NO CHECK constraint and NO
-- hard FK — widening the type vocabulary was the owner's own explicit goal
-- ("I understand adding these to dependency type. that is not a code
-- change"). The real, governed noun vocabulary already has every type this
-- needs except Capability itself (authority_nouns: Deliverable, Decision,
-- Evidence, Knowledge, Obligation, ExternalInteraction all already exist,
-- confirmed live) — Capability/Service is the one addition specific to this
-- table, since Capabilities aren't independently governed-transition nouns.
-- Adding a genuinely new type is: start writing rows with that entity_type
-- value, plus a matching evaluation branch in code — no migration required.
CREATE TABLE IF NOT EXISTS dependency_definitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  from_entity_type  TEXT NOT NULL,
  from_name         TEXT,
  from_state        TEXT NOT NULL,
  to_entity_type    TEXT NOT NULL,
  to_name           TEXT NOT NULL,
  to_state          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CR-059 build-time fix — migration 074 later drops `template_id` entirely
-- (polymorphic owning_entity_type/owning_entity_id) and recreates these
-- same-named indexes without it. IF NOT EXISTS alone doesn't help on replay:
-- Postgres still validates the column list before checking whether the
-- index already exists by name, so referencing an already-dropped column
-- fails outright even though the statement would ultimately no-op. Guarded
-- to only run while template_id still exists (a truly fresh/pre-074 replay).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dependency_definitions' AND column_name = 'template_id') THEN
    -- The real query shape: "what does reaching (to_entity_type, to_name,
    -- to_state) require, for this template?" — every evaluation of a gated
    -- transition starts here.
    CREATE INDEX IF NOT EXISTS idx_dependency_definitions_target
      ON dependency_definitions (template_id, to_entity_type, to_name, to_state);

    -- The push-evaluation shape: "this (entity_type, name?, state) was just
    -- reached — what does it unlock?"
    CREATE INDEX IF NOT EXISTS idx_dependency_definitions_source
      ON dependency_definitions (template_id, from_entity_type, from_name, from_state);
  END IF;
END $$;
