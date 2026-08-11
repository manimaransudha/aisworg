-- Participant Integration & Attestation — Plan, step 2 (Resolutions 3, 4, 7).
-- Two distinct artifacts, per Resolution 3:
--
--   * deliverable_references — the raw VCS reference a Participant returns at
--     EVERY completion (production and acceptance alike). Nothing is certified;
--     it is candidate output, a durable pointer. Work Items are transient
--     (Ch.32), so the reference must not live only on work_items.output_reference
--     — this append-only table is its durable home, and the traceability
--     backbone step 3 (Ch.20) will read.
--
--   * attestations — minted ONLY at an acceptance transition (In Progress ->
--     Approved, Approved -> Baselined), recording the governance outcome:
--     "under this SEU's governance, this Deliverable reached this state, by this
--     authority, referencing this commit." Immutable; a provenance edge.
--
-- The commit reference is stored as an opaque, provider-agnostic TEXT value in
-- both tables — the core never parses or resolves it (§0.1 core-invariance:
-- reference resolution lives in the VCS-binding edge module, not here).

-- The acting authority (badge grant) is resolved at dispatch time in
-- transitionDeliverable; persist it on the Command so completeWorkItem can mint
-- the attestation with the authority that actually drove the transition.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'acting_badge_grant_id') THEN
    ALTER TABLE commands ADD COLUMN acting_badge_grant_id UUID REFERENCES badge_grants(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS deliverable_references (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id),
  work_item_id   UUID NOT NULL REFERENCES work_items(id),
  participant_id UUID REFERENCES participants(id),      -- null on the no-capability path
  from_state     TEXT NOT NULL,
  to_state       TEXT NOT NULL,                         -- the state the Work Item drove toward (Resolution 2)
  reference      TEXT,                                  -- opaque, provider-agnostic; may be null on a bare completion
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_references_deliverable ON deliverable_references (deliverable_id);

CREATE TABLE IF NOT EXISTS attestations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  deliverable_id        UUID NOT NULL REFERENCES deliverables(id),
  work_item_id          UUID NOT NULL REFERENCES work_items(id),
  participant_id        UUID REFERENCES participants(id),
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,                  -- the acceptance state certified (Approved | Baselined)
  reference             TEXT,                           -- opaque commit reference the acceptance certifies
  acting_badge_grant_id UUID REFERENCES badge_grants(id),
  requested_by          INTEGER REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attestations_deliverable ON attestations (deliverable_id);
