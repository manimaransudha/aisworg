-- Post-MVP Phase 5 — Trust Pipeline: Evidence (Ch.17), Knowledge (Ch.16),
-- Decision (Ch.19) Models. Ch.18 (Ontology) is deliberately out of scope —
-- these tables reference free-text category fields, same as
-- deliverables.category already does, not Ontology concepts; Ch.14
-- (Collaboration) needs no new table at all, since the event-driven,
-- artefact-centric collaboration it describes is already how every prior
-- phase's engine modules work (publish an event, don't call another
-- Participant directly). Ch.15 (Deliverable) is already built — this
-- migration only adds the one new transition (Approved -> Baselined) Ch.15
-- §10's fuller lifecycle names but the MVP never seeded.
--
-- All three new entities follow the exact shape Obligation established in
-- Phase 4: single required deliverable_id FK (not the chapters' plural
-- "Related Deliverables" — Post-MVP Build Sequence.md Phase 5's own "Done
-- when" only needs one Deliverable to gate on), free-text category (no CHECK
-- — "Additional categories may be introduced through Packs", same as
-- policies.category/obligations.category), status with NO CHECK constraint
-- (validated dynamically by transitionEngine against transition_definitions,
-- same precedent as deliverables.lifecycle_state).

-- Ch.17. Deliberately has no "update content" function anywhere in the
-- dblayer/core layer above this table — EM-002/FR-17.5 ("Evidence shall
-- remain immutable after acceptance") holds architecturally because nothing
-- can ever edit an Evidence Item's content, not just once Accepted. Only
-- lifecycle (status) transitions exist.
CREATE TABLE IF NOT EXISTS evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id            UUID NOT NULL REFERENCES seus(id),
  deliverable_id    UUID NOT NULL REFERENCES deliverables(id),
  category          TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  source            TEXT,
  confidence_level  TEXT NOT NULL DEFAULT 'Medium',
  status            TEXT NOT NULL DEFAULT 'Collected',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guarded: 011_polymorphic_governance_objects.sql later drops deliverable_id
-- once related_object_type/related_object_id replace it — on a rerun against
-- an already-migrated database, this file's own CREATE INDEX would otherwise
-- fail against a column that no longer exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence' AND column_name = 'deliverable_id') THEN
    CREATE INDEX IF NOT EXISTS idx_evidence_deliverable ON evidence (deliverable_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_evidence_seu ON evidence (seu_id);

-- Ch.16. acquisition_scope reuses the exact CHECK deliverables.acquisition_scope
-- already declares (Ch.15 §9) — FR-16.8: inherited by default from the
-- producing Deliverable at creation, promotable later (application-level;
-- Phase 6 is where promotion actually does something — see
-- Post-MVP Build Sequence.md Phase 6).
CREATE TABLE IF NOT EXISTS knowledge_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  deliverable_id     UUID NOT NULL REFERENCES deliverables(id),
  evidence_id        UUID REFERENCES evidence(id),
  category           TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  acquisition_scope  TEXT NOT NULL DEFAULT 'SEU'
                        CHECK (acquisition_scope IN ('SEU', 'Capability', 'Enterprise', 'Platform')),
  status             TEXT NOT NULL DEFAULT 'Observed',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_deliverable ON knowledge_items (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_seu ON knowledge_items (seu_id);

-- Ch.19. knowledge_id/evidence_id nullable — DM-002/DM-003 say a Decision
-- "shall" reference supporting Evidence and applicable Knowledge, but MVP
-- doesn't enforce that as a NOT NULL constraint any more strictly than
-- deliverables enforces non-empty acceptance_criteria (Build Plan precedent).
CREATE TABLE IF NOT EXISTS decisions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                 UUID NOT NULL REFERENCES seus(id),
  deliverable_id         UUID NOT NULL REFERENCES deliverables(id),
  knowledge_id           UUID REFERENCES knowledge_items(id),
  evidence_id            UUID REFERENCES evidence(id),
  category               TEXT NOT NULL,
  title                  TEXT NOT NULL,
  engineering_question   TEXT,
  selected_alternative   TEXT,
  rationale              TEXT,
  status                 TEXT NOT NULL DEFAULT 'Identified',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guarded: 011_polymorphic_governance_objects.sql later drops deliverable_id
-- once related_object_type/related_object_id replace it — on a rerun against
-- an already-migrated database, this file's own CREATE INDEX would otherwise
-- fail against a column that no longer exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'deliverable_id') THEN
    CREATE INDEX IF NOT EXISTS idx_decisions_deliverable ON decisions (deliverable_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_decisions_seu ON decisions (seu_id);

-- Extend the generic transitionEngine's entity types (Ch.29 §10) to admit
-- Evidence/Knowledge/Decision's own governed lifecycles — the same mechanism
-- SEU/Deliverable/Objective/Obligation already use.
ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD CONSTRAINT transition_definitions_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack'));

-- quality_gates.entity_type mirrors the same set.
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack'));
