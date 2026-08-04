-- Post-MVP Phase 3 — Command / Work Item / Dispatch Engine pipeline.
-- Ch.31 (Execution Engine), Ch.32 (Work Item Model), Ch.33 (Dispatch Engine).
-- A Deliverable transition now goes through this pipeline instead of a direct
-- form POST mutating lifecycle_state: governance passes (dependencyEngine +
-- transitionEngine, unchanged) -> a Command is generated -> a Work Item is
-- generated from it -> the Dispatch Engine assigns it to whichever Participant
-- currently fulfils the Deliverable's producing Capability. See
-- src/domain/engine/{executionEngine,workItemGenerator,dispatchEngine}.ts.

-- Ch.31 §14: execution history is immutable and preserves the triggering
-- Event, evaluated Transition Definition outcome, generated Commands and
-- rationale — this table is that record, not a queue. entity_type mirrors
-- transition_definitions.entity_type (Ch.29) so the pipeline can extend to
-- SEU/Objective commands later without a schema change, even though Phase 3
-- only ever generates 'Deliverable' commands today.
CREATE TABLE IF NOT EXISTS commands (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id),
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective')),
  entity_id      UUID NOT NULL,
  command_type   TEXT NOT NULL,                    -- e.g. 'Deliverable.Transition'
  from_state     TEXT NOT NULL,
  to_state       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Generated'
                    CHECK (status IN ('Generated', 'Dispatched', 'Completed', 'Deferred', 'Cancelled', 'Failed')),
  requested_by   INTEGER REFERENCES users(id),
  correlation_id UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.32 WI-001/WI-003: Work Items are transient execution artefacts, never the
-- system of record — the Deliverable's own lifecycle_state remains the
-- authoritative engineering state, this table exists only so a dispatch
-- decision is traceable (FR-32.5, FR-33.4), not so anything reads it back as
-- business truth. FR-32.1: exactly one Command per Work Item (MVP never
-- generates more than one Work Item per Command — Ch.32 §9's "different
-- Participants may receive different Work Items for the same Command" needs
-- more than one eligible Participant per Capability, which Capability
-- Fulfilment doesn't support yet).
CREATE TABLE IF NOT EXISTS work_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id       UUID NOT NULL REFERENCES commands(id),
  participant_id   UUID REFERENCES participants(id),   -- set once dispatched
  status           TEXT NOT NULL DEFAULT 'Generated'
                      CHECK (status IN ('Generated', 'Assigned', 'Executing', 'Completed', 'Cancelled', 'Disposed')),
  dispatch_strategy TEXT,                               -- e.g. 'sole-eligible-participant' (Ch.33 §9)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commands_seu       ON commands (seu_id);
CREATE INDEX IF NOT EXISTS idx_commands_entity     ON commands (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_work_items_command  ON work_items (command_id);
CREATE INDEX IF NOT EXISTS idx_work_items_participant ON work_items (participant_id);
