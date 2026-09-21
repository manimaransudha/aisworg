-- CR-108 follow-on (owner: "Add a version column to obligations table (not
-- the definition, but the execution part) / create an originating_entity
-- object pair (pack, pack_id / participant, id / etc.) default is EBM,
-- ebm_id / Add assigned entity/assigned_to pair column (can assign it to an
-- SEU as well)") — three real, execution-side columns on the live
-- `obligations` instance, distinct from the Pack-authored Obligation
-- Definition (never touched by this migration).
--
-- version: a plain revision counter on the Obligation's own row, bumped by
-- obligationsDB.updateStatus on every transition — the same "the entity's
-- own row carries a real version field" convention Version Feature Plan.md
-- already establishes for Objective/Pack/Template/Profile, applied here to
-- Obligation's own execution-time row (not a transition_definitions.
-- version_event wiring, which is a separate, not-yet-done follow-up).
--
-- originating_entity_type / originating_entity_id: which specific entity
-- raised this Obligation — a real polymorphic pointer, generalising past
-- `origin`'s own categorical label (e.g. "Policies") to an actual id
-- (e.g. the specific Policy row). Defaults to ('EBM', <the SEU's own
-- active_ebm_id>) at creation time when no more specific originating entity
-- is known (createObligation, core/obligations.ts).
--
-- assigned_entity_type / assigned_entity_id: who/what this Obligation is
-- currently assigned to for resolution — may name a Participant or a SEU
-- (or, in future, anything else). Nullable, no default — real ownership
-- assignment is a separate, not-yet-built workflow (Ch.23 §19.10); this
-- migration only adds the column pair.
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS originating_entity_type TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS originating_entity_id UUID;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS assigned_entity_type TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS assigned_entity_id UUID;
