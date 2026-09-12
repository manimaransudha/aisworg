-- Ch.13 §8 Participant Identity, owner-directed revision. `participants`
-- (migration 002) is the per-SEU lifecycle/engagement record (Ch.13 §9's
-- state machine); this migration adds `participants_master`, the tenant-
-- scoped, cross-SEU resource registry §8 actually describes — one row per
-- real identity (a human, an AI agent configuration, an Automated
-- integration, an External authority), reusable across many SEU engagements
-- over time. A `participants` row is one engagement of a master resource
-- into one SEU.
--
-- Participant-to-SEU stays 1:1 (existing participants.seu_id) and SEU-to-EBM
-- is already 1:1 (seus.active_ebm_id), so "the EBM governing execution"
-- itself needs no stored field — derivable through that existing chain.
-- But §14's Behaviour Context turns out to mean more than that (owner):
-- tenant-specific eligibility/compliance policy gating whether this identity
-- may work at all, e.g. "some clients have policy that a human participant
-- should have completed a background check to work in their organisation."
-- That's an identity-level property (doesn't reset per SEU engagement), so
-- it lands on participants_master, not participants. Shape: an array of
-- {policy, payload} objects, e.g.
-- [{"policy":"background-verification","payload":{}},{"policy":"qualitygate","payload":{...}}]
-- — deliberately jsonb with no fixed sub-schema (owner: "I do not have an
-- exact shape"); each policy's own payload shape is whatever that policy
-- needs, not constrained here.
--
-- Engineering History (§8) is dropped — derivable via
-- capability_fulfilments -> seus.
--
-- type/capabilities/competency are Ontology-backed (participant-types,
-- capability-name, category:pack respectively — see the competency note
-- below) — no DB CHECK, same dynamic-validation discipline migration 194
-- already established for participants.type.
CREATE TABLE IF NOT EXISTS participants_master (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  type          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  -- Array of capability-name Ontology codes (§7/§10 — "Harry can fulfil
  -- development and code-review capabilities").
  capabilities  JSONB NOT NULL DEFAULT '[]',
  -- { <category:pack code>: [<that dimension's own concept_type codes>] },
  -- e.g. {"Domain":["banking"],"Technology":["nodejs","react"]}. CR-099
  -- (owner: "pack:categories is what should be used for competency... We
  -- were just evolving and so I did not have a perfect design") — dimension
  -- keys are category:pack's own codes (migration 049: Compliance/Domain/
  -- Engineering/Organisation/Integration/Technology), not a separate
  -- competency-dimension concept type (an earlier, superseded pass — see
  -- below). Resolving a dimension to the concept_type holding its real
  -- values needs `dimension.toLowerCase()` (concept_type names must be
  -- lowercase-hyphenated; category:pack's own codes are not).
  competency    JSONB NOT NULL DEFAULT '{}',
  -- Ch.13 §14 Behaviour Context — array of {policy, payload} objects, e.g.
  -- [{"policy":"background-verification","payload":{}}]. No fixed
  -- sub-schema; each policy interprets its own payload.
  behaviour_context JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Only ever set for a Human-type master — the real login this identity
  -- corresponds to. Carries forward the exact purpose participants.user_id
  -- served before this migration (SDK UI Layer Plan's "SEUs I'm a
  -- Participant on" visibility filter, seusDB.ts) now that participants'
  -- own user_id column is repointed at participants_master below.
  user_id       INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- participants.user_id was a stopgap "ahead of real Participant deployment"
-- (migration 014's own comment) — participants_master IS that real
-- deployment now, so the column is repointed at it rather than kept as a
-- second, competing identity reference. Owner: "relates to participants
-- through participant_id (called as user_id in the participant table,
-- rename it to participant_id) fk to master_id." No existing caller ever
-- populates this column (confirmed: replaceParticipant's newUserId is
-- always undefined in every current call site), so there is no data to
-- migrate — USING NULL is safe.
ALTER TABLE participants RENAME COLUMN user_id TO participant_id;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_user_id_fkey;
ALTER TABLE participants ALTER COLUMN participant_id TYPE UUID USING NULL;
ALTER TABLE participants ADD CONSTRAINT participants_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES participants_master(id);

-- §7's Assigned Capabilities reuse the capability-name Ontology vocabulary
-- Pack/Objective/Profile/Service Definition already validate against
-- (CR-086) — nothing new to seed there.

-- Competency — CR-099 revision: no separate parent concept type. The
-- dimension vocabulary IS category:pack (migration 049, already seeded:
-- Compliance/Domain/Engineering/Organisation/Integration/Technology) — a
-- Participant's competency dimension and a Pack's own category are the same
-- concept, not two parallel ones. Only the value-holding child concept
-- types are seeded here, named by category:pack's own codes lower-cased
-- (own name must be lowercase-hyphenated; the code it's named from is not).
-- No "hyper-scale" — dropped along with the superseded competency-dimension
-- parent; there is no matching Pack category for it (open item, CR-099).
-- No domain placeholders here — migration 196 seeds the real, full domain
-- vocabulary (one value per real domain-*.pack.json identity) instead of
-- illustrative examples that don't line up with any actual Pack.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type, ui_grouping) VALUES
  ('technology', 'nodejs', 'Node.js', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'react', 'React', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'rust', 'Rust', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

-- Behaviour Context's own `policy` values — owner: "all context will be
-- ontology backed directly or indirectly." A flat concept_type (no per-policy
-- child concept_type the way competency-dimension has — a policy's `payload`
-- shape is deliberately unconstrained, owner: "I do not have an exact shape
-- and so leave it as a jsonb").
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type) VALUES
  ('behaviour-context-policy', 'background-verification', 'Background Verification', '11111111-1111-1111-1111-111111111111', 'text'),
  ('behaviour-context-policy', 'qualitygate', 'Quality Gate', '11111111-1111-1111-1111-111111111111', 'text')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
