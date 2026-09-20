-- Ch.12 §9 / CR-109 §6.2 — the eligible-Participant pool a Command's Work
-- Item Generation and Dispatch consume needs to be a real, persisted
-- reference (`eligibleParticipantPoolRef`), not resolved live on every read.
-- Live-confirmed before this migration: no such persistence existed —
-- capabilityFulfilmentsDB's own `findActiveManyBySeuCapabilityId` (Ch.12
-- §18.2, the real multi-Participant pool since Composite/CR-... landed) was
-- queried live, separately, by dispatchEngine.ts every single dispatch.
--
-- One snapshot row per Command that actually declares a producing
-- Capability — `participant_ids` is the pool `findActiveManyBySeuCapabilityId`
-- returned at the moment the Command was generated (executionEngine.execute()),
-- so Dispatch (and, later, Work Item Generation) read what Fulfilment had
-- already decided rather than re-deriving it — the "connective tissue"
-- principle CR-109 §5 names directly. A Command with no producing Capability
-- declared at all (dispatchEngine's own pre-existing NO_CAPABILITY_DECLARED
-- path) gets no pool row and `commands.eligible_participant_pool_id` stays
-- NULL — unchanged behaviour, just now expressed as "no pool," not "no query
-- result."
--
-- Deliberately NOT a change to how a Participant is selected FROM the pool —
-- Dispatch Engine's own missing "choose among several via §8 criteria" logic
-- (Ch.12 §18.2's own settled, explicitly deferred gap) is untouched here;
-- this migration only makes the pool itself a real, persisted, referenceable
-- thing instead of a live query.
CREATE TABLE IF NOT EXISTS capability_fulfilment_pools (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  seu_capability_id  UUID REFERENCES seu_capabilities(id),
  capability_id      UUID REFERENCES capabilities(id),
  participant_ids    UUID[] NOT NULL DEFAULT '{}',
  resolved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_fulfilment_pools_seu ON capability_fulfilment_pools (seu_id);
CREATE INDEX IF NOT EXISTS idx_capability_fulfilment_pools_seu_capability ON capability_fulfilment_pools (seu_capability_id);

ALTER TABLE commands
  ADD COLUMN IF NOT EXISTS eligible_participant_pool_id UUID REFERENCES capability_fulfilment_pools(id);
