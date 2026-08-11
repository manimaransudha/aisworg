-- Participant Integration & Attestation — Plan step 5 (Decision 9, Resolution 10).
-- Per-Capability execution target: how the Participant fulfilling a Capability
-- is reached (Contract declaration #2, §2.1). `human-on-ui` means the assignment
-- is fulfilled by a human through the platform UI (the labelled stub);
-- `external-orchestrator` means the platform delivers the assignment to a
-- tenant orchestrator over a thin adapter (endpoint + opaque auth reference).
--
-- This is the selection source the adapter seam resolves against; a Capability
-- with no row defaults to human-on-ui. tenant scoping (tenant_id) is the
-- minimal Phase-12 slice that step 6 adds; here it is per-Capability only.
CREATE TABLE IF NOT EXISTS execution_targets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id    UUID NOT NULL REFERENCES capabilities(id),
  mode             TEXT NOT NULL CHECK (mode IN ('human-on-ui', 'external-orchestrator')),
  adapter_endpoint TEXT,   -- external-orchestrator: where to deliver the assignment
  adapter_auth_ref TEXT,   -- opaque reference to the outbound credential (edge concern; the core never reads it)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT execution_targets_capability_unique UNIQUE (capability_id)
);
