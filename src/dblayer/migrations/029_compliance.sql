-- Compliance Model — Plan (design/mvp-build-plan/Compliance Model Plan.md),
-- Phase 15 (Ch.27). Compliance is NOT a new governance mechanism — it composes
-- the existing primitives (Ch.27 §8): a Compliance Requirement is a declarative
-- criteria over Obligations/Evidence/Decisions/Reviews/Quality Gates/Policies
-- that the complianceEngine evaluates by reusing the same resolvers the
-- qualityGateEngine already uses. Evaluation is read-only (§9) and deterministic
-- (FR-27.3); it never modifies engineering state and never blocks a transition.
--
-- Frameworks + requirements are Pack-contributed (FR-27.1) and framework-
-- independent (CM-006). Applicability to an SEU is by the SEU's composed Packs
-- (FR-27.2): a framework applies iff its originating Pack was composed into the
-- SEU's EBM. Evaluations are persisted as immutable snapshots for reproducible
-- history (FR-27.6). None of these is a TransitionEntityType — the requirement
-- definition lifecycle (§14) is Pack-managed for MVP; the active surface is the
-- evaluation, not a governed lifecycle.

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  originating_pack_id UUID REFERENCES packs(id),   -- FR-27.1: contributed through Packs
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  framework_code      TEXT NOT NULL REFERENCES compliance_frameworks(code),
  name                TEXT NOT NULL,
  description         TEXT,
  criteria            JSONB NOT NULL DEFAULT '{}',   -- declarative: { type, category?, gateCode?, policyCode? } — composes existing primitives
  severity            TEXT NOT NULL DEFAULT 'Medium',
  conflicts_with      TEXT[] NOT NULL DEFAULT '{}',  -- explicit conflict declaration (FR-27.7)
  originating_pack_id UUID REFERENCES packs(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_framework ON compliance_requirements (framework_code);

-- A waiver accepts an unsatisfied requirement for an SEU, moving it toward
-- "Compliant with Exceptions" (Ch.27 §9/§10, ComplianceWaiverGranted §15).
CREATE TABLE IF NOT EXISTS compliance_waivers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id            UUID NOT NULL REFERENCES seus(id),
  requirement_code  TEXT NOT NULL REFERENCES compliance_requirements(code),
  rationale         TEXT NOT NULL,
  granted_by        INTEGER REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'Active',   -- Active | Revoked
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_waivers_seu ON compliance_waivers (seu_id);

-- Immutable evaluation snapshots (FR-27.6 reproducible history, §13 immutable).
-- `results` is the per-requirement breakdown (the evidence + traceability §11/§13);
-- `status` is the rolled-up SEU status (§10) and `rationale` its supporting summary.
CREATE TABLE IF NOT EXISTS compliance_evaluations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id      UUID NOT NULL REFERENCES seus(id),
  status      TEXT NOT NULL,
  rationale   JSONB NOT NULL DEFAULT '{}',
  results     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_seu ON compliance_evaluations (seu_id, created_at DESC);
