-- Post-MVP Phase 8 — Attention Management (Ch.34) + External Interaction
-- (Ch.36). The Post-MVP Build Sequence.md entry for this phase has no
-- "Done when" line (every other phase does) — see that file's Phase 8
-- section for the bar this build derived and documented for itself before
-- writing any code.
--
-- Both entities follow the established shape: free-text, Pack-extensible
-- category fields stay TEXT with no CHECK (matching policies.category /
-- obligations.category precedent); status has no CHECK — validated
-- dynamically by transitionEngine against transition_definitions, same
-- precedent as every other governed entity since deliverables.lifecycle_state
-- (002_seu_platform.sql). direction on external_interactions is a real CHECK
-- because it's a small, architecturally-fixed two-value enum (Ch.36 §8),
-- unlike the Pack-extensible category fields.

-- Ch.34. related_object_type/id are informational traceability only (Ch.34
-- §14 "originating engineering object") — no FK, since an Attention Item may
-- point at a Deliverable, an Obligation, or (Ch.36 §13) an External
-- Interaction, and a single FK can't span all of those without a lookup
-- table this MVP doesn't need yet. triggering_event_id does FK events(id),
-- since every Attention Item in this instance is always raised in direct
-- response to one specific platform event (Ch.34 §14's other traceability
-- field).
CREATE TABLE IF NOT EXISTS attention_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  category              TEXT NOT NULL,
  priority              TEXT NOT NULL DEFAULT 'Medium',
  title                 TEXT NOT NULL,
  description           TEXT,
  related_object_type   TEXT,
  related_object_id     UUID,
  triggering_event_id   UUID REFERENCES events(id),
  status                TEXT NOT NULL DEFAULT 'Created',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attention_items_seu ON attention_items (seu_id);
CREATE INDEX IF NOT EXISTS idx_attention_items_related ON attention_items (related_object_type, related_object_id);

-- Ch.36. deliverable_id nullable — unlike Obligation/Evidence/Knowledge/
-- Decision (deliberately Deliverable-scoped since Phase 4), an External
-- Interaction is as often SEU-level as Deliverable-level (Ch.36 §7's own
-- categories include Enterprise/Cloud/Regulatory interactions that aren't
-- about any single Deliverable).
CREATE TABLE IF NOT EXISTS external_interactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  deliverable_id     UUID REFERENCES deliverables(id),
  interaction_type   TEXT NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('Inbound', 'Outbound')),
  target_system      TEXT NOT NULL,
  purpose            TEXT,
  status             TEXT NOT NULL DEFAULT 'Created',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_interactions_seu ON external_interactions (seu_id);
CREATE INDEX IF NOT EXISTS idx_external_interactions_deliverable ON external_interactions (deliverable_id);

-- Extend the generic transitionEngine's entity types (Ch.29 §10) to admit
-- AttentionItem's (Ch.34 §9) and ExternalInteraction's (Ch.36 §9) own
-- governed lifecycles — same mechanism every other entity type already uses.
-- Kept as the full final union here and retrofitted into every earlier
-- migration that touches this constraint (003, 006, 007, 008), so DROP+ADD
-- stays a true no-op regardless of run order — the fix Phase 5 established.
ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD CONSTRAINT transition_definitions_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack'));

ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack'));
