-- CR-104 — SEU-scoped Policy delivery. A Policy governing the SEU's own
-- lifecycle transition (e.g. "SEU|Activated|Operational" — a commence-work
-- sign-off) is a genuinely different scope from one governing an owned
-- entity's transition (Deliverable/AttentionItem/etc, already covered by
-- applicable_policy_ids): commissioning.ts was never meant to reach into
-- general entity-scoped governance, but it does need its own real signal for
-- policies governing the SEU's own hops. Filtered out of the composed
-- Packs' own contributed policies at the same materialisation point
-- (compositionCompleted.ts), by entity_type = 'SEU' in governed_transition —
-- delivered both on the EBMCreated event payload and persisted here, so an
-- SEU-level enforcement stays traceable on the EBM record itself, not just a
-- one-time event.
ALTER TABLE ebms
  ADD COLUMN IF NOT EXISTS seu_scoped_policy_ids UUID[] NOT NULL DEFAULT '{}';

-- CR-104 — a distinct third Policy scope: "Eligibility" governs whether a
-- Participant may even be selected to fulfil a Capability (Ch.12/33's own
-- "who's eligible" question — onboarding, not engineering behaviour), never
-- a transition. governed_transition stays NULL for this scope; the column
-- was NOT NULL, dropped for exactly this case (a scope-conditional column,
-- same discipline other optional-per-scope fields already use elsewhere).
ALTER TABLE policies ALTER COLUMN governed_transition DROP NOT NULL;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'Transition'
  CHECK (scope IN ('Transition', 'Eligibility'));
