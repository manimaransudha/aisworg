-- Post-MVP Phase 6 — Organisational Learning Obligation + Engineering
-- Capital surfaces (Book 1 Ch.21 §21.6, Book 3 Ch.16 §12-§13, Ch.23 §7).
--
-- Acquisition Scope promotion is modelled as its own governed transition
-- track — entity_type 'KnowledgeScope' — deliberately separate from
-- 'Knowledge' (which continues to govern knowledge_items.status). This
-- mirrors Ch.24's own "different axes" pattern (Constraint Type vs Severity)
-- and means promotion reuses transitionEngine/Authority/Policy verbatim: the
-- only seeded transitions are SEU -> Capability -> Enterprise -> Platform
-- (monotonic broadening), so attempting any other direction (a demotion, or
-- skipping a tier) is rejected by the existing "no_transition_definition"
-- path with zero new validation code — Ch.16 §12's no-silent-demotion rule
-- falls out of the generic mechanism for free.
--
-- No new table: acquisition_scope already lives on knowledge_items
-- (007_trust_pipeline.sql), the same way Deliverable/Objective/Obligation
-- transitions govern a column on an existing table rather than a dedicated
-- transition-log table of their own.

ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD CONSTRAINT transition_definitions_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant'));

ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant'));

CREATE INDEX IF NOT EXISTS idx_knowledge_items_acquisition_scope ON knowledge_items (acquisition_scope);
