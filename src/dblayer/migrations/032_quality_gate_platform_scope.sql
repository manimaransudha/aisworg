-- Governance & EBM Sharpening — Plan, Phase 16 step 4 (Ch.26, Open Design
-- Question #3). Quality Gates could not gate Pack or Objective transitions
-- because quality_gate_evaluations.seu_id was NOT NULL and neither entity has a
-- seu_id. Make it nullable AND enforce the scope invariant with a CHECK, so the
-- nullability can't be misused: platform-level entities (Pack/Objective) must
-- have a null SEU; every SEU-scoped entity must have one.
ALTER TABLE quality_gate_evaluations ALTER COLUMN seu_id DROP NOT NULL;
ALTER TABLE quality_gate_evaluations DROP CONSTRAINT IF EXISTS quality_gate_evaluations_scope_check;
ALTER TABLE quality_gate_evaluations ADD CONSTRAINT quality_gate_evaluations_scope_check
  CHECK (
    (entity_type IN ('Pack', 'Objective') AND seu_id IS NULL)
    OR
    (entity_type NOT IN ('Pack', 'Objective') AND seu_id IS NOT NULL)
  );
