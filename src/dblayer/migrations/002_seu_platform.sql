-- SEU Commissioning Platform — MVP schema.
-- See design/mvp-build-plan/MVP Build Plan.md §3 for the rationale behind every
-- table, every dropped CHECK constraint, and every field that's here because a
-- specific Book 3 chapter names it (cited in each table's leading comment).
-- Run as DB owner, after 001 (schema.sql).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ══════════════════════════════════════════════════════════════════
-- Engineering Layer
-- ══════════════════════════════════════════════════════════════════

-- Ch.1. MVP: requiredCapabilities are explicitly declared (objective_capabilities),
-- never auto-derived — Ch.1 §10's derivation path depends on a "Capability Pack"
-- category that Ch.5's own Pack taxonomy never defines (see Build Plan §5).
CREATE TABLE IF NOT EXISTS objectives (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement            TEXT NOT NULL,
  tier                 TEXT NOT NULL DEFAULT 'Engineering'
                          CHECK (tier IN ('Strategic', 'Operational', 'Engineering')),
  parent_objective_id  UUID REFERENCES objectives(id),
  status               TEXT NOT NULL DEFAULT 'Active'
                          CHECK (status IN ('Proposed', 'Active', 'Achieved', 'Superseded', 'Retired', 'Archived')),
  version              INTEGER NOT NULL DEFAULT 1,
  requested_by         INTEGER REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- Composition Layer
-- ══════════════════════════════════════════════════════════════════
-- Packs is created ahead of Capability/Service/Template/Profile (all of which
-- reference it) so every FK can be declared inline — no circular-reference
-- ALTER TABLE needed, which matters because ALTER TABLE ... ADD CONSTRAINT has
-- no IF NOT EXISTS in Postgres and would break re-running this file.

-- Ch.5. Hand-authored JSON, loaded via a seed script (Pack SDK deferred).
CREATE TABLE IF NOT EXISTS packs (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                          TEXT NOT NULL UNIQUE,
  name                          TEXT NOT NULL,
  category                      TEXT NOT NULL
                                   CHECK (category IN ('Platform', 'Organisation', 'Domain', 'Compliance', 'Technology', 'Integration')),
  pack_version                  TEXT NOT NULL,             -- semver string, e.g. '1.0.0'
  status                        TEXT NOT NULL DEFAULT 'Active'
                                   CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  installation_classification   TEXT NOT NULL DEFAULT 'Mandatory'
                                   CHECK (installation_classification IN ('Mandatory', 'Recommended', 'Optional', 'Conditional')),
  contributions                 JSONB NOT NULL DEFAULT '{}',   -- declarative payload: policies[], authorityRules[], capabilities[], services[]
  dependencies                  JSONB NOT NULL DEFAULT '[]',   -- [{ packCode, version, type: 'required' }] — MVP uses 'required' only
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.10. Master/catalog table — Pack-declared, not per-SEU.
CREATE TABLE IF NOT EXISTS capabilities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,          -- e.g. 'requirements-analysis'
  name                 TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  originating_pack_id  UUID REFERENCES packs(id),
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS objective_capabilities (
  objective_id   UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  PRIMARY KEY (objective_id, capability_id)
);

-- Ch.11. New in the Refined edition — fully specified, no legacy inconsistency.
CREATE TABLE IF NOT EXISTS services (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  providing_capability_id  UUID NOT NULL REFERENCES capabilities(id),
  name                     TEXT NOT NULL,
  contract_description     TEXT NOT NULL,
  service_level            JSONB NOT NULL DEFAULT '{}',   -- optional: turnaround_time, quality_bar, availability, exceptions (Ch.11 §8 — "may specify")
  status                   TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  version                  INTEGER NOT NULL DEFAULT 1,
  originating_pack_id      UUID REFERENCES packs(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.6. Template = structural blueprint + MANDATORY Packs only (see Build Plan §5 for the
-- Template/Profile field-ownership resolution — Ch.6 and Ch.7 overlap in the source text).
CREATE TABLE IF NOT EXISTS templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  template_version       INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'Active'
                            CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  parent_template_id     UUID REFERENCES templates(id),   -- inheritance (Ch.6 §9) — column present, unused by MVP seed data
  deliverable_catalogue  JSONB NOT NULL DEFAULT '[]',     -- [{ code, name, category }] — default Deliverables this Template proposes
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_capabilities (
  template_id    UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  PRIMARY KEY (template_id, capability_id)
);

CREATE TABLE IF NOT EXISTS template_packs (            -- mandatory Packs only, per the Template/Profile split
  template_id  UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  pack_id      UUID NOT NULL REFERENCES packs(id),
  PRIMARY KEY (template_id, pack_id)
);

-- Ch.7. Profile = everything selectable/optional for one commissioning instance.
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  base_template_id    UUID NOT NULL REFERENCES templates(id),
  config_parameters   JSONB NOT NULL DEFAULT '{}',    -- meaning owned by the consuming Pack (Ch.7 §10), not by Profile itself
  environment         TEXT NOT NULL DEFAULT 'development',
  status              TEXT NOT NULL DEFAULT 'Active'
                         CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_packs (              -- optional Packs selected on top of the Template's mandatory set
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_id     UUID NOT NULL REFERENCES packs(id),
  PRIMARY KEY (profile_id, pack_id)
);

-- Ch.2/Ch.4/Ch.38. EBM and EEC collapsed into one table for MVP — each SEU gets
-- a freshly-composed configuration; Packs aren't independently republished for
-- reuse across many pre-validated EBMs at MVP scale.
-- seu_id has no FK here on purpose: ebms.seu_id -> seus(id) and seus.active_ebm_id
-- -> ebms(id) are genuinely circular, and Postgres has no idempotent way to add
-- a deferred constraint later (ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS).
-- Integrity is enforced application-side by the commissioning flow, which always
-- creates the seus row before the ebms row and only ever points seus.active_ebm_id
-- at an ebms row it just created for that same seu_id.
CREATE TABLE IF NOT EXISTS ebms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL,
  template_id           UUID NOT NULL REFERENCES templates(id),
  profile_id            UUID NOT NULL REFERENCES profiles(id),
  composed_packs        JSONB NOT NULL DEFAULT '[]',   -- [{ packId, packVersion }] actually composed, in order
  composition_report    JSONB NOT NULL DEFAULT '{}',   -- { warnings[], conflicts[], resolutions[] } — Ch.8 §17's Commissioning Report
  status                TEXT NOT NULL DEFAULT 'Active'
                           CHECK (status IN ('Composed', 'Active', 'Superseded')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- Execution Layer
-- ══════════════════════════════════════════════════════════════════

-- Ch.37 for lifecycle_state; Ch.2 for the composition tree. 'Pending' is added
-- as a pre-Commissioned working state for the commissioning pipeline to attach
-- to — Ch.37 never actually describes what a SEU looks like before "Commissioned"
-- is reached, since that's the pipeline's own outcome, not an entry state (see
-- Build Plan §5, item 8).
CREATE TABLE IF NOT EXISTS seus (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id          UUID NOT NULL REFERENCES objectives(id),
  template_id           UUID NOT NULL REFERENCES templates(id),
  profile_id            UUID NOT NULL REFERENCES profiles(id),
  active_ebm_id         UUID REFERENCES ebms(id),
  lifecycle_state       TEXT NOT NULL DEFAULT 'Pending'
                           CHECK (lifecycle_state IN ('Pending', 'Commissioned', 'Configured', 'Activated', 'Operational', 'Suspended', 'Retired', 'Archived')),
  requested_by          INTEGER REFERENCES users(id),
  commissioning_report  JSONB NOT NULL DEFAULT '{}',   -- Ch.8 §17
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebms_seu ON ebms (seu_id);

-- Per-SEU requirement + fulfilment roll-up. Distinct from `capabilities` (the catalog).
CREATE TABLE IF NOT EXISTS seu_capabilities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  status         TEXT NOT NULL DEFAULT 'Unfulfilled'
                    CHECK (status IN ('Unfulfilled', 'Fulfilled')),
  UNIQUE (seu_id, capability_id)
);

-- Ch.12/Ch.13 collapsed into one entity — Ch.12 proposes a Participant Type /
-- Participant Instance split "for the next chapter," but Ch.13's own normative
-- body never delivers it as two entities.
CREATE TABLE IF NOT EXISTS participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id        UUID NOT NULL REFERENCES seus(id),
  type          TEXT NOT NULL CHECK (type IN ('AI', 'Human', 'External')),
  display_name  TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'Available'
                   CHECK (state IN ('Created', 'Available', 'Assigned', 'Executing', 'Idle', 'Released', 'Archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.12 §9 — registers eligibility/assignment, doesn't bind to a specific Work Item (none exist in MVP).
CREATE TABLE IF NOT EXISTS capability_fulfilments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_capability_id    UUID NOT NULL REFERENCES seu_capabilities(id) ON DELETE CASCADE,
  participant_id       UUID NOT NULL REFERENCES participants(id),
  fulfilment_strategy  TEXT NOT NULL DEFAULT 'AI'
                          CHECK (fulfilment_strategy IN ('AI', 'Human', 'External', 'Hybrid', 'Composite')),
  established_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at           TIMESTAMPTZ
);

-- Ch.15. lifecycle_state deliberately has NO CHECK constraint — Ch.15 §10 states
-- the EBM may define additional Deliverable lifecycle states, so validity is
-- enforced dynamically by transitionEngine against transition_definitions
-- instead of a migration-gated CHECK (see Build Plan §2.3).
CREATE TABLE IF NOT EXISTS deliverables (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                    UUID NOT NULL REFERENCES seus(id),
  name                      TEXT NOT NULL,
  category                  TEXT NOT NULL,
  lifecycle_state           TEXT NOT NULL DEFAULT 'Defined',
  acceptance_criteria       JSONB NOT NULL DEFAULT '[]',
  acquisition_scope         TEXT NOT NULL DEFAULT 'SEU'
                               CHECK (acquisition_scope IN ('SEU', 'Capability', 'Enterprise', 'Platform')),
  producing_capability_id   UUID REFERENCES capabilities(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.9. Only Deliverable and Capability edge types (of the six Ch.9 names) —
-- Obligation/Decision/Knowledge/Evidence edges don't exist because those four
-- object models don't exist in MVP. Capability-type edges reference the
-- specific Service, per Ch.9 §8, not the bare Capability.
CREATE TABLE IF NOT EXISTS dependency_edges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  from_deliverable_id   UUID NOT NULL REFERENCES deliverables(id),
  dependency_type       TEXT NOT NULL CHECK (dependency_type IN ('Deliverable', 'Capability')),
  to_deliverable_id     UUID REFERENCES deliverables(id),
  to_service_id         UUID REFERENCES services(id),
  required_state        TEXT,                              -- e.g. 'Approved' — state the target must reach
  readiness_state       TEXT NOT NULL DEFAULT 'Pending'
                           CHECK (readiness_state IN ('Unknown', 'Pending', 'Satisfied', 'Blocked')),
  CONSTRAINT dependency_target_matches_type CHECK (
    (dependency_type = 'Deliverable' AND to_deliverable_id IS NOT NULL AND to_service_id IS NULL) OR
    (dependency_type = 'Capability' AND to_service_id IS NOT NULL AND to_deliverable_id IS NULL)
  )
);

-- ══════════════════════════════════════════════════════════════════
-- Governance & Runtime Kernel
-- ══════════════════════════════════════════════════════════════════

-- Ch.22. One rule type only (Authorised / Not Authorised) — no Conditions/
-- Escalation/Delegation/Waiver outcomes, no Dual Authority split (that framing
-- is an Architecture Catalogue ADR, not part of Ch.22's own evaluation function).
CREATE TABLE IF NOT EXISTS authority_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  governed_transition   TEXT NOT NULL,             -- e.g. 'seu.commission', 'deliverable.transition'
  authorised_role       TEXT NOT NULL,             -- reuses users.role: 'general' | 'power' | 'super'
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.24. Constraint Type kept (both values usable), Exception mechanism dropped for MVP.
CREATE TABLE IF NOT EXISTS policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'Engineering',
  constraint_type       TEXT NOT NULL DEFAULT 'Policy'
                           CHECK (constraint_type IN ('Policy', 'Standard')),
  governed_transition   TEXT NOT NULL,
  condition             JSONB NOT NULL DEFAULT '{"type":"always_true"}',  -- e.g. {"type":"field_in","field":"profile.environment","values":["production"]}
  severity              TEXT NOT NULL DEFAULT 'Medium',
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ch.29 §10. Generic across entity types — the "config, not code" mechanism
-- that makes SEU and Deliverable transitions declarative rather than hardcoded.
CREATE TABLE IF NOT EXISTS transition_definitions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type                   TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable')),
  from_state                    TEXT NOT NULL,
  to_state                      TEXT NOT NULL,
  required_authority_rule_id    UUID REFERENCES authority_rules(id),
  required_policy_ids           UUID[] NOT NULL DEFAULT '{}',
  UNIQUE (entity_type, from_state, to_state)
);

-- Ch.30. Flat event table — a faithful minimal instance, not a stub.
CREATE TABLE IF NOT EXISTS events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type                TEXT NOT NULL,
  originating_object_type   TEXT NOT NULL,
  originating_object_id     UUID NOT NULL,
  correlation_id            UUID NOT NULL,
  causation_id              UUID,
  payload                   JSONB NOT NULL DEFAULT '{}',
  occurred_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence                  BIGSERIAL
);

CREATE INDEX IF NOT EXISTS idx_events_originating    ON events (originating_object_type, originating_object_id);
CREATE INDEX IF NOT EXISTS idx_events_correlation    ON events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_seu  ON dependency_edges (seu_id);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_from ON dependency_edges (from_deliverable_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_seu      ON deliverables (seu_id);
CREATE INDEX IF NOT EXISTS idx_seu_capabilities_seu  ON seu_capabilities (seu_id);
